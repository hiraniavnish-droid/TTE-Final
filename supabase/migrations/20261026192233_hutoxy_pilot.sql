begin;
-- Additive pilot only. No existing MAX, Interakt, staff-routing or lead owner
-- configuration is updated. The new user is provisioned separately.
create table public.crm_hutoxy_settings (
 id boolean primary key default true check(id),
 owner_id text not null references public.users(id),
 enabled boolean not null default false,
 target_url text,
 test_only boolean not null default true,
 test_phone text not null default '9601070220' check(test_phone ~ '^[0-9]{10}$'),
 updated_at timestamptz not null default now(),
 check(not enabled or (target_url is not null and target_url like 'https://%'))
);
insert into public.crm_hutoxy_settings(id,owner_id)
 select true,id from public.users where name='Hutoxy Pilot' and role='agent';
do $$begin if (select count(*) from public.crm_hutoxy_settings)<>1 then raise exception 'Exactly one Hutoxy Pilot agent required'; end if;end$$;

create table public.crm_hutoxy_outbox (
 id uuid primary key default gen_random_uuid(),
 lead_id uuid not null references public.leads(id) on delete cascade,
 interaction_id text,
 event text not null check(event in ('lead.created','lead.assigned','customer.message')),
 occurred_at timestamptz not null default now(),
 dedupe_key text not null unique,
 state text not null default 'pending' check(state in ('pending','processing','delivered','cancelled','failed')),
 attempts integer not null default 0,
 next_attempt_at timestamptz not null default now(),
 lease_token uuid, locked_until timestamptz,
 last_http_status integer,last_error text
);
create index crm_hutoxy_due on public.crm_hutoxy_outbox(next_attempt_at) where state in ('pending','processing');
create index crm_hutoxy_lead on public.crm_hutoxy_outbox(lead_id);
create table public.crm_hutoxy_requests (
 id text primary key, request_hash text not null, response jsonb,
 created_at timestamptz not null default now()
);

-- Stable IDs and names both resolve through the existing service-only helper.
create function public.crm_hutoxy_eligible(l public.leads) returns boolean
language sql stable set search_path=public,pg_temp as $$
 select coalesce(exists(select 1 from public.crm_hutoxy_settings s
 where public.crm_team_owner_user_id(l.assigned_to)=s.owner_id
 and public.crm_jigar_rann_destination(coalesce(nullif(l.trip_details->>'destination',''),l.destination))
 and (not s.test_only or right(regexp_replace(coalesce(nullif(l.phone,''),l.contact->>'phone',''),'[^0-9]','','g'),10)=s.test_phone)),false);
$$;
create function public.crm_hutoxy_lead_json(l public.leads) returns jsonb
language sql stable set search_path=public,pg_temp as $$
 select jsonb_build_object('id',l.id,'ref_id',coalesce(l.lead_code,l.id::text),'name',l.name,
 'owner',(select owner_id from public.crm_hutoxy_settings),'owner_name','Hutoxy Pilot',
 'contact',jsonb_build_object('phone',coalesce(l.phone,l.contact->>'phone',''),'email',coalesce(l.email,l.contact->>'email','')),
 'source',l.source,'status',l.status,'temperature',l.temperature,
 'trip',coalesce(l.trip_details,'{}')||jsonb_build_object('destination',coalesce(nullif(l.trip_details->>'destination',''),l.destination)),
 'budget',l.budget,'last_customer_message_at',l.last_customer_message_at,'last_bot_message_at',l.last_bot_message_at,
 'created_at',l.created_at,'updated_at',l.updated_at);
$$;
create function public.crm_hutoxy_content(value text) returns jsonb language plpgsql immutable set search_path=public,pg_temp as $$
begin return value::jsonb;exception when others then return jsonb_build_object('text',value);end$$;

