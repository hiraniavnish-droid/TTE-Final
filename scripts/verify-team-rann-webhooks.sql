-- Execute with the migration inside BEGIN, then ROLLBACK. Makes no HTTP calls.
do $$
declare who text; owner_id text; l uuid; q record; payload jsonb; lease uuid; n integer; ev text; delay interval;
begin
 if crm_team_rann_source_website('Website - rannutsav.in') is distinct from 'rannutsav.in'
 or crm_team_rann_source_website('WhatsApp Click - rannutsavtickets.in') is distinct from 'rannutsavtickets.in'
 or crm_team_rann_source_website('Email - https://www.rannutsav.in/contact') is distinct from 'rannutsav.in'
 or crm_team_rann_source_website('Website - soubooking.in') is not null
 or crm_team_rann_source_website('Website - Rann Utsav') is not null
 or crm_team_rann_source_website('rannutsav.in.evil.example') is not null
 or crm_team_rann_source_website('https://rannutsav.in@evil.example') is not null
 or crm_team_rann_source_website('Manual') is not null then raise exception 'Website attribution failed';end if;
 foreach who in array array['sonali','jigar','prakash'] loop
  execute format('select owner_id from crm_%s_webhook_settings',who) into owner_id;
  execute format('select crm_%s_webhook_settings_write($1)',who) using '{"enabled":false}'::jsonb;
  if who<>'sonali' then
   execute format('select count(*) from crm_%s_webhook_settings where enabled or target_url is not null',who) into n;
   if n<>0 then raise exception 'New route must start paused and blank'; end if;
  end if;
  execute format('select crm_%s_webhook_settings_write($1)',who) using '{"target_url":"https://example.com/receiver","enabled":true,"authorization":"Bearer test-only"}'::jsonb;
  insert into leads(name,status,assigned_to,trip_details,source) values('INTERNAL ROLLBACK TEST','New',owner_id,'{"destination":"Rann Utsav"}','Website - soubooking.in') returning id into l;
  execute format('select count(*) from crm_%s_webhook_outbox where lead_id=$1',who) into n using l;
  if n<>0 then raise exception 'Wrong website queued for %',who;end if;
  insert into leads(name,status,assigned_to,trip_details,source) values('INTERNAL ROLLBACK TEST','New',owner_id,'{"destination":"Rann Tent Resort"}','Form - rannutsav.in') returning id into l;
  execute format('select * from crm_%s_webhook_outbox where lead_id=$1',who) into q using l;
  if q.event is distinct from 'lead.created' or q.next_attempt_at>now() then raise exception 'Form was delayed'; end if;
  execute format('select * from crm_%s_webhook_claim(20) where lead_id=$1',who) into q using l;
  execute format('select crm_%s_webhook_preflight($1,$2)',who) into payload using q.id,q.lease_token;
  if payload#>>'{body,data,source_website}' is distinct from 'rannutsav.in' or payload#>>'{body,data,owner}' is distinct from owner_id or payload->>'authorization' is distinct from 'Bearer test-only' then raise exception 'Payload/authorization failed for %',who;end if;
  execute format('select crm_%s_webhook_finish($1,$2,503,$3)',who) using q.id,q.lease_token,'retry test';
  execute format('select count(*) from crm_%s_webhook_outbox where id=$1 and state=''pending'' and next_attempt_at>=now()+interval ''60 seconds''',who) into n using q.id;
  if n<>1 then raise exception 'Retry failed';end if;
  update leads set source='Website - soubooking.in' where id=l;
  execute format('select count(*) from crm_%s_webhook_outbox where id=$1 and state=''cancelled''',who) into n using q.id;
  if n<>1 then raise exception 'Source cancellation failed';end if;
  insert into leads(name,status,assigned_to,trip_details,source) values('INTERNAL ROLLBACK TEST','New','admin','{"destination":"Namak"}','WhatsApp Click - rannutsavtickets.in') returning id into l;
  update leads set assigned_to=owner_id where id=l;
  execute format('select * from crm_%s_webhook_outbox where lead_id=$1 and state=''pending''',who) into q using l;
  if q.event is distinct from 'lead.assigned' or q.next_attempt_at<now()+interval '5 minutes' then raise exception 'WhatsApp assignment hold failed';end if;
  update leads set name='INTERNAL UPDATED TEST' where id=l;
  execute format('select count(*) from crm_%s_webhook_outbox where lead_id=$1',who) into n using l;
  if n<>1 then raise exception 'Duplicate update event';end if;
  execute format('select count(*) from crm_%s_webhook_claim(20) where lead_id=$1',who) into n using l;
  if n<>0 then raise exception 'Claimed held WhatsApp event';end if;
  update leads set last_customer_message_at=now() where id=l;
  lease:=gen_random_uuid();
  execute format('update crm_%s_webhook_outbox set state=''processing'',lease_token=$1,locked_until=now()+interval ''2 minutes'' where id=$2',who) using lease,q.id;
  execute format('select crm_%s_webhook_preflight($1,$2)',who) into payload using q.id,lease;
  if payload is not null then raise exception 'Already-messaged intro sent';end if;
  update leads set assigned_to='admin' where id=l;
  update leads set assigned_to=owner_id,source='Manual - rannutsav.in',last_customer_message_at=null where id=l;
  execute format('select * from crm_%s_webhook_outbox where lead_id=$1 and state=''pending''',who) into q using l;
  if q.next_attempt_at>now() then raise exception 'Manual lead delayed';end if;
  update leads set assigned_to='admin' where id=l;
  execute format('select count(*) from crm_%s_webhook_outbox where id=$1 and state=''cancelled''',who) into n using q.id;
  if n<>1 then raise exception 'Ownership cancellation failed';end if;
  if has_table_privilege('anon','crm_'||who||'_webhook_settings','select') or has_function_privilege('authenticated','crm_'||who||'_webhook_preflight(uuid,uuid)','execute') then raise exception 'Private permissions failed';end if;
 end loop;
end;$$;
select 'All three website gates, queues, owner checks, signatures, delays and retries passed' as result;
