-- Run inside a transaction ending ROLLBACK. No HTTP calls are made.
do $$
declare lid uuid; oid uuid; token uuid:=gen_random_uuid(); result jsonb;
begin
 update public.crm_max_settings set enabled=true where id;
 insert into public.leads(name,phone,status,temperature,source,destination,travel_date,pax,budget,trip_details,assigned_to)
 values('MAX route rollback verification','9800000099','New','Warm','Website - rannutsavtickets.in','Rann Utsav','2026-11-15',2,0,'{}',null) returning id into lid;
 select id into oid from public.crm_max_outbox where lead_id=lid and event='lead.created';
 if oid is null then raise exception 'New lead event missing'; end if;
 update public.crm_max_outbox set state='processing',lease_token=token where id=oid;
 result:=public.crm_max_preflight(oid,token);
 if result is null or result->'body'->>'event'<>'lead.created' then raise exception 'New lead event was blocked'; end if;
 update public.leads set assigned_to='Sonali' where id=lid;
 update public.leads set assigned_to=null where id=lid;
 if exists(select 1 from public.crm_max_outbox where lead_id=lid and event='lead.assigned_to_admin') then raise exception 'Assignment event still emitted'; end if;
 insert into public.crm_max_outbox(lead_id,event,payload) values(lid,'lead.assigned_to_admin','{}') returning id into oid;
 update public.crm_max_outbox set state='processing',lease_token=token where id=oid;
 result:=public.crm_max_preflight(oid,token);
 if result is not null or (select last_error from public.crm_max_outbox where id=oid)<>'unsupported_crm_webhook_event' then raise exception 'Unsupported event reached sender'; end if;
end; $$;
select 'PASS: lead.created remains eligible, assignment changes emit no webhook, unsupported queued events are cancelled' as result;
