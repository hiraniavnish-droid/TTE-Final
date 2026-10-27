do $$
declare owned uuid:=gen_random_uuid(); other uuid:=gen_random_uuid(); wrong_destination uuid:=gen_random_uuid(); result jsonb; repeated jsonb; snapshot_max jsonb; snapshot_settings jsonb; patch jsonb;
begin
 select to_jsonb(s) into snapshot_max from public.crm_max_settings s;
 select to_jsonb(s) into snapshot_settings from public.crm_hutoxy_settings s;
 if has_function_privilege('anon','public.crm_hutoxy_update_lead(text,jsonb,text,text,text)','EXECUTE') or has_function_privilege('authenticated','public.crm_hutoxy_update_lead(text,jsonb,text,text,text)','EXECUTE') or has_table_privilege('authenticated','public.crm_hutoxy_lead_control','UPDATE') then raise exception 'Privilege leak';end if;
 insert into public.leads(id,name,assigned_to,destination,status,trip_details) values
 (owned,'Hutoxy update rollback test','3','Rann Utsav','New','{"destination":"Rann Utsav","budget":12345,"paxConfig":{"adults":2,"children":0,"childAges":[]}}'),
 (other,'Hutoxy other owner rollback test','2','Rann Utsav','New','{}'),
 (wrong_destination,'Hutoxy other destination rollback test','3','Goa','New','{}');
 patch:='{"check_in":"2027-01-12","nights":4,"adults":9,"child_ages":[4,8],"tent_category":"Non-AC Swiss Cottage","tent_count":3,"status":"Discussion","temperature":"Hot","note":"Client confirmed enquiry details","next_follow_up_at":"2026-10-28T12:00:00+05:30","human_takeover":true,"bot_paused":true}';
 result:=public.crm_hutoxy_update_lead(owned::text,patch,'hutoxy-update-rollback-test',repeat('e',64),repeat('f',64));
 if result->>'status'<>'Discussion' or result#>>'{trip,paxConfig,children}'<>'2' or result#>>'{trip,rooms}'<>'3' or result#>>'{trip,budget}'<>'12345' or result#>>'{automation,human_takeover}'<>'true' then raise exception 'Update failed';end if;
 if not exists(select 1 from public.leads where id=owned and travel_date='2027-01-12' and pax=11) then raise exception 'Legacy fields not synced';end if;
 if not exists(select 1 from public.reminders where id='hutoxy_followup_'||owned and not is_completed) then raise exception 'Reminder missing';end if;
 if not exists(select 1 from public.crm_api_audit where request_id='hutoxy-update-rollback-test' and before_value->>'status'='New' and after_value->>'status'='Discussion') then raise exception 'Audit missing';end if;
 repeated:=public.crm_hutoxy_update_lead(owned::text,patch,'repeat',repeat('e',64),repeat('f',64));
 if repeated<>result or (select count(*) from public.interactions where lead_id=owned::text)<>1 then raise exception 'Replay duplicated mutation';end if;
 if public.crm_hutoxy_update_lead(owned::text,patch,'conflict',repeat('e',64),repeat('a',64))->>'error'<>'idempotency_conflict' then raise exception 'Conflict missing';end if;
 if public.crm_hutoxy_update_lead(owned::text,'{"temperature":"Cold","expected_updated_at":"2000-01-01T00:00:00Z"}','stale',repeat('b',64),repeat('c',64))->>'error'<>'lead_changed' then raise exception 'Stale edit allowed';end if;
 if public.crm_hutoxy_update_lead(other::text,patch,'other',repeat('1',64),repeat('2',64))->>'error'<>'lead_not_in_pilot' or public.crm_hutoxy_update_lead(wrong_destination::text,patch,'goa',repeat('3',64),repeat('4',64))->>'error'<>'lead_not_in_pilot' then raise exception 'Scope escaped';end if;
 begin
  perform public.crm_hutoxy_update_lead(owned::text,'{"assigned_to":"2"}','forbidden',repeat('5',64),repeat('6',64));raise exception 'Forbidden field accepted';
 exception when raise_exception then if sqlerrm='Forbidden field accepted' then raise;end if;end;
 perform public.crm_hutoxy_update_lead(owned::text,'{"next_follow_up_at":null,"human_takeover":false,"bot_paused":false}','clear',repeat('7',64),repeat('8',64));
 if exists(select 1 from public.reminders where id='hutoxy_followup_'||owned) then raise exception 'Reminder clear failed';end if;
 update public.leads set assigned_to='2' where id=owned;
 if public.crm_hutoxy_update_lead(owned::text,patch,'reassigned',repeat('e',64),repeat('f',64))->>'error'<>'lead_not_in_pilot' then raise exception 'Reassigned replay allowed';end if;
 if (select to_jsonb(s) from public.crm_max_settings s)<>snapshot_max or (select to_jsonb(s) from public.crm_hutoxy_settings s)<>snapshot_settings then raise exception 'Global automation settings changed';end if;
end$$;
select 'Owner isolation, atomic audit, trip merge, reminders, replay, stale edits, takeover flags and reassignment checks passed' as verification;
