begin;
create table if not exists public.crm_interakt_seen (
 message_id text primary key, phone text not null, seen_at timestamptz not null default now()
);
create index if not exists crm_interakt_seen_phone_idx on public.crm_interakt_seen(right(phone,10),seen_at);
create index if not exists crm_interakt_seen_age_idx on public.crm_interakt_seen(seen_at);
create table if not exists public.crm_interakt_relay (
 phone text primary key, first_at timestamptz not null default now(), last_at timestamptz not null default now(),
 messages jsonb not null default '[]', latest_body jsonb not null,
 state text not null default 'pending' check(state in ('pending','sending')),
 attempts integer not null default 0, next_attempt_at timestamptz not null default now(),
 locked_until timestamptz, lease_token uuid, last_error text, last_http_status integer,
 sending_messages jsonb not null default '[]', sending_body jsonb, sending_first_at timestamptz, sending_last_at timestamptz
);
create table if not exists public.crm_interakt_housekeeping (
 id boolean primary key default true check(id), last_cleanup_at timestamptz not null default '-infinity'
);
insert into public.crm_interakt_housekeeping(id) values(true) on conflict do nothing;

-- One transaction dedupes, appends a burst, and logs every matching existing lead.
create or replace function public.crm_interakt_enqueue(p_body jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare phone_number text:=p_body#>>'{data,customer,channel_phone_number}'; message_id text:=p_body#>>'{data,message,id}';
 msg jsonb:=p_body#>'{data,message}'; item jsonb; lid uuid; received timestamptz; inserted integer;
begin
 if p_body->>'type' is distinct from 'message_received' or msg->>'chat_message_type' is distinct from 'CustomerMessage' then raise exception 'Not a customer message'; end if;
 if phone_number is null or phone_number !~ '^[0-9]{10,15}$' or coalesce(btrim(message_id),'')='' or length(message_id)>200 then raise exception 'Invalid message identity'; end if;
 insert into public.crm_interakt_seen(message_id,phone) values(message_id,phone_number) on conflict do nothing;
 get diagnostics inserted=row_count;
 if inserted=0 then return jsonb_build_object('duplicate',true); end if;
 item:=jsonb_build_object('id',message_id,'text',msg->'message','type',msg->'message_content_type','media_url',msg->'media_url','received_at_utc',msg->'received_at_utc');
 insert into public.crm_interakt_relay(phone,messages,latest_body) values(phone_number,jsonb_build_array(item),p_body)
 on conflict(phone) do update set messages=crm_interakt_relay.messages||excluded.messages,latest_body=excluded.latest_body,
 first_at=case when jsonb_array_length(crm_interakt_relay.messages)=0 then now() else crm_interakt_relay.first_at end,last_at=now();
 begin received:=coalesce((msg->>'received_at_utc')::timestamp at time zone 'UTC',now()); exception when others then received:=now(); end;
 received:=least(received,now());
 for lid in select id from public.leads where right(regexp_replace(coalesce(nullif(phone,''),contact->>'phone',''),'[^0-9]','','g'),10)=right(phone_number,10) order by id loop
  insert into public.interactions(id,lead_id,type,content,timestamp)
  values('interakt_'||md5(message_id||lid::text),lid::text,'WhatsApp',jsonb_build_object('direction','in','text',coalesce(msg->>'message',''),'status','received','phone',right(phone_number,10),'message_id',message_id,'media_url',msg->'media_url','message_content_type',msg->'message_content_type','actor','Interakt')::text,received)
  on conflict(id) do nothing;
 end loop;
 return jsonb_build_object('queued',true);
end; $$;

-- Arrivals during an HTTP send stay in messages; they cannot be deleted with that batch.
create or replace function public.crm_interakt_finish(p_phone text,p_lease uuid,p_status integer,p_error text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.crm_interakt_relay%rowtype;
begin
 select * into r from public.crm_interakt_relay where phone=p_phone and lease_token=p_lease and state='sending' for update;
 if not found then return; end if;
 if p_status between 200 and 299 then
  if jsonb_array_length(r.messages)=0 then delete from public.crm_interakt_relay where phone=p_phone;
  else update public.crm_interakt_relay set state='pending',attempts=0,next_attempt_at=now(),lease_token=null,locked_until=null,last_error=null,last_http_status=p_status,sending_messages='[]',sending_body=null,sending_first_at=null,sending_last_at=null where phone=p_phone; end if;
 else
  update public.crm_interakt_relay set state='pending',messages=r.sending_messages||r.messages,
   first_at=r.sending_first_at,last_at=case when jsonb_array_length(r.messages)>0 then r.last_at else r.sending_last_at end,
   latest_body=case when jsonb_array_length(r.messages)>0 then r.latest_body else r.sending_body end,
   next_attempt_at=now()+interval '60 seconds',lease_token=null,locked_until=null,last_error=left(p_error,300),last_http_status=p_status,
   sending_messages='[]',sending_body=null,sending_first_at=null,sending_last_at=null where phone=p_phone;
 end if;
end; $$;
create or replace function public.crm_interakt_claim(p_limit integer default 20) returns setof jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.crm_interakt_relay%rowtype; lease uuid; cleaned boolean;
begin
 update public.crm_interakt_housekeeping set last_cleanup_at=now() where id and last_cleanup_at<=now()-interval '1 day' returning true into cleaned;
 if cleaned then delete from public.crm_interakt_seen where seen_at<now()-interval '7 days'; end if;
 for r in select * from public.crm_interakt_relay where state='sending' and locked_until<now() for update skip locked loop
  perform public.crm_interakt_finish(r.phone,r.lease_token,0,'Worker lease expired');
 end loop;
 for r in select * from public.crm_interakt_relay where state='pending' and attempts<10 and next_attempt_at<=now() and jsonb_array_length(messages)>0
  and (last_at<=now()-interval '60 seconds' or first_at<=now()-interval '180 seconds') order by first_at,phone for update skip locked limit least(greatest(p_limit,1),25) loop
  lease:=gen_random_uuid();
  update public.crm_interakt_relay set state='sending',attempts=attempts+1,lease_token=lease,locked_until=now()+interval '2 minutes',
   sending_messages=r.messages,sending_body=r.latest_body,sending_first_at=r.first_at,sending_last_at=r.last_at,messages='[]' where phone=r.phone;
  return next jsonb_build_object('phone',r.phone,'lease_token',lease,'attempts',r.attempts+1,'messages',r.messages,'body',r.latest_body,'first_at',r.first_at,'last_at',r.last_at);
 end loop;
end; $$;

-- Delay only the two introduction events, without replacing existing lead/follow-up triggers.
create or replace function public.crm_max_click_delay() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.event in ('lead.created','lead.assigned_to_admin') and exists(select 1 from public.leads where id=new.lead_id and lower(btrim(source)) like 'whatsapp click%') then
  new.next_attempt_at:=greatest(coalesce(new.next_attempt_at,now()),now()+interval '5 minutes');
 end if;
 return new;
end; $$;
drop trigger if exists crm_max_click_delay on public.crm_max_outbox;
create trigger crm_max_click_delay before insert on public.crm_max_outbox for each row execute function public.crm_max_click_delay();

create or replace function public.crm_interakt_inbound_content(content text) returns boolean language plpgsql immutable as $$
begin return content::jsonb->>'direction' in ('in','inbound'); exception when others then return false; end; $$;
CREATE OR REPLACE FUNCTION public.crm_max_preflight(p_id uuid, p_lease uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare o public.crm_max_outbox%rowtype; l public.leads%rowtype; f public.crm_max_followups%rowtype; s public.crm_max_settings%rowtype;
begin
 select * into o from public.crm_max_outbox where id=p_id and lease_token=p_lease and state='processing' for update;
 if not found then return null; end if;
 select * into l from public.leads where id=o.lead_id;
 select * into s from public.crm_max_settings where id;
 if not public.crm_max_owner_eligible(l.assigned_to) or not s.enabled then update public.crm_max_outbox set state='cancelled',last_error='dispatch_disabled_or_owner_changed',updated_at=now() where id=o.id; return null; end if;
 if o.event in ('lead.created','lead.assigned_to_admin') and lower(btrim(l.source)) like 'whatsapp click%' and (
  l.last_customer_message_at > l.created_at-interval '3 hours' or l.last_bot_message_at is not null
  or exists(select 1 from public.crm_interakt_seen where right(phone,10)=right(regexp_replace(coalesce(nullif(l.phone,''),l.contact->>'phone',''),'[^0-9]','','g'),10) and seen_at>=now()-interval '3 hours')
  or exists(select 1 from public.interactions i where i.type='WhatsApp' and i.timestamp::timestamptz>=now()-interval '3 hours' and i.lead_id in (select id::text from public.leads where right(regexp_replace(coalesce(nullif(phone,''),contact->>'phone',''),'[^0-9]','','g'),10)=right(regexp_replace(coalesce(nullif(l.phone,''),l.contact->>'phone',''),'[^0-9]','','g'),10)) and public.crm_interakt_inbound_content(i.content))
 ) then
  update public.crm_max_outbox set state='cancelled',last_error='customer_already_messaged',locked_until=null,updated_at=now() where id=o.id;
  return null;
 end if;
 if o.event='followup.due' then
  select * into f from public.crm_max_followups where id=o.followup_id;
  if f.state<>'queued' or not public.crm_max_nudge_eligible(l.id) or l.last_customer_message_at>=f.anchor_at then update public.crm_max_outbox set state='cancelled',last_error='followup_cancelled',updated_at=now() where id=o.id; return null; end if;
  if f.step<>1 and public.crm_max_allowed_time(now())>now() then update public.crm_max_outbox set state='pending',next_attempt_at=public.crm_max_allowed_time(now()),updated_at=now() where id=o.id; return null; end if;
  o.payload:=o.payload||jsonb_build_object('lead_id',l.id,'last_note',(select content from public.interactions where lead_id=l.id::text and type='Note' order by timestamp desc limit 1),'ref_id',l.lead_code,'anchor_at',f.anchor_at,'kind',case when f.step=1 then 'same_day_nudge' else 'followup' end,'requires_chat_review',f.step=1);
 else o.payload:=public.crm_max_payload(l); end if;
 return jsonb_build_object('target_url',s.target_url,'signing_secret',s.signing_secret,'body',jsonb_build_object('id',o.id,'event',o.event,'occurred_at',o.created_at,'data',o.payload));
end; $function$
;
do $$ declare t text; fn record; begin
 foreach t in array array['crm_interakt_seen','crm_interakt_relay','crm_interakt_housekeeping'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
 for fn in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace and (proname like 'crm_interakt_%' or proname in ('crm_max_click_delay','crm_max_preflight')) loop
  execute format('revoke all on function %s from public,anon,authenticated',fn.signature);
  execute format('grant execute on function %s to service_role',fn.signature);
 end loop;
end $$;
notify pgrst, 'reload schema';
commit;
