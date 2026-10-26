begin;
-- Recipient testing and rollout decisions belong to the external bot.
-- The CRM enforces only the Hutoxy employee identity and Rann destination.
create or replace function public.crm_hutoxy_eligible(l public.leads) returns boolean
language sql stable set search_path=public,pg_temp as $$
 select coalesce(exists(select 1 from public.crm_hutoxy_settings s
 where public.crm_team_owner_user_id(l.assigned_to)=s.owner_id
 and public.crm_jigar_rann_destination(coalesce(nullif(l.trip_details->>'destination',''),l.destination))),false);
$$;
alter table public.crm_hutoxy_settings alter column test_only set default false;
update public.crm_hutoxy_settings set test_only=false where id;
comment on column public.crm_hutoxy_settings.test_only is 'Deprecated compatibility field. Not used in CRM access or delivery decisions.';
comment on column public.crm_hutoxy_settings.test_phone is 'Deprecated compatibility field. Recipient filtering is managed by the external bot.';
notify pgrst,'reload schema';
commit;
