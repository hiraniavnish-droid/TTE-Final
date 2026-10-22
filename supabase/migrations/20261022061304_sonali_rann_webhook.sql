begin;
-- Independent subscription; deliberately does not alter any crm_max_* object.
create table public.crm_sonali_webhook_settings (
 id boolean primary key default true check(id), enabled boolean not null default false,
 target_url text, signing_secret text not null default encode(extensions.gen_random_bytes(32),'hex'),
 owner_id text not null, updated_at timestamptz not null default now(),
 check(not enabled or (target_url is not null and target_url like 'https://%' and length(signing_secret)>=32))
);
insert into public.crm_sonali_webhook_settings(id,owner_id)
 select true,id from public.users where lower(btrim(name))='sonali' and role='agent';
do $$begin if (select count(*) from public.crm_sonali_webhook_settings)<>1 then raise exception 'Exactly one Sonali user is required'; end if; end$$;
create table public.crm_sonali_webhook_outbox (
 id uuid primary key default gen_random_uuid(), lead_id uuid not null references public.leads(id) on delete cascade,
 event text not null check(event in ('lead.created','lead.assigned')), occurred_at timestamptz not null default now(),
 dedupe_key text not null unique, expected_owner text not null, previous_owner text,
 state text not null default 'pending' check(state in ('pending','processing','delivered','cancelled','failed')),
 next_attempt_at timestamptz not null default now(), attempts integer not null default 0,
 lease_token uuid, locked_until timestamptz, last_http_status integer, last_error text, updated_at timestamptz not null default now()
);
create index crm_sonali_webhook_due on public.crm_sonali_webhook_outbox(next_attempt_at) where state in ('pending','processing');
create index crm_sonali_webhook_lead on public.crm_sonali_webhook_outbox(lead_id);
alter table public.crm_sonali_webhook_settings enable row level security;
alter table public.crm_sonali_webhook_outbox enable row level security;
revoke all on public.crm_sonali_webhook_settings,public.crm_sonali_webhook_outbox from public,anon,authenticated;
grant select,insert,update,delete on public.crm_sonali_webhook_settings,public.crm_sonali_webhook_outbox to service_role;

create function public.crm_sonali_rann_destination(d text) returns boolean language sql immutable
set search_path=public,pg_temp as $$
 select coalesce(lower(btrim(d)) ~ '(^|[^a-z])(rann[[:space:]-]*utsav|rann[[:space:]-]*tent[[:space:]-]*resort|rann[[:space:]-]*resort|white[[:space:]-]*rann|namak|namuk)([^a-z]|$)',false);
$$;

create function public.crm_sonali_webhook_lead_changed() returns trigger language plpgsql security definer
set search_path=public,pg_temp as $$
declare s public.crm_sonali_webhook_settings%rowtype; ev text; prev text;
begin
 select * into s from public.crm_sonali_webhook_settings where id;
 -- Reassignment invalidates any earlier queued intro, even if subsequently moved back.
 if TG_OP='UPDATE' and (new.assigned_to is distinct from old.assigned_to or not public.crm_sonali_rann_destination(coalesce(nullif(new.trip_details->>'destination',''),new.destination)) or new.status in ('Won','Lost')) then
  update public.crm_sonali_webhook_outbox set state='cancelled',last_error='lead_changed',lease_token=null,locked_until=null,updated_at=now() where lead_id=new.id and state in ('pending','processing');
 end if;
 if not coalesce(s.enabled,false) or new.assigned_to is distinct from s.owner_id or new.status in ('Won','Lost') or not public.crm_sonali_rann_destination(coalesce(nullif(new.trip_details->>'destination',''),new.destination)) then return new; end if;
 if TG_OP='INSERT' then ev:='lead.created';
 elsif new.assigned_to is distinct from old.assigned_to then ev:='lead.assigned';prev:=old.assigned_to;
 else return new; end if;
 insert into public.crm_sonali_webhook_outbox(lead_id,event,dedupe_key,expected_owner,previous_owner,next_attempt_at)
 values(new.id,ev,case when TG_OP='INSERT' then new.id::text||':created' else new.id::text||':assigned:'||gen_random_uuid()::text end,s.owner_id,prev,
 case when lower(btrim(new.source)) like 'whatsapp click%' then now()+interval '5 minutes' else now() end)
 on conflict(dedupe_key) do nothing;
 return new;
end;$$;
create trigger crm_sonali_webhook_lead_changed after insert or update on public.leads for each row execute function public.crm_sonali_webhook_lead_changed();

create function public.crm_sonali_webhook_claim(p_limit integer default 20) returns setof public.crm_sonali_webhook_outbox
language sql set search_path=public,pg_temp as $$
 with jobs as (
  select o.id from public.crm_sonali_webhook_outbox o where exists(select 1 from public.crm_sonali_webhook_settings where id and enabled)
  and (o.state='pending' or (o.state='processing' and o.locked_until<now())) and o.next_attempt_at<=now()
  order by o.next_attempt_at limit greatest(0,least(p_limit,20)) for update skip locked
 ) update public.crm_sonali_webhook_outbox o set state='processing',lease_token=gen_random_uuid(),locked_until=now()+interval '2 minutes',attempts=attempts+1,updated_at=now()
 from jobs where o.id=jobs.id returning o.*;