-- Trigger functions require elevated privileges to append to the private
-- outbox during ordinary staff saves. They are not callable through the API.
create function public.crm_hutoxy_lead_changed() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare ev text;
begin
 if not public.crm_hutoxy_eligible(new) or new.status in ('Won','Lost') then
  update public.crm_hutoxy_outbox set state='cancelled',last_error='lead_no_longer_eligible',lease_token=null,locked_until=null
  where lead_id=new.id and state in ('pending','processing');
  return new;
 end if;
 if not (select enabled from public.crm_hutoxy_settings where id) then return new;end if;
 if TG_OP='INSERT' then ev:='lead.created';
 elsif public.crm_team_owner_user_id(new.assigned_to) is distinct from public.crm_team_owner_user_id(old.assigned_to) then ev:='lead.assigned';
 else return new;end if;
 insert into public.crm_hutoxy_outbox(lead_id,event,dedupe_key,next_attempt_at)
 values(new.id,ev,case when TG_OP='INSERT' then new.id::text||':created' else new.id::text||':assigned:'||gen_random_uuid()::text end,
 case when lower(btrim(new.source)) like 'whatsapp click%' then now()+interval '5 minutes' else now() end)
 on conflict(dedupe_key) do nothing;
 return new;
end$$;
create trigger crm_hutoxy_lead_changed after insert or update on public.leads for each row execute function public.crm_hutoxy_lead_changed();
create function public.crm_hutoxy_message_received() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare l public.leads%rowtype; body jsonb;
begin
 if new.type<>'WhatsApp' or not (select enabled from public.crm_hutoxy_settings where id) then return new;end if;
 body:=public.crm_hutoxy_content(new.content);
 if coalesce(body->>'direction','') not in ('in','inbound') or body->>'actor'='Hutoxy Pilot' then return new;end if;
 select * into l from public.leads where id::text=new.lead_id;
 if not found or not public.crm_hutoxy_eligible(l) or l.status in ('Won','Lost') then return new;end if;
 insert into public.crm_hutoxy_outbox(lead_id,interaction_id,event,dedupe_key)
 values(l.id,new.id,'customer.message','message:'||new.id) on conflict(dedupe_key) do nothing;
 return new;
end$$;
create trigger crm_hutoxy_message_received after insert on public.interactions for each row execute function public.crm_hutoxy_message_received();

-- The dedicated HTTP API calls this service-only function. Every per-lead
-- operation rechecks ownership and pilot phone restrictions in the database.
create function public.crm_hutoxy_api(p_action text,p_ref text default null,p_data jsonb default '{}') returns jsonb
language plpgsql set search_path=public,pg_temp as $$
declare l public.leads%rowtype; result jsonb; rows jsonb; tail jsonb; op public.crm_hutoxy_requests%rowtype;
 size integer:=least(100,greatest(1,coalesce((p_data->>'limit')::integer,50)));
 iid text; record_content jsonb; stamp timestamptz;
