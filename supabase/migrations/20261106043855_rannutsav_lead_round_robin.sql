alter table public.app_settings
  add column rannutsav_round_robin_enabled boolean not null default false,
  add column rannutsav_round_robin_employee_ids text[] not null default '{}',
  add column rannutsav_round_robin_last_employee_id text;

-- Website routing is edited from the admin-only Team Settings page.
create policy admin_update_website_lead_routing on public.app_settings
  as restrictive for update to authenticated
  using ((select auth.jwt()->>'app_role') = 'admin')
  with check ((select auth.jwt()->>'app_role') = 'admin');

create function public.assign_rannutsav_website_lead()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  settings public.app_settings%rowtype;
  routing jsonb;
  next_employee_id text;
  next_employee_name text;
begin
  -- The website intake writes with the service role. Manual CRM inserts
  -- retain the employee chosen by the person creating the lead.
  if current_user <> 'service_role' then
    return new;
  end if;

  -- Lock only when round robin is enabled. The turn and lead insert commit
  -- together, so concurrent arrivals serialize and failed inserts cost no turn.
  select * into settings from public.app_settings
  where id = true and rannutsav_round_robin_enabled
  for update;

  if not found then
    return new;
  end if;

  -- Honour the existing per-site pause, including legacy settings rows.
  if settings.auto_assign_to is json object then
    routing := settings.auto_assign_to::jsonb;
  end if;

  if not coalesce(
    case when routing->>'kind' = 'lead-routing-v1' then
      case routing #> '{routes,rannutsav_website,enabled}'
        when 'true'::jsonb then true when 'false'::jsonb then false
        else case routing #> '{fallback,enabled}'
          when 'true'::jsonb then true when 'false'::jsonb then false
        end
      end
    end,
    settings.auto_assign_enabled
  ) then
    new.assigned_to := null;
    return new;
  end if;

  select employee.id, employee.name into next_employee_id, next_employee_name
  from (
    select id, min(position) as position
    from unnest(settings.rannutsav_round_robin_employee_ids) with ordinality as selected(id, position)
    group by id
  ) as roster
  join public.users as employee on employee.id = roster.id and employee.role = 'agent'
  order by roster.position <= coalesce(
    array_position(settings.rannutsav_round_robin_employee_ids, settings.rannutsav_round_robin_last_employee_id), 0
  ), roster.position
  limit 1;

  -- An empty or obsolete roster leaves the lead in the unassigned queue.
  new.assigned_to := next_employee_name;
  if next_employee_id is not null then
    update public.app_settings
    set rannutsav_round_robin_last_employee_id = next_employee_id
    where id = true;
  end if;

  return new;
end;
$$;

revoke execute on function public.assign_rannutsav_website_lead() from public, anon, authenticated;

create trigger assign_rannutsav_website_lead
before insert on public.leads
for each row
when (
  new.tags @> array['rannutsav.in']::text[]
  and new.source in (
    'Website - rannutsav.in', 'WhatsApp Click - rannutsav.in',
    'WhatsApp Bot - rannutsav.in', 'Email - rannutsav.in'
  )
)
execute function public.assign_rannutsav_website_lead();
