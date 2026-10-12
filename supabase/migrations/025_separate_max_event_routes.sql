-- CRM business webhook is limited to lead.created and followup.due.
-- Interakt destinations are configured independently in the relay environment.
BEGIN;
CREATE OR REPLACE FUNCTION public.crm_max_lead_changed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
 if TG_OP='INSERT' then
  if public.crm_max_owner_eligible(new.assigned_to) then insert into public.crm_max_outbox(lead_id,event,payload) values(new.id,'lead.created',public.crm_max_payload(new)); end if;
 else
  if new.assigned_to is distinct from old.assigned_to then
   if not public.crm_max_owner_eligible(new.assigned_to) then perform public.crm_max_cancel(new.id,'owner_changed');
   end if;
  end if;
  if new.status is distinct from old.status then insert into public.crm_max_activity_status(lead_id,before_status,after_status) values(new.id,old.status,new.status); end if;
  if new.last_customer_message_at is distinct from old.last_customer_message_at and new.last_customer_message_at is not null then
   if exists(select 1 from public.crm_max_followups where lead_id=new.id and state in ('pending','queued') and new.last_customer_message_at>=anchor_at) then perform public.crm_max_cancel(new.id,'customer_replied'); end if;
  end if;
 end if;
 if new.status in ('Won','Lost') then perform public.crm_max_cancel(new.id,'lead_closed');
 end if;
 if not public.crm_max_nudge_eligible(new.id) then perform public.crm_max_cancel(new.id,'nudge_excluded'); end if;
 return new;
end; $function$
;
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
 if o.event not in ('lead.created','followup.due') then
  update public.crm_max_outbox set state='cancelled',last_error='unsupported_crm_webhook_event',locked_until=null,updated_at=now() where id=o.id;
  return null;
 end if;
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
COMMIT;
