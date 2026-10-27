begin;
create table public.crm_hutoxy_lead_control (
 lead_id uuid primary key references public.leads(id) on delete cascade,
 human_takeover boolean not null default false,
 bot_paused boolean not null default false,
 next_follow_up_at timestamptz,
 updated_at timestamptz not null default now()
);
alter table public.crm_hutoxy_lead_control enable row level security;
revoke all on public.crm_hutoxy_lead_control from public,anon,authenticated;
grant select,insert,update,delete on public.crm_hutoxy_lead_control to service_role;
create or replace function public.crm_hutoxy_lead_json(l public.leads) returns jsonb
language sql stable set search_path=public,pg_temp as $$
 select jsonb_build_object('id',l.id,'ref_id',coalesce(l.lead_code,l.id::text),'name',l.name,
 'owner',(select owner_id from public.crm_hutoxy_settings),'owner_name','Hutoxy Pilot',
 'contact',jsonb_build_object('phone',coalesce(l.phone,l.contact->>'phone',''),'email',coalesce(l.email,l.contact->>'email','')),
 'source',l.source,'status',l.status,'temperature',l.temperature,
 'trip',coalesce(l.trip_details,'{}')||jsonb_build_object('destination',coalesce(nullif(l.trip_details->>'destination',''),l.destination)),
 'budget',l.budget,'last_customer_message_at',l.last_customer_message_at,'last_bot_message_at',l.last_bot_message_at,
 'automation',coalesce((select jsonb_build_object('human_takeover',c.human_takeover,'bot_paused',c.bot_paused,'next_follow_up_at',c.next_follow_up_at) from public.crm_hutoxy_lead_control c where c.lead_id=l.id),jsonb_build_object('human_takeover',false,'bot_paused',false,'next_follow_up_at',null)),
 'created_at',l.created_at,'updated_at',l.updated_at);
$$;

create function public.crm_hutoxy_update_lead(p_ref text,p_patch jsonb,p_request_id text,p_idempotency_id text,p_request_hash text) returns jsonb
language plpgsql set search_path=public,pg_temp as $$
declare l public.leads%rowtype; old_value jsonb; result jsonb; op public.crm_hutoxy_requests%rowtype;
 trip jsonb; pax_config jsonb; stamp timestamptz:=clock_timestamp(); reminder_id text; field text;
