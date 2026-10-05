-- Allow a new day to start even when a prior checkout is awaiting correction.
-- The prior record remains visible and can still be corrected through the normal
-- approval workflow.
begin;
create or replace function public.crm_attendance_command(p_actor text,p_version integer,p_action text,p_data jsonb default '{}')
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
<<operation>>
declare
 actor public.users%rowtype; target text; policy jsonb; before_row jsonb; result jsonb;
 rec public.crm_attendance_days%rowtype; req public.crm_attendance_requests%rowtype;
 today date := (statement_timestamp() at time zone 'Asia/Kolkata')::date;
 stamp timestamptz := statement_timestamp(); first_day date; last_day date; d date;
 ci timestamptz; co timestamptz; units numeric; used numeric; quota numeric;
 workdates jsonb := '[]'; typ text; portion text; reason text; state text;
 yr integer; month_start date; month_end date; v record;
begin
 select * into actor from public.users where id=p_actor;
 if not found or actor.role not in ('admin','agent') or actor.session_version is distinct from p_version then
   raise exception 'Session expired. Sign in again.' using errcode='28000';
 end if;
 if p_action <> 'snapshot' then perform pg_advisory_xact_lock(730128412); end if;
 select settings into policy from public.crm_attendance_policy where id;
 target := case when actor.role='admin' then coalesce(nullif(p_data->>'userId',''),p_actor) else p_actor end;
 if not exists(select 1 from public.users where id=target) then raise exception 'Employee not found.'; end if;

 if p_action='snapshot' then
   month_start:=coalesce(nullif(p_data->>'month',''),to_char(today,'YYYY-MM'))||'-01';
   if month_start < date '2020-01-01' or month_start > date '2100-12-01' then raise exception 'Invalid month.'; end if;
   month_end:=(month_start+interval '1 month')::date;
   yr:=extract(year from month_start);
   return jsonb_build_object('serverTime',stamp,'today',today,'viewer',jsonb_build_object('id',actor.id,'name',actor.name,'role',actor.role),
    'policy',policy,'startedOn',(select (min(created_at) at time zone 'Asia/Kolkata')::date from public.crm_attendance_policy),
    'users',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'role',role) order by name),'[]') from public.users where actor.role='admin' or id=p_actor),
    'records',(select coalesce(jsonb_agg(to_jsonb(a) order by day),'[]') from public.crm_attendance_days a where (actor.role='admin' or user_id=p_actor) and ((day>=month_start and day<month_end) or date_trunc('month',day)=date_trunc('month',today) or (clock_in is not null and clock_out is null))),
    'requests',(select coalesce(jsonb_agg(to_jsonb(r) order by created_at desc),'[]') from public.crm_attendance_requests r where (actor.role='admin' or user_id=p_actor) and (extract(year from start_date)=yr or status='pending' or today between start_date and end_date)),
    'entitlements',(select coalesce(jsonb_agg(to_jsonb(e)),'[]') from public.crm_attendance_entitlements e where year=yr and (actor.role='admin' or user_id=p_actor)),
    'audit',case when actor.role='admin' then (select coalesce(jsonb_agg(to_jsonb(a)),'[]') from (select * from public.crm_attendance_audit order by id desc limit 100) a) else '[]'::jsonb end);
 end if;

 if p_action in ('clock_in','clock_out') then
   target:=p_actor;
   if p_action='clock_in' then
     -- A forgotten checkout is reviewed separately; it must never prevent an
     -- employee from recording today's attendance.
     if exists(select 1 from public.crm_attendance_requests r where user_id=target and kind='leave' and r.portion='full' and status='approved' and dates ? today::text) then raise exception 'You have approved leave today. Ask Admin to cancel it before checking in.'; end if;
     select * into rec from public.crm_attendance_days where user_id=target and day=today;
     if found then
       if rec.clock_in is not null then return to_jsonb(rec); end if;
       raise exception 'Admin has already recorded today. Request a correction.';
     end if;
     insert into public.crm_attendance_days(user_id,day,clock_in,policy) values(target,today,stamp,policy) returning * into rec;
   else
     select * into rec from public.crm_attendance_days where user_id=target and day=today;
     if not found or rec.clock_in is null then raise exception 'Check in before checking out.'; end if;
     if rec.clock_out is not null then return to_jsonb(rec); end if;
     before_row:=to_jsonb(rec);
     update public.crm_attendance_days set clock_out=stamp,updated_at=stamp where id=rec.id returning * into rec;
   end if;
   result:=to_jsonb(rec);

 elsif p_action='request' then
   target:=p_actor;
   typ:=p_data->>'kind'; portion:=coalesce(p_data->>'portion','full');
   first_day:=(p_data->>'startDate')::date; last_day:=(p_data->>'endDate')::date;
   reason:=trim(coalesce(p_data->>'reason',''));
   if typ is null or typ not in ('leave','correction','outdoor') or first_day is null or last_day is null or last_day<first_day or extract(year from first_day)<>extract(year from last_day) or last_day-first_day>365 or first_day<today-366 or last_day>today+366 then raise exception 'Choose valid dates within one calendar year and one year of today.'; end if;
   if length(reason)<3 or length(reason)>2000 then raise exception 'Enter a reason between 3 and 2000 characters.'; end if;
   if portion not in ('full','morning','afternoon') or (portion<>'full' and first_day<>last_day) then raise exception 'Half-day requests must be for one day.'; end if;
   if exists(select 1 from public.crm_attendance_requests where user_id=target and kind=typ and start_date=first_day and end_date=last_day and status='pending') then raise exception 'A matching request is already pending.'; end if;
   if typ in ('leave','outdoor') then
     for d in select generate_series(first_day,last_day,interval '1 day')::date loop
       if (policy->'workingDays') @> jsonb_build_array(extract(isodow from d)::integer) and not exists(select 1 from jsonb_array_elements(policy->'holidays') h where h->>'date'=d::text) then workdates:=workdates||jsonb_build_array(d::text); end if;
     end loop;
     units:=jsonb_array_length(workdates)*case when portion='full' then 1 else 0.5 end;
     if units=0 then raise exception 'No working days in this period. Weekly offs and holidays are excluded.'; end if;
     if exists(select 1 from public.crm_attendance_requests r where user_id=target and kind in ('leave','outdoor') and status in ('pending','approved') and exists(select 1 from jsonb_array_elements_text(workdates) x where r.dates ? x)) then raise exception 'These dates overlap an existing leave or outdoor-duty request.'; end if;
     if typ='leave' then
       if p_data->>'leaveType' is null or p_data->>'leaveType' not in ('casual','sick','earned','unpaid') then raise exception 'Select a leave category.'; end if;
       if portion='full' and exists(select 1 from public.crm_attendance_days a where user_id=target and workdates ? day::text and (clock_in is not null or override in ('present','excused','outdoor'))) then raise exception 'Attendance exists for these dates. Use a half-day request or ask Admin to review it.'; end if;
       if p_data->>'leaveType'<>'unpaid' then
         select coalesce((select days from public.crm_attendance_entitlements where user_id=target and year=extract(year from first_day) and leave_type=p_data->>'leaveType'),(policy->'quotas'->>(p_data->>'leaveType'))::numeric,0) into quota;
         select coalesce(sum(days),0) into used from public.crm_attendance_requests where user_id=target and kind='leave' and leave_type=p_data->>'leaveType' and extract(year from start_date)=extract(year from first_day) and status in ('pending','approved');
         if used+units>quota then raise exception 'Insufficient leave balance, including pending requests. Ask Admin to adjust the allowance or select unpaid leave.'; end if;
       end if;
     end if;
   else
     if first_day<>last_day or first_day>today then raise exception 'Corrections are for a single day, today or earlier.'; end if;
     ci:=(p_data->>'clockIn')::timestamptz; co:=nullif(p_data->>'clockOut','')::timestamptz;
     if ci is null or ci>stamp or (ci at time zone 'Asia/Kolkata')::date<>first_day or (co is not null and (co<ci or co>stamp or (co at time zone 'Asia/Kolkata')::date<>first_day)) then raise exception 'Enter valid clock times on the selected day, not in the future.'; end if;
     if exists(select 1 from public.crm_attendance_requests r where user_id=target and kind='leave' and r.portion='full' and status='approved' and dates ? first_day::text) then raise exception 'Cancel approved full-day leave before correcting attendance.'; end if;
     units:=0; workdates:=jsonb_build_array(first_day::text);
   end if;
   insert into public.crm_attendance_requests(user_id,kind,start_date,end_date,leave_type,portion,days,dates,reason,proposed_in,proposed_out)
   values(target,typ,first_day,last_day,case when typ='leave' then p_data->>'leaveType' end,portion,units,workdates,reason,ci,co) returning to_jsonb(crm_attendance_requests.*) into result;

 elsif p_action in ('review','cancel') then
   select * into req from public.crm_attendance_requests where id=(p_data->>'id')::uuid for update;
   if not found then raise exception 'Request not found.'; end if;
   target:=req.user_id; before_row:=to_jsonb(req);
   if p_action='cancel' then
     if actor.role<>'admin' and (target<>p_actor or req.status<>'pending') then raise exception 'Only your pending requests can be cancelled. Ask Admin about approved requests.' using errcode='42501'; end if;
     if req.status not in ('pending','approved') then raise exception 'This request is already closed.'; end if;
     if req.status='approved' and req.kind='correction' then raise exception 'Use an attendance correction to revise approved clock times.'; end if;
     state:='cancelled';
   else
     if actor.role<>'admin' then raise exception 'Admin approval is required.' using errcode='42501'; end if;
     if req.status<>'pending' then raise exception 'This request has already been reviewed.'; end if;
     state:=p_data->>'decision';
     if state is null or state not in ('approved','rejected') then raise exception 'Choose approve or reject.'; end if;
   end if;
   reason:=trim(coalesce(p_data->>'reason',''));
   if length(reason)<3 or length(reason)>2000 then raise exception 'Add a review note of 3–2000 characters.'; end if;
   if state='approved' then
     if req.kind='leave' and req.leave_type<>'unpaid' then
       select coalesce((select days from public.crm_attendance_entitlements where user_id=target and year=extract(year from req.start_date) and leave_type=req.leave_type),(policy->'quotas'->>req.leave_type)::numeric,0) into quota;
       select coalesce(sum(days),0) into used from public.crm_attendance_requests where user_id=target and kind='leave' and leave_type=req.leave_type and extract(year from start_date)=extract(year from req.start_date) and status in ('pending','approved');
       if used>quota then raise exception 'Allowance is below reserved leave. Adjust the balance before approving.'; end if;
     end if;
     if req.kind='leave' and req.portion='full' and exists(select 1 from public.crm_attendance_days where user_id=target and req.dates ? day::text and (clock_in is not null or override in ('present','excused','outdoor'))) then raise exception 'Attendance was recorded for these dates. Review the conflict before approving.'; end if;
     if req.kind='correction' then
       if exists(select 1 from public.crm_attendance_requests r where user_id=target and kind='leave' and r.portion='full' and status='approved' and dates ? req.start_date::text) then raise exception 'Approved leave conflicts with this correction.'; end if;
       select * into rec from public.crm_attendance_days where user_id=target and day=req.start_date;
       if found and rec.updated_at>req.created_at then raise exception 'Attendance changed after this request. Reject it and ask for a fresh correction.'; end if;
       before_row:=jsonb_build_object('request',before_row,'attendance',to_jsonb(rec));
       insert into public.crm_attendance_days(user_id,day,clock_in,clock_out,policy,note) values(target,req.start_date,req.proposed_in,req.proposed_out,policy,reason)
       on conflict(user_id,day) do update set clock_in=excluded.clock_in,clock_out=excluded.clock_out,note=excluded.note,updated_at=stamp;
     end if;
   end if;
   update public.crm_attendance_requests set status=state,reviewed_by=p_actor,reviewed_at=stamp,review_note=operation.reason where id=req.id returning to_jsonb(crm_attendance_requests.*) into result;

 elsif p_action='adjust' then
   if actor.role<>'admin' then raise exception 'Only Admin can correct attendance.' using errcode='42501'; end if;
   first_day:=(p_data->>'date')::date; ci:=nullif(p_data->>'clockIn','')::timestamptz; co:=nullif(p_data->>'clockOut','')::timestamptz;
   reason:=trim(coalesce(p_data->>'reason','')); state:=nullif(p_data->>'override','');
   if first_day is null or first_day>today or first_day<today-366 or length(reason)<3 or length(reason)>2000 then raise exception 'Choose a day within the past year and enter a correction reason.'; end if;
   if state is not null and state not in ('present','half_day','absent','excused','outdoor') then raise exception 'Invalid attendance override.'; end if;
   if ci is null and state is null then raise exception 'Enter a clock-in time or an attendance override.'; end if;
   if (ci is not null and (ci>stamp or (ci at time zone 'Asia/Kolkata')::date<>first_day)) or (co is not null and (ci is null or co<ci or co>stamp or (co at time zone 'Asia/Kolkata')::date<>first_day)) then raise exception 'Clock times must be ordered, on the selected day, and not in the future.'; end if;
   if exists(select 1 from public.crm_attendance_requests r where user_id=target and kind='leave' and r.portion='full' and status='approved' and dates ? first_day::text) then raise exception 'Cancel approved full-day leave before adjusting attendance.'; end if;
   select to_jsonb(a) into before_row from public.crm_attendance_days a where user_id=target and day=first_day;
   insert into public.crm_attendance_days(user_id,day,clock_in,clock_out,policy,override,note) values(target,first_day,ci,co,policy,state,reason)
   on conflict(user_id,day) do update set clock_in=excluded.clock_in,clock_out=excluded.clock_out,override=excluded.override,note=excluded.note,updated_at=stamp returning to_jsonb(crm_attendance_days.*) into result;

 elsif p_action='entitlement' then
   if actor.role<>'admin' then raise exception 'Only Admin can change leave balances.' using errcode='42501'; end if;
   yr:=(p_data->>'year')::integer; typ:=p_data->>'leaveType'; quota:=(p_data->>'days')::numeric; reason:=trim(coalesce(p_data->>'reason',''));
   if yr is null or yr not between 2020 and 2100 or typ is null or typ not in ('casual','sick','earned') or quota is null or quota<0 or quota>366 or quota*2<>trunc(quota*2) or length(reason)<3 or length(reason)>2000 then raise exception 'Enter a valid annual allowance in half-day increments and a reason.'; end if;
   select coalesce(sum(days),0) into used from public.crm_attendance_requests where user_id=target and leave_type=typ and extract(year from start_date)=yr and status in ('approved','pending');
   if quota<used then raise exception 'Allowance cannot be less than approved and pending leave.'; end if;
   select to_jsonb(e) into before_row from public.crm_attendance_entitlements e where user_id=target and year=yr and leave_type=typ;
   insert into public.crm_attendance_entitlements values(target,yr,typ,quota) on conflict(user_id,year,leave_type) do update set days=excluded.days returning to_jsonb(crm_attendance_entitlements.*) into result;

 elsif p_action='policy' then
   if actor.role<>'admin' then raise exception 'Only Admin can change attendance policy.' using errcode='42501'; end if;
   before_row:=policy; policy:=p_data->'settings'; reason:=trim(coalesce(p_data->>'reason',''));
   if policy is null or length(reason)<3 or length(reason)>2000 then raise exception 'A policy and change reason are required.'; end if;
   if coalesce(policy->>'start','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or coalesce(policy->>'end','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or (policy->>'end')::time<=(policy->>'start')::time then raise exception 'Use a same-day shift with end after start.'; end if;
   if jsonb_typeof(policy->'workingDays') is distinct from 'array' or jsonb_array_length(policy->'workingDays') not between 1 and 7 then raise exception 'Choose at least one working day.'; end if;
   for v in select value from jsonb_array_elements(policy->'workingDays') loop if v.value::text !~ '^[1-7]$' then raise exception 'Invalid working day.'; end if; end loop;
   if (policy->>'lateMinutes') is null or (policy->>'lateMinutes')::integer not between 0 and 180 or (policy->>'lateDays') is null or (policy->>'lateDays')::integer not between 0 and 31 or (policy->>'halfDayHours') is null or (policy->>'halfDayHours')::numeric<=0 or (policy->>'fullDayHours') is null or (policy->>'fullDayHours')::numeric<(policy->>'halfDayHours')::numeric or (policy->>'fullDayHours')::numeric>24 then raise exception 'Check late allowances and working-hour thresholds.'; end if;
   foreach typ in array array['casual','sick','earned'] loop
     quota:=(policy->'quotas'->>typ)::numeric;
     if quota is null or quota<0 or quota>366 or quota*2<>trunc(quota*2) then raise exception 'Leave quotas must be 0–366 days in half-day increments.'; end if;
     if exists(select 1 from public.crm_attendance_requests r where leave_type=typ and status in ('pending','approved') and not exists(select 1 from public.crm_attendance_entitlements e where e.user_id=r.user_id and e.year=extract(year from r.start_date) and e.leave_type=typ) group by user_id,extract(year from start_date) having sum(days)>quota) then raise exception 'This default quota is below existing leave reservations. Set individual allowances first.'; end if;
   end loop;
   if jsonb_typeof(policy->'holidays') is distinct from 'array' or jsonb_array_length(policy->'holidays')>100 then raise exception 'Provide at most 100 holidays.'; end if;
   for v in select value from jsonb_array_elements(policy->'holidays') loop
     d:=(v.value->>'date')::date;
     if d is null or length(trim(coalesce(v.value->>'name','')))<1 or length(v.value->>'name')>100 then raise exception 'Each holiday needs a date and name.'; end if;
   end loop;
   policy:=policy||'{"timezone":"Asia/Kolkata"}';
   update public.crm_attendance_policy set settings=policy,updated_at=stamp where crm_attendance_policy.id=true;
   result:=policy;
 else raise exception 'Unknown attendance action.';
 end if;
 insert into public.crm_attendance_audit(actor_id,user_id,action,reference,detail)
 values(p_actor,target,p_action,result->>'id',jsonb_build_object('before',before_row,'after',result,'reason',reason));
 return result;
end;
$$;
revoke all on function public.crm_attendance_command(text,integer,text,jsonb) from public,anon,authenticated;
grant execute on function public.crm_attendance_command(text,integer,text,jsonb) to service_role;
commit;
