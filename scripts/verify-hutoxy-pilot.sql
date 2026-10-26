-- Run after the additive migration, inside the SAME transaction, then ROLLBACK.
-- No worker or receiver is called. Synthetic leads are never committed.
do $$
declare own uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid();other_phone uuid:=gen_random_uuid();nonrann uuid:=gen_random_uuid();
 response jsonb; claim public.crm_hutoxy_outbox%rowtype; n integer; before_max jsonb;
begin
 select to_jsonb(s) into before_max from public.crm_max_settings s;
 if has_table_privilege('anon','public.crm_hutoxy_settings','SELECT') or has_table_privilege('authenticated','public.crm_hutoxy_outbox','SELECT') or has_function_privilege('anon','public.crm_hutoxy_api(text,text,jsonb)','EXECUTE') then raise exception 'Pilot privilege leak';end if;
 if has_function_privilege('authenticated','public.crm_hutoxy_lead_changed()','EXECUTE') then raise exception 'Public trigger function privilege';end if;
 insert into public.leads(id,name,phone,assigned_to,destination,source,status,trip_details)
 values(own,'Hutoxy rollback test','+91 96010 70220','Hutoxy Pilot','Rann Utsav','Manual - rannutsavtickets.in','New','{"destination":"Rann Utsav","paxConfig":{"adults":2,"children":0,"childAges":[]}}'),
 (outsider,'Hutoxy excluded owner','9601070220','2','Rann Utsav','Manual - rannutsavtickets.in','New','{}'),
 (other_phone,'Hutoxy excluded phone','9000000000','3','Rann Utsav','Manual - rannutsavtickets.in','New','{}'),
 (nonrann,'Hutoxy excluded destination','9601070220','3','Goa','Manual - rannutsavtickets.in','New','{}');
 if exists(select 1 from public.crm_hutoxy_outbox) then raise exception 'Paused route queued events';end if;
 response:=public.crm_hutoxy_api('lead',own::text);
 if response->>'owner'<>'3' or response->>'owner_name'<>'Hutoxy Pilot' or response?'vendors' or response?'commercials' then raise exception 'Scoped lead serialization failed';end if;
 if public.crm_hutoxy_api('lead',outsider::text)->>'error'<>'lead_not_in_pilot' then raise exception 'Other owner leaked';end if;
 if public.crm_hutoxy_api('lead',other_phone::text)->>'error'<>'lead_not_in_pilot' then raise exception 'Other phone leaked';end if;
 if public.crm_hutoxy_api('lead',nonrann::text)->>'error'<>'lead_not_in_pilot' then raise exception 'Other destination leaked';end if;
 response:=public.crm_hutoxy_api('leads');
 if not exists(select 1 from jsonb_array_elements(response->'data') v where v->>'id'=own::text) then raise exception 'Pilot lead not listed';end if;
 if exists(select 1 from jsonb_array_elements(response->'data') v where v->>'id' in(outsider::text,other_phone::text,nonrann::text)) then raise exception 'Unscoped lead listed';end if;
 perform public.crm_hutoxy_api('settings_write',null,'{"target_url":"https://example.com/hutoxy","enabled":true}');
 update public.leads set assigned_to='3' where id=own;
 if exists(select 1 from public.crm_hutoxy_outbox where lead_id=own) then raise exception 'Equivalent owner change queued duplicate assignment';end if;
 update public.leads set assigned_to='2' where id=own;
 update public.leads set assigned_to='Hutoxy Pilot' where id=own;
 select count(*) into n from public.crm_hutoxy_outbox where lead_id=own and event='lead.assigned' and state='pending';
 if n<>1 then raise exception 'Assignment event missing';end if;
 insert into public.interactions(id,lead_id,type,content) values('hutoxy_test_in_'||own,own::text,'WhatsApp','{"direction":"in","text":"Test inbound","actor":"Interakt"}');
 insert into public.interactions(id,lead_id,type,content) values('hutoxy_test_out_'||own,own::text,'WhatsApp','{"direction":"out","text":"Do not relay","actor":"Agent"}');
 insert into public.interactions(id,lead_id,type,content) values('hutoxy_test_note_'||own,own::text,'WhatsApp','Plain legacy status text');
 select count(*) into n from public.crm_hutoxy_outbox where lead_id=own and event='customer.message';if n<>1 then raise exception 'Inbound relay direction filtering failed';end if;
 response:=public.crm_hutoxy_api('messages',own::text,'{"limit":1}');if jsonb_array_length(response->'data')<>1 or response->'next_cursor'='null'::jsonb then raise exception 'Message pagination failed';end if;
 response:=public.crm_hutoxy_api('record_message',own::text,jsonb_build_object('idempotency_id',repeat('a',64),'request_hash',repeat('b',64),'body',jsonb_build_object('direction','out','text','Recorded, not sent')));
 if response->>'recorded'<>'true' or response->>'sent'<>'false' then raise exception 'Message logging failed';end if;
 if public.crm_hutoxy_api('record_message',own::text,jsonb_build_object('idempotency_id',repeat('a',64),'request_hash',repeat('b',64),'body',jsonb_build_object('direction','out','text','Recorded, not sent')))<>response then raise exception 'Idempotency replay failed';end if;
 if public.crm_hutoxy_api('record_message',own::text,jsonb_build_object('idempotency_id',repeat('a',64),'request_hash',repeat('c',64),'body','{}'::jsonb))->>'error'<>'idempotency_conflict' then raise exception 'Idempotency conflict missing';end if;
 select * into claim from public.crm_hutoxy_claim(1);
 if public.crm_hutoxy_preflight(claim.id,claim.lease_token) is null then raise exception 'Eligible event failed preflight';end if;
 perform public.crm_hutoxy_finish(claim.id,claim.lease_token,503,'Receiver failed');
 if not exists(select 1 from public.crm_hutoxy_outbox where id=claim.id and state='pending' and attempts=1 and next_attempt_at>now()) then raise exception 'Retry scheduling failed';end if;
 select * into claim from public.crm_hutoxy_claim(1);
 if claim.id is not null then
  update public.leads set assigned_to='2' where id=own;
  if public.crm_hutoxy_preflight(claim.id,claim.lease_token) is not null then raise exception 'Reassigned lead still delivered';end if;
 end if;
 perform public.crm_hutoxy_api('settings_write',null,'{"enabled":false}');
 if exists(select 1 from public.crm_hutoxy_outbox where state in('pending','processing')) then raise exception 'Pause did not cancel events';end if;
 if (select to_jsonb(s) from public.crm_max_settings s)<>before_max then raise exception 'MAX settings changed';end if;
end$$;
select 'Hutoxy owner isolation, test-phone gate, Rann gate, messages, idempotency, retries and pause checks passed' as verification;
