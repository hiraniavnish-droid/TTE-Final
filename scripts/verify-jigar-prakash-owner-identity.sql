-- Use inside a transaction ending ROLLBACK. Never dispatch these fixtures.
do $$
declare l uuid;q record;lease uuid:=gen_random_uuid();body jsonb;n integer; sid text;
begin
 select owner_id into sid from crm_jigar_webhook_settings where id;
 if crm_team_owner_user_id('Jigar') is distinct from sid or crm_team_owner_user_id(' JIGAR ') is distinct from sid or crm_team_owner_user_id(sid) is distinct from sid or crm_team_owner_user_id('unknown-test-owner') is not null then raise exception 'Identity mapping failed';end if;
 insert into leads(name,status,assigned_to,source,trip_details) values('INTERNAL ROLLBACK OWNER TEST','New','Jigar','Website - rannutsav.in','{"destination":"Rann Utsav Packages"}') returning id into l;
 select * into q from crm_jigar_webhook_outbox where lead_id=l;
 if q.event is distinct from 'lead.created' or q.expected_owner is distinct from sid then raise exception 'Name-owned creation was excluded';end if;
 update crm_jigar_webhook_outbox set state='processing',lease_token=lease,locked_until=now()+interval '2 minutes' where id=q.id;
 body:=crm_jigar_webhook_preflight(q.id,lease);
 if body#>>'{body,data,owner}' is distinct from sid or body#>>'{body,data,owner_name}' is distinct from 'Jigar' or body#>>'{body,data,source_website}' is distinct from 'rannutsav.in' then raise exception 'Name-owned preflight/payload failed';end if;
 update leads set assigned_to=sid where id=l;
 if (select count(*) from crm_jigar_webhook_outbox where lead_id=l)<>1 or (select state from crm_jigar_webhook_outbox where id=q.id)<>'processing' then raise exception 'Name-to-ID compatibility created/cancelled an event';end if;
 update leads set assigned_to='unknown-test-owner' where id=l;
 if (select state from crm_jigar_webhook_outbox where id=q.id)<>'cancelled' then raise exception 'Ownership change did not cancel';end if;
 update leads set assigned_to='Jigar',source='WhatsApp Click - rannutsavtickets.in' where id=l;
 select * into q from crm_jigar_webhook_outbox where lead_id=l and state='pending';
 if q.event is distinct from 'lead.assigned' or q.next_attempt_at<now()+interval '5 minutes' then raise exception 'Name assignment/WhatsApp hold failed';end if;
 update leads set assigned_to='admin' where id=l;
 update leads set assigned_to='Jigar',source='Website - soubooking.in' where id=l;
 if exists(select 1 from crm_jigar_webhook_outbox where lead_id=l and state='pending') then raise exception 'Source restriction bypassed';end if;
 insert into leads(name,status,assigned_to,source,trip_details) values('INTERNAL ROLLBACK OWNER TEST','New',sid,'Website - rannutsavtickets.in','{"destination":"Statue of Unity"}') returning id into l;
 if exists(select 1 from crm_jigar_webhook_outbox where lead_id=l) then raise exception 'Destination restriction bypassed';end if;
 if has_function_privilege('anon','crm_team_owner_user_id(text)','execute') then raise exception 'Resolver exposed publicly';end if;
end;$$;
select 'Jigar name/ID compatibility, payload, transitions, source/destination gates and WhatsApp hold passed' as result;

-- Use inside a transaction ending ROLLBACK. Never dispatch these fixtures.
do $$
declare l uuid;q record;lease uuid:=gen_random_uuid();body jsonb;n integer; sid text;
begin
 select owner_id into sid from crm_prakash_webhook_settings where id;
 if crm_team_owner_user_id('Prakash') is distinct from sid or crm_team_owner_user_id(' PRAKASH ') is distinct from sid or crm_team_owner_user_id(sid) is distinct from sid or crm_team_owner_user_id('unknown-test-owner') is not null then raise exception 'Identity mapping failed';end if;
 insert into leads(name,status,assigned_to,source,trip_details) values('INTERNAL ROLLBACK OWNER TEST','New','Prakash','Website - rannutsav.in','{"destination":"Rann Utsav Packages"}') returning id into l;
 select * into q from crm_prakash_webhook_outbox where lead_id=l;
 if q.event is distinct from 'lead.created' or q.expected_owner is distinct from sid then raise exception 'Name-owned creation was excluded';end if;
 update crm_prakash_webhook_outbox set state='processing',lease_token=lease,locked_until=now()+interval '2 minutes' where id=q.id;
 body:=crm_prakash_webhook_preflight(q.id,lease);
 if body#>>'{body,data,owner}' is distinct from sid or body#>>'{body,data,owner_name}' is distinct from 'Prakash' or body#>>'{body,data,source_website}' is distinct from 'rannutsav.in' then raise exception 'Name-owned preflight/payload failed';end if;
 update leads set assigned_to=sid where id=l;
 if (select count(*) from crm_prakash_webhook_outbox where lead_id=l)<>1 or (select state from crm_prakash_webhook_outbox where id=q.id)<>'processing' then raise exception 'Name-to-ID compatibility created/cancelled an event';end if;
 update leads set assigned_to='unknown-test-owner' where id=l;
 if (select state from crm_prakash_webhook_outbox where id=q.id)<>'cancelled' then raise exception 'Ownership change did not cancel';end if;
 update leads set assigned_to='Prakash',source='WhatsApp Click - rannutsavtickets.in' where id=l;
 select * into q from crm_prakash_webhook_outbox where lead_id=l and state='pending';
 if q.event is distinct from 'lead.assigned' or q.next_attempt_at<now()+interval '5 minutes' then raise exception 'Name assignment/WhatsApp hold failed';end if;
 update leads set assigned_to='admin' where id=l;
 update leads set assigned_to='Prakash',source='Website - soubooking.in' where id=l;
 if exists(select 1 from crm_prakash_webhook_outbox where lead_id=l and state='pending') then raise exception 'Source restriction bypassed';end if;
 insert into leads(name,status,assigned_to,source,trip_details) values('INTERNAL ROLLBACK OWNER TEST','New',sid,'Website - rannutsavtickets.in','{"destination":"Statue of Unity"}') returning id into l;
 if exists(select 1 from crm_prakash_webhook_outbox where lead_id=l) then raise exception 'Destination restriction bypassed';end if;
 if has_function_privilege('anon','crm_team_owner_user_id(text)','execute') then raise exception 'Resolver exposed publicly';end if;
end;$$;
select 'Prakash name/ID compatibility, payload, transitions, source/destination gates and WhatsApp hold passed' as result;
