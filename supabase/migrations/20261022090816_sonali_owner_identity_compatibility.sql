begin;
-- Resolve legacy owner names and canonical IDs without changing lead records or MAX.
create function public.crm_team_owner_user_id(owner_value text) returns text
language sql stable set search_path=public,pg_temp as $$
 select coalesce(
  (select id from public.users where id=nullif(btrim(owner_value),'')),
  (select min(id) from public.users where lower(btrim(name))=lower(nullif(btrim(owner_value),'')) having count(*)=1)
 );
$$;
revoke all on function public.crm_team_owner_user_id(text) from public,anon,authenticated;
grant execute on function public.crm_team_owner_user_id(text) to service_role;
create or replace function public.crm_sonali_webhook_lead_changed() returns trigger language plpgsql security definer
set search_path=public,pg_temp as $$
declare s public.crm_sonali_webhook_settings%rowtype; ev text; prev text;
begin
 select * into s from public.crm_sonali_webhook_settings where id;
 -- Reassignment invalidates any earlier queued intro, even if subsequently moved back.
 if TG_OP='UPDATE' and (public.crm_team_owner_user_id(new.assigned_to) is distinct from public.crm_team_owner_user_id(old.assigned_to) or not public.crm_sonali_rann_destination(coalesce(nullif(new.trip_details->>'destination',''),new.destination)) or new.status in ('Won','Lost') or public.crm_team_rann_source_website(new.source) is null) then
  update public.crm_sonali_webhook_outbox set state='cancelled',last_error='lead_changed',lease_token=null,locked_until=null,updated_at=now() where lead_id=new.id and state in ('pending','processing');
 end if;
 if public.crm_team_rann_source_website(new.source) is null or not coalesce(s.enabled,false) or public.crm_team_owner_user_id(new.assigned_to) is distinct from s.owner_id or new.status in ('Won','Lost') or not public.crm_sonali_rann_destination(coalesce(nullif(new.trip_details->>'destination',''),new.destination)) then return new; end if;
 if TG_OP='INSERT' then ev:='lead.created';
 elsif public.crm_team_owner_user_id(new.assigned_to) is distinct from public.crm_team_owner_user_id(old.assigned_to) then ev:='lead.assigned';prev:=public.crm_team_owner_user_id(old.assigned_to);
 else return new; end if;
 insert into public.crm_sonali_webhook_outbox(lead_id,event,dedupe_key,expected_owner,previous_owner,next_attempt_at)
 values(new.id,ev,case when TG_OP='INSERT' then new.id::text||':created' else new.id::text||':assigned:'||gen_random_uuid()::text end,s.owner_id,prev,
 case when lower(btrim(new.source)) like 'whatsapp click%' then now()+interval '5 minutes' else now() end)
 on conflict(dedupe_key) do nothing;
 return new;
end;$$;
create or replace function public.crm_sonali_webhook_preflight(p_id uuid,p_lease uuid) returns jsonb
language plpgsql set search_path=public,pg_temp as $$
declare o public.crm_sonali_webhook_outbox%rowtype; l public.leads%rowtype; s public.crm_sonali_webhook_settings%rowtype; reason text; payload jsonb;
begin
 select * into o from public.crm_sonali_webhook_outbox where id=p_id and lease_token=p_lease and state='processing' and locked_until>now() for update;
 if not found then return null; end if;
 select * into s from public.crm_sonali_webhook_settings where id;
 select * into l from public.leads where id=o.lead_id;
 if not s.enabled then reason:='paused';
 elsif public.crm_team_owner_user_id(l.assigned_to) is distinct from s.owner_id or public.crm_team_owner_user_id(l.assigned_to) is distinct from o.expected_owner then reason:='owner_changed';
 elsif not public.crm_sonali_rann_destination(coalesce(nullif(l.trip_details->>'destination',''),l.destination)) then reason:='destination_changed';
 elsif public.crm_team_rann_source_website(l.source) is null then reason:='source_website_excluded';
 elsif l.status in ('Won','Lost') then reason:='lead_closed';
 elsif lower(btrim(l.source)) like 'whatsapp click%' and (
  l.last_customer_message_at>l.created_at-interval '3 hours' or l.last_bot_message_at is not null
  or exists(select 1 from public.crm_interakt_seen where right(phone,10)=right(regexp_replace(coalesce(nullif(l.phone,''),l.contact->>'phone',''),'[^0-9]','','g'),10) and seen_at>=now()-interval '3 hours')
  or exists(select 1 from public.interactions i where i.type='WhatsApp' and i.timestamp::timestamptz>=now()-interval '3 hours' and i.lead_id in (select id::text from public.leads where right(regexp_replace(coalesce(nullif(phone,''),contact->>'phone',''),'[^0-9]','','g'),10)=right(regexp_replace(coalesce(nullif(l.phone,''),l.contact->>'phone',''),'[^0-9]','','g'),10)) and public.crm_interakt_inbound_content(i.content))
 ) then reason:='customer_already_messaged'; end if;
 if reason is not null then update public.crm_sonali_webhook_outbox set state='cancelled',last_error=reason,lease_token=null,locked_until=null,updated_at=now() where id=o.id;return null;end if;
 if lower(btrim(l.source)) like 'whatsapp click%' and now()<o.occurred_at+interval '5 minutes' then
 update public.crm_sonali_webhook_outbox set state='pending',next_attempt_at=o.occurred_at+interval '5 minutes',lease_token=null,locked_until=null where id=o.id;return null;end if;
 payload:=public.crm_max_payload(l)||jsonb_build_object('owner',public.crm_team_owner_user_id(l.assigned_to),'source_website',public.crm_team_rann_source_website(l.source),'destination',coalesce(nullif(l.trip_details->>'destination',''),l.destination),'owner_name',(select name from public.users where id=public.crm_team_owner_user_id(l.assigned_to)),'previous_owner',o.previous_owner,'crm_url','https://ttecrm.vercel.app/#/leads/'||l.id::text);
 return jsonb_build_object('target_url',s.target_url,'signing_secret',s.signing_secret,'authorization',case when s.target_url=s.authorization_target_url then s.bearer_token else null end,'body',jsonb_build_object('id',o.id,'event',o.event,'occurred_at',o.occurred_at,'data',payload));
end;$$;
commit;
