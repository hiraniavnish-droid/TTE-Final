do $$
declare lid uuid; form_lid uuid; job jsonb; old_lease uuid; oid uuid; lease uuid:=gen_random_uuid(); response jsonb; t timestamptz:=now(); n integer;
 body jsonb:='{"version":"1.0","type":"message_received","data":{"customer":{"channel_phone_number":"919800000001"},"message":{"id":"relay-qa-1","chat_message_type":"CustomerMessage","message":"Hi","message_content_type":"Text","media_url":null}}}';
begin
 -- All fixtures and queue operations roll back; no HTTP dispatch is performed.
 insert into public.leads(name,phone,status,temperature,source,destination,travel_date,pax,budget,trip_details,assigned_to) values('Relay rollback verification','+91 98000 00001','New','Warm','WhatsApp Click - rannutsavtickets.in','Rann Utsav','2026-11-15',2,0,'{}',null) returning id into lid;
 select id into oid from public.crm_max_outbox where lead_id=lid and event='lead.created';
 if (select next_attempt_at from public.crm_max_outbox where id=oid)<t+interval '5 minutes' then raise exception 'Click lead was not delayed'; end if;
 insert into public.leads(name,phone,status,temperature,source,destination,travel_date,pax,budget,trip_details,assigned_to) values('Form rollback verification','+919800000009','New','Warm','Website - rannutsavtickets.in','Rann Utsav','2026-11-15',2,0,'{}',null) returning id into form_lid;
 if (select next_attempt_at from public.crm_max_outbox where lead_id=form_lid and event='lead.created')>t+interval '1 second' then raise exception 'Website form was delayed'; end if;
 response:=public.crm_interakt_enqueue(body);
 if response->>'queued'<>'true' then raise exception 'Enqueue failed'; end if;
 response:=public.crm_interakt_enqueue(body);
 if response->>'duplicate'<>'true' then raise exception 'Dedupe failed'; end if;
 if (select count(*) from public.interactions where lead_id=lid::text and type='WhatsApp')<>1 then raise exception 'History missing or duplicated'; end if;
 if (select last_customer_message_at from public.leads where id=lid) is null then raise exception 'Inbound timestamp missing'; end if;
 perform public.crm_interakt_enqueue(jsonb_set(body,'{data,message,id}','"relay-qa-2"'));
 perform public.crm_interakt_enqueue(jsonb_set(body,'{data,message,id}','"relay-qa-3"'));
 if exists(select 1 from public.crm_interakt_claim(20)) then raise exception 'Claimed before debounce elapsed'; end if;
 update public.crm_interakt_relay set first_at=now()-interval '90 seconds',last_at=now()-interval '61 seconds' where phone='919800000001';
 select x into job from public.crm_interakt_claim(20) x where x->>'phone'='919800000001';
 if job is null or jsonb_array_length(job->'messages')<>3 or job#>>'{body,data,message,id}'<>'relay-qa-3' then raise exception 'Burst snapshot incorrect'; end if;
 old_lease:=(job->>'lease_token')::uuid;
 -- A new message during send must survive successful deletion of the old batch.
 perform public.crm_interakt_enqueue(jsonb_set(body,'{data,message,id}','"relay-qa-4"'));
 perform public.crm_interakt_finish('919800000001',old_lease,200,'');
 if (select jsonb_array_length(messages) from public.crm_interakt_relay where phone='919800000001')<>1 then raise exception 'In-flight arrival lost'; end if;
 update public.crm_interakt_relay set first_at=now()-interval '181 seconds',last_at=now() where phone='919800000001';
 select x into job from public.crm_interakt_claim(20) x where x->>'phone'='919800000001';
 if job is null then raise exception '180-second max wait failed'; end if;
 perform public.crm_interakt_enqueue(jsonb_set(body,'{data,message,id}','"relay-qa-5"'));
 perform public.crm_interakt_finish('919800000001',(job->>'lease_token')::uuid,503,'Test failure');
 if (select jsonb_array_length(messages) from public.crm_interakt_relay where phone='919800000001')<>2 then raise exception 'Failed batch not restored'; end if;
 -- A stale acknowledgement cannot consume the restored queue.
 perform public.crm_interakt_finish('919800000001',old_lease,200,'');
 if (select jsonb_array_length(messages) from public.crm_interakt_relay where phone='919800000001')<>2 then raise exception 'Stale lease accepted'; end if;
 update public.crm_interakt_relay set attempts=9,next_attempt_at=now()-interval '1 second',last_at=now()-interval '61 seconds' where phone='919800000001';
 select x into job from public.crm_interakt_claim(20) x where x->>'phone'='919800000001';
 perform public.crm_interakt_finish('919800000001',(job->>'lease_token')::uuid,503,'Test exhausted');
 if exists(select 1 from public.crm_interakt_claim(20)) then raise exception 'Retry cap ignored'; end if;
 if (select attempts from public.crm_interakt_relay where phone='919800000001')<>10 then raise exception 'Failed row was not retained'; end if;
 -- Exercise preflight on this fixture only, without claiming real outbox rows.
 update public.crm_max_settings set enabled=true where id;
 update public.crm_max_outbox set state='processing',lease_token=lease where id=oid;
 response:=public.crm_max_preflight(oid,lease);
 if response is not null or (select last_error from public.crm_max_outbox where id=oid)<>'customer_already_messaged' then raise exception 'Inbound click was not cancelled'; end if;
 -- Same phone, newly created click lead also sees the previous relay inbound.
 insert into public.leads(name,phone,status,temperature,source,destination,travel_date,pax,budget,trip_details,assigned_to) values('Repeat relay rollback','9800000001','New','Warm','WhatsApp Click - soubooking.in','Statue of Unity','2026-11-15',2,0,'{}',null) returning id into lid;
 select id into oid from public.crm_max_outbox where lead_id=lid and event='lead.created';
 update public.crm_max_outbox set state='processing',lease_token=lease where id=oid;
 if public.crm_max_preflight(oid,lease) is not null then raise exception 'Phone-level inbound was ignored'; end if;
 -- A click with no chat still dispatches; outbound alone suppresses its next introduction.
 insert into public.leads(name,phone,status,temperature,source,destination,travel_date,pax,budget,trip_details,assigned_to) values('No-chat relay rollback','9800000008','New','Warm','  WhatsApp Click - rannutsav.in','Rann Utsav','2026-11-15',2,0,'{}',null) returning id into lid;
 select id into oid from public.crm_max_outbox where lead_id=lid and event='lead.created';
 update public.crm_max_outbox set state='processing',lease_token=lease where id=oid;
 if public.crm_max_preflight(oid,lease) is null then raise exception 'Click without chat was suppressed'; end if;
 update public.leads set last_bot_message_at=now() where id=lid;
 if public.crm_max_preflight(oid,lease) is not null then raise exception 'Outbound click was not cancelled'; end if;
 insert into public.crm_max_outbox(lead_id,event,payload) values(lid,'lead.assigned_to_admin','{}') returning id into oid;
 if (select next_attempt_at from public.crm_max_outbox where id=oid)<t+interval '5 minutes' then raise exception 'Assignment click not delayed'; end if;
 update public.crm_max_outbox set state='processing',lease_token=lease where id=oid;
 if public.crm_max_preflight(oid,lease) is not null then raise exception 'Assignment click outbound not cancelled'; end if;
 -- Ordinary website source remains eligible after inbound/outbound timestamps.
 update public.leads set last_customer_message_at=now(),last_bot_message_at=now() where id=form_lid;
 select id into oid from public.crm_max_outbox where lead_id=form_lid and event='lead.created';
 update public.crm_max_outbox set state='processing',lease_token=lease where id=oid;
 if public.crm_max_preflight(oid,lease) is null then raise exception 'Website event changed'; end if;
end; $$;
select 'PASS: delay, website unchanged, dedupe, history, timestamps, debounce, max wait, in-flight arrivals, retry restoration/cap, stale lease and inbound cancellation' as result;