$$;

create function public.crm_sonali_webhook_preflight(p_id uuid,p_lease uuid) returns jsonb
language plpgsql set search_path=public,pg_temp as $$
declare o public.crm_sonali_webhook_outbox%rowtype; l public.leads%rowtype; s public.crm_sonali_webhook_settings%rowtype; reason text; payload jsonb;
begin
 select * into o from public.crm_sonali_webhook_outbox where id=p_id and lease_token=p_lease and state='processing' and locked_until>now() for update;
 if not found then return null; end if;
 select * into s from public.crm_sonali_webhook_settings where id;
 select * into l from public.leads where id=o.lead_id;
 if not s.enabled then reason:='paused';
 elsif l.assigned_to is distinct from s.owner_id or l.assigned_to is distinct from o.expected_owner then reason:='owner_changed';
 elsif not public.crm_sonali_rann_destination(coalesce(nullif(l.trip_details->>'destination',''),l.destination)) then reason:='destination_changed';
 elsif l.status in ('Won','Lost') then reason:='lead_closed';
 elsif lower(btrim(l.source)) like 'whatsapp click%' and (
  l.last_customer_message_at>l.created_at-interval '3 hours' or l.last_bot_message_at is not null
  or exists(select 1 from public.crm_interakt_seen where right(phone,10)=right(regexp_replace(coalesce(nullif(l.phone,''),l.contact->>'phone',''),'[^0-9]','','g'),10) and seen_at>=now()-interval '3 hours')
  or exists(select 1 from public.interactions i where i.type='WhatsApp' and i.timestamp::timestamptz>=now()-interval '3 hours' and i.lead_id in (select id::text from public.leads where right(regexp_replace(coalesce(nullif(phone,''),contact->>'phone',''),'[^0-9]','','g'),10)=right(regexp_replace(coalesce(nullif(l.phone,''),l.contact->>'phone',''),'[^0-9]','','g'),10)) and public.crm_interakt_inbound_content(i.content))
 ) then reason:='customer_already_messaged'; end if;
 if reason is not null then update public.crm_sonali_webhook_outbox set state='cancelled',last_error=reason,lease_token=null,locked_until=null,updated_at=now() where id=o.id;return null;end if;
 payload:=public.crm_max_payload(l)||jsonb_build_object('destination',coalesce(nullif(l.trip_details->>'destination',''),l.destination),'owner_name',(select name from public.users where id=l.assigned_to),'previous_owner',o.previous_owner,'crm_url','https://ttecrm.vercel.app/#/leads/'||l.id::text);
 return jsonb_build_object('target_url',s.target_url,'signing_secret',s.signing_secret,'body',jsonb_build_object('id',o.id,'event',o.event,'occurred_at',o.occurred_at,'data',payload));
end;$$;

create function public.crm_sonali_webhook_finish(p_id uuid,p_lease uuid,p_status integer,p_error text) returns void
language sql set search_path=public,pg_temp as $$
 update public.crm_sonali_webhook_outbox set state=case when p_status between 200 and 299 then 'delivered' when attempts>=10 then 'failed' else 'pending' end,
 next_attempt_at=now()+make_interval(secs=>least(21600,60*power(2,least(attempts-1,9)))::integer),
 last_http_status=p_status,last_error=nullif(left(p_error,500),''),lease_token=null,locked_until=null,updated_at=now()
 where id=p_id and lease_token=p_lease and state='processing';
$$;

create function public.crm_sonali_webhook_settings_write(p_data jsonb) returns void language plpgsql set search_path=public,pg_temp as $$
begin
 update public.crm_sonali_webhook_settings set enabled=coalesce((p_data->>'enabled')::boolean,enabled),target_url=coalesce(p_data->>'target_url',target_url),signing_secret=coalesce(p_data->>'signing_secret',signing_secret),updated_at=now() where id;
 if not (select enabled from public.crm_sonali_webhook_settings where id) then
 update public.crm_sonali_webhook_outbox set state='cancelled',last_error='paused',lease_token=null,locked_until=null,updated_at=now() where state in ('pending','processing');
 end if;
end;$$;

revoke all on function public.crm_sonali_rann_destination(text),public.crm_sonali_webhook_lead_changed(),public.crm_sonali_webhook_claim(integer),public.crm_sonali_webhook_preflight(uuid,uuid),public.crm_sonali_webhook_finish(uuid,uuid,integer,text),public.crm_sonali_webhook_settings_write(jsonb) from public,anon,authenticated;
grant execute on function public.crm_sonali_rann_destination(text),public.crm_sonali_webhook_claim(integer),public.crm_sonali_webhook_preflight(uuid,uuid),public.crm_sonali_webhook_finish(uuid,uuid,integer,text),public.crm_sonali_webhook_settings_write(jsonb) to service_role;
commit;