begin
 if jsonb_typeof(p_patch)<>'object' or p_patch='{}'::jsonb then raise exception 'invalid_patch';end if;
 if exists(select 1 from jsonb_object_keys(p_patch) k where k not in ('check_in','nights','adults','child_ages','tent_category','tent_count','status','temperature','note','next_follow_up_at','human_takeover','bot_paused','expected_updated_at')) then raise exception 'invalid_patch_field';end if;
 if length(p_idempotency_id)<>64 or length(p_request_hash)<>64 then raise exception 'invalid_idempotency';end if;
 select * into l from public.leads where id::text=p_ref or lead_code=p_ref for update;
 if not found or public.crm_team_owner_user_id(l.assigned_to) is distinct from '3' or not public.crm_hutoxy_eligible(l) then return jsonb_build_object('error','lead_not_in_pilot');end if;
 insert into public.crm_hutoxy_requests(id,request_hash) values(p_idempotency_id,p_request_hash) on conflict do nothing;
 select * into op from public.crm_hutoxy_requests where id=p_idempotency_id for update;
 if op.request_hash<>p_request_hash then return jsonb_build_object('error','idempotency_conflict');end if;
 if op.response is not null then return op.response;end if;
 if p_patch ? 'expected_updated_at' and (p_patch->>'expected_updated_at')::timestamptz is distinct from l.updated_at then return jsonb_build_object('error','lead_changed');end if;
 if p_patch ? 'status' and (p_patch->>'status' is null or p_patch->>'status' not in ('New','Contacted','Proposal Sent','Discussion','Won','Lost')) then raise exception 'invalid_status';end if;
 if p_patch ? 'temperature' and (p_patch->>'temperature' is null or p_patch->>'temperature' not in ('Hot','Warm','Cold')) then raise exception 'invalid_temperature';end if;
 foreach field in array array['human_takeover','bot_paused'] loop
  if p_patch ? field and jsonb_typeof(p_patch->field)<>'boolean' then raise exception 'invalid_boolean';end if;
 end loop;
 foreach field in array array['nights','adults','tent_count'] loop
  if p_patch ? field and (jsonb_typeof(p_patch->field)<>'number' or (p_patch->>field)!~'^[0-9]+$' or (p_patch->>field)::integer<1 or (p_patch->>field)::integer>case when field='nights' then 365 else 1000 end) then raise exception 'invalid_count';end if;
 end loop;
 if p_patch ? 'child_ages' then
  if jsonb_typeof(p_patch->'child_ages')<>'array' or jsonb_array_length(p_patch->'child_ages')>1000 then raise exception 'invalid_child_ages';end if;
  if exists(select 1 from jsonb_array_elements(p_patch->'child_ages') a where jsonb_typeof(a)<>'number' or a::text!~'^[0-9]+$' or a::text::integer not between 0 and 17) then raise exception 'invalid_child_ages';end if;
 end if;
 if p_patch ? 'tent_category' and (p_patch->>'tent_category' is null or p_patch->>'tent_category' not in ('Non-AC Swiss Cottage','Deluxe AC Swiss Cottage','Premium Tent','Super Premium Tent','Rajwadi Suite','Darbari Suite')) then raise exception 'invalid_category';end if;
 if p_patch ? 'note' and (jsonb_typeof(p_patch->'note')<>'string' or length(btrim(p_patch->>'note')) not between 1 and 10000) then raise exception 'invalid_note';end if;
 old_value:=public.crm_hutoxy_lead_json(l);
 trip:=coalesce(l.trip_details,'{}');pax_config:=coalesce(trip->'paxConfig','{}');
 if p_patch ? 'adults' then pax_config:=pax_config||jsonb_build_object('adults',p_patch->'adults');end if;
 if p_patch ? 'child_ages' then pax_config:=pax_config||jsonb_build_object('children',jsonb_array_length(p_patch->'child_ages'),'childAges',p_patch->'child_ages');end if;
 if p_patch ? 'adults' or p_patch ? 'child_ages' then trip:=trip||jsonb_build_object('paxConfig',pax_config);end if;
 if p_patch ? 'check_in' then
  if p_patch->>'check_in' is null or p_patch->>'check_in' !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'invalid_date';end if;
  trip:=trip||jsonb_build_object('startDate',((p_patch->>'check_in')::date)::text);
 end if;
 if p_patch ? 'nights' then trip:=trip||jsonb_build_object('nights',p_patch->'nights');end if;
 if p_patch ? 'tent_count' then trip:=trip||jsonb_build_object('rooms',p_patch->'tent_count');end if;
 if p_patch ? 'tent_category' then trip:=trip||jsonb_build_object('accommodation',p_patch->'tent_category');end if;
 insert into public.crm_hutoxy_lead_control(lead_id) values(l.id) on conflict do nothing;
 update public.crm_hutoxy_lead_control set
 human_takeover=case when p_patch ? 'human_takeover' then (p_patch->>'human_takeover')::boolean else human_takeover end,
 bot_paused=case when p_patch ? 'bot_paused' then (p_patch->>'bot_paused')::boolean else bot_paused end,
 next_follow_up_at=case when p_patch ? 'next_follow_up_at' then (p_patch->>'next_follow_up_at')::timestamptz else next_follow_up_at end,
 updated_at=stamp where lead_id=l.id;
 if p_patch ? 'next_follow_up_at' then
  reminder_id:='hutoxy_followup_'||l.id::text;
  if p_patch->>'next_follow_up_at' is null then delete from public.reminders where id=reminder_id;
  else insert into public.reminders(id,lead_id,task,due_date,is_completed) values(reminder_id,l.id::text,'Hutoxy: Follow up with client',(p_patch->>'next_follow_up_at')::timestamptz,false)
   on conflict(id) do update set due_date=excluded.due_date,is_completed=false;
  end if;
 end if;
 update public.leads set trip_details=trip,
 travel_date=case when p_patch ? 'check_in' then (p_patch->>'check_in')::date else travel_date end,
 pax=case when p_patch ? 'adults' or p_patch ? 'child_ages' then coalesce((pax_config->>'adults')::integer,0)+coalesce((pax_config->>'children')::integer,0) else pax end,
 status=coalesce(p_patch->>'status',status),temperature=coalesce(p_patch->>'temperature',temperature),
 last_status_update=case when p_patch ? 'status' and status is distinct from p_patch->>'status' then stamp else last_status_update end,
 updated_at=stamp where id=l.id returning * into l;
 result:=public.crm_hutoxy_lead_json(l);
 insert into public.interactions(id,lead_id,type,content,timestamp) values('hutoxy_update_'||gen_random_uuid(),l.id::text,'Note',jsonb_build_object('actor','Hutoxy Pilot','kind','lead_update','text',coalesce(p_patch->>'note','Hutoxy updated enquiry details.'),'changed_fields',(select jsonb_agg(k) from jsonb_object_keys(p_patch) k where k<>'expected_updated_at'),'request_id',p_request_id)::text,stamp);
 insert into public.crm_api_audit(request_id,client_id,method,path,action,entity_type,entity_id,before_value,after_value,metadata)
 values(p_request_id,'hutoxy-pilot','PATCH','/api/hutoxy/v1/leads/'||l.id,'hutoxy_lead_updated','lead',l.id::text,old_value,result,jsonb_build_object('actor','Hutoxy Pilot','owner_id','3','patch',p_patch));
 update public.crm_hutoxy_requests set response=result where id=p_idempotency_id;
 return result;
end$$;
revoke all on function public.crm_hutoxy_update_lead(text,jsonb,text,text,text) from public,anon,authenticated;
grant execute on function public.crm_hutoxy_update_lead(text,jsonb,text,text,text) to service_role;
notify pgrst,'reload schema';
commit;
