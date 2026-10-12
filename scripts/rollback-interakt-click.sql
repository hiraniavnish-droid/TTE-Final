-- Leaves all retained relay messages intact. Repoint Interakt before use.
begin;
drop trigger if exists crm_max_click_delay on public.crm_max_outbox;
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
 if o.event='followup.due' then
  select * into f from public.crm_max_followups where id=o.followup_id;
  if f.state<>'queued' or not public.crm_max_nudge_eligible(l.id) or l.last_customer_message_at>=f.anchor_at then update public.crm_max_outbox set state='cancelled',last_error='followup_cancelled',updated_at=now() where id=o.id; return null; end if;
  if f.step<>1 and public.crm_max_allowed_time(now())>now() then update public.crm_max_outbox set state='pending',next_attempt_at=public.crm_max_allowed_time(now()),updated_at=now() where id=o.id; return null; end if;
  o.payload:=o.payload||jsonb_build_object('lead_id',l.id,'last_note',(select content from public.interactions where lead_id=l.id::text and type='Note' order by timestamp desc limit 1),'ref_id',l.lead_code,'anchor_at',f.anchor_at,'kind',case when f.step=1 then 'same_day_nudge' else 'followup' end,'requires_chat_review',f.step=1);
 else o.payload:=public.crm_max_payload(l); end if;
 return jsonb_build_object('target_url',s.target_url,'signing_secret',s.signing_secret,'body',jsonb_build_object('id',o.id,'event',o.event,'occurred_at',o.created_at,'data',o.payload));
end; $function$
;
commit;