begin
 if p_action='settings' then
  return (select to_jsonb(s) from public.crm_hutoxy_settings s where id);
 elsif p_action='settings_write' then
  if (p_data-'enabled'-'target_url')<>'{}'::jsonb then raise exception 'invalid_settings';end if;
  update public.crm_hutoxy_settings set enabled=coalesce((p_data->>'enabled')::boolean,enabled),target_url=coalesce(p_data->>'target_url',target_url),updated_at=now() where id;
  if not (select enabled from public.crm_hutoxy_settings) then
   update public.crm_hutoxy_outbox set state='cancelled',last_error='paused',lease_token=null,locked_until=null where state in ('pending','processing');
  end if;
  return (select to_jsonb(s) from public.crm_hutoxy_settings s where id);
 elsif p_action='leads' then
  select coalesce(jsonb_agg(public.crm_hutoxy_lead_json(t) order by t.updated_at,t.id),'[]') into rows
  from (select a.* from public.leads a where public.crm_hutoxy_eligible(a)
   and (p_data->>'updated_since' is null or a.updated_at>=(p_data->>'updated_since')::timestamptz)
   and (p_data->>'after_time' is null or (a.updated_at,a.id)>((p_data->>'after_time')::timestamptz,(p_data->>'after_id')::uuid))
   order by a.updated_at,a.id limit size+1) t;
  tail:=rows->(least(size,jsonb_array_length(rows))-1);
  return jsonb_build_object('data',(select coalesce(jsonb_agg(v),'[]') from jsonb_array_elements(rows) with ordinality x(v,n) where n<=size),
   'next_cursor',case when jsonb_array_length(rows)>size then jsonb_build_object('time',tail->>'updated_at','id',tail->>'id') else null end);
 elsif p_action='deliveries' then
  return (select coalesce(jsonb_agg(to_jsonb(o) order by o.occurred_at desc),'[]') from
   (select id,event,state,attempts,last_http_status,last_error,occurred_at from public.crm_hutoxy_outbox order by occurred_at desc limit size) o);
 end if;
 select * into l from public.leads where (lead_code=p_ref or id::text=p_ref) for update;
 if not found or not public.crm_hutoxy_eligible(l) then return jsonb_build_object('error','lead_not_in_pilot');end if;
 if p_action='lead' then return public.crm_hutoxy_lead_json(l);
 elsif p_action='messages' then
  select coalesce(jsonb_agg(to_jsonb(i)-'content'||jsonb_build_object('content',public.crm_hutoxy_content(i.content)) order by i.timestamp,i.id),'[]') into rows
   from (select id,type,content,timestamp from public.interactions where lead_id=l.id::text and type='WhatsApp'
   and (p_data->>'after_time' is null or (timestamp,id)>((p_data->>'after_time')::timestamptz,p_data->>'after_id'))
   order by timestamp,id limit size+1) i;
  tail:=rows->(least(size,jsonb_array_length(rows))-1);
  return jsonb_build_object('data',(select coalesce(jsonb_agg(v),'[]') from jsonb_array_elements(rows) with ordinality x(v,n) where n<=size),
   'next_cursor',case when jsonb_array_length(rows)>size then jsonb_build_object('time',tail->>'timestamp','id',tail->>'id') else null end);
 elsif p_action in ('record_message','record_quote') then
  if l.status in ('Won','Lost') then return jsonb_build_object('error','lead_closed');end if;
  if length(coalesce(p_data->>'idempotency_id',''))<>64 or length(coalesce(p_data->>'request_hash',''))<>64 then raise exception 'invalid_idempotency';end if;
  insert into public.crm_hutoxy_requests(id,request_hash) values(p_data->>'idempotency_id',p_data->>'request_hash') on conflict do nothing;
  select * into op from public.crm_hutoxy_requests where id=p_data->>'idempotency_id' for update;
  if op.request_hash<>p_data->>'request_hash' then return jsonb_build_object('error','idempotency_conflict');end if;
  if op.response is not null then return op.response;end if;
  iid:='hutoxy_'||gen_random_uuid()::text;stamp:=coalesce((p_data#>>'{body,time}')::timestamptz,(p_data#>>'{body,created_at}')::timestamptz,now());
  record_content:=p_data->'body'||jsonb_build_object('actor','Hutoxy Pilot','client','hutoxy-pilot','kind',case when p_action='record_quote' then 'quote' else 'message' end);
  insert into public.interactions(id,lead_id,type,content,timestamp)
   values(iid,l.id::text,case when p_action='record_quote' then 'Note' else 'WhatsApp' end,record_content::text,stamp);
  result:=jsonb_build_object('id',iid,'lead_id',l.id,'ref_id',l.lead_code,'recorded',true,'sent',false,'timestamp',stamp);
  update public.crm_hutoxy_requests set response=result where id=op.id;return result;
 end if;
 raise exception 'unsupported_pilot_action';
end$$;

create function public.crm_hutoxy_claim(p_limit integer default 20) returns setof public.crm_hutoxy_outbox
language sql set search_path=public,pg_temp as $$
 with jobs as (select id from public.crm_hutoxy_outbox where (select enabled from public.crm_hutoxy_settings)
 and (state='pending' or (state='processing' and locked_until<now())) and next_attempt_at<=now()
 order by next_attempt_at limit least(20,greatest(0,p_limit)) for update skip locked)
 update public.crm_hutoxy_outbox o set state='processing',attempts=attempts+1,lease_token=gen_random_uuid(),locked_until=now()+interval '2 minutes'
 from jobs where o.id=jobs.id returning o.*;
$$;
create function public.crm_hutoxy_preflight(p_id uuid,p_lease uuid) returns jsonb
language plpgsql set search_path=public,pg_temp as $$
declare o public.crm_hutoxy_outbox%rowtype;l public.leads%rowtype;s public.crm_hutoxy_settings%rowtype; message jsonb;
begin
 select * into o from public.crm_hutoxy_outbox where id=p_id and lease_token=p_lease and state='processing' and locked_until>now() for update;
 if not found then return null;end if;
 select * into s from public.crm_hutoxy_settings where id;select * into l from public.leads where id=o.lead_id;
 if not s.enabled or not public.crm_hutoxy_eligible(l) or l.status in ('Won','Lost') then
  update public.crm_hutoxy_outbox set state='cancelled',last_error='preflight_ineligible',lease_token=null,locked_until=null where id=o.id;return null;
 end if;
 if o.event='customer.message' then
  select jsonb_build_object('id',i.id,'timestamp',i.timestamp,'content',public.crm_hutoxy_content(i.content)) into message from public.interactions i where i.id=o.interaction_id and i.lead_id=l.id::text;
  if message is null then update public.crm_hutoxy_outbox set state='cancelled',last_error='message_removed',lease_token=null,locked_until=null where id=o.id;return null;end if;
 end if;
 return jsonb_build_object('target_url',s.target_url,'body',jsonb_build_object('id',o.id,'event',o.event,'occurred_at',o.occurred_at,
 'data',public.crm_hutoxy_lead_json(l)||case when message is null then '{}'::jsonb else jsonb_build_object('message',message) end));
end$$;
create function public.crm_hutoxy_finish(p_id uuid,p_lease uuid,p_status integer,p_error text) returns void
language sql set search_path=public,pg_temp as $$
 update public.crm_hutoxy_outbox set state=case when p_status between 200 and 299 then 'delivered' when attempts>=10 then 'failed' else 'pending' end,
 next_attempt_at=now()+make_interval(secs=>least(21600,60*power(2,least(attempts-1,9)))::integer),last_http_status=p_status,last_error=nullif(left(p_error,500),''),lease_token=null,locked_until=null
 where id=p_id and lease_token=p_lease and state='processing';
$$;

alter table public.crm_hutoxy_settings enable row level security;
alter table public.crm_hutoxy_outbox enable row level security;
alter table public.crm_hutoxy_requests enable row level security;
revoke all on public.crm_hutoxy_settings,public.crm_hutoxy_outbox,public.crm_hutoxy_requests from public,anon,authenticated;
grant select,insert,update,delete on public.crm_hutoxy_settings,public.crm_hutoxy_outbox,public.crm_hutoxy_requests to service_role;
revoke all on function public.crm_hutoxy_eligible(public.leads),public.crm_hutoxy_lead_json(public.leads),public.crm_hutoxy_content(text),public.crm_hutoxy_lead_changed(),public.crm_hutoxy_message_received(),public.crm_hutoxy_api(text,text,jsonb),public.crm_hutoxy_claim(integer),public.crm_hutoxy_preflight(uuid,uuid),public.crm_hutoxy_finish(uuid,uuid,integer,text) from public,anon,authenticated;
grant execute on function public.crm_hutoxy_eligible(public.leads),public.crm_hutoxy_lead_json(public.leads),public.crm_hutoxy_content(text),public.crm_hutoxy_api(text,text,jsonb),public.crm_hutoxy_claim(integer),public.crm_hutoxy_preflight(uuid,uuid),public.crm_hutoxy_finish(uuid,uuid,integer,text) to service_role;
notify pgrst,'reload schema';
commit;
