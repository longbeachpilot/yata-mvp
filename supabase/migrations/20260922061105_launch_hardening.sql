-- Harden the existing September 2026 production schema; not a fresh bootstrap.
-- All operations are transactional. No business records are deleted.
revoke update on public.profiles from anon, authenticated;
revoke update(role, id, created_at) on public.profiles from anon, authenticated;
grant update(display_name, phone, avatar_url, home_area) on public.profiles to authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke truncate, references, trigger on public.profiles, public.instructors,
  public.bookings, public.lesson_logs, public.skill_progress, public.reviews,
  public.instructor_availability, public.instructor_service_regions from anon, authenticated;

CREATE OR REPLACE FUNCTION public.yata_save_my_instructor(target_instructor_id uuid, profile_data jsonb, private_license_number text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare current_profile public.instructors%rowtype; current_credential text; needs_review boolean;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.' using errcode='42501'; end if;
  select i.* into current_profile from public.instructors i
    join yata_private.instructor_credentials c on c.instructor_id=i.id
    where i.id=target_instructor_id and i.user_id=auth.uid() and c.owner_id=auth.uid()
    for update of i;
  if not found then raise exception '본인 교관 정보만 수정할 수 있습니다.' using errcode='42501'; end if;
  if jsonb_typeof(profile_data) is distinct from 'object'
     or coalesce(btrim(profile_data->>'name'),'')=''
     or coalesce(btrim(profile_data->>'area'),'')=''
     or coalesce(btrim(profile_data->>'vehicle'),'')=''
     or jsonb_typeof(profile_data->'licenses') is distinct from 'array'
     or jsonb_typeof(profile_data->'specialties') is distinct from 'array' then
    raise exception '이름·활동지역·차량·종별·연수 분야를 확인해주세요.';
  end if;
  if jsonb_array_length(profile_data->'licenses') = 0
     or jsonb_array_length(profile_data->'specialties') = 0 then
    raise exception '종별과 연수 분야를 선택해주세요.';
  end if;
  select license_number into current_credential from yata_private.instructor_credentials
    where instructor_id=target_instructor_id;
  needs_review := current_profile.licenses is distinct from array(select jsonb_array_elements_text(profile_data->'licenses'))
    or current_profile.vehicle is distinct from btrim(profile_data->>'vehicle')
    or current_profile.vehicle_year is distinct from (profile_data->>'vehicle_year')::integer
    or current_profile.transmission is distinct from profile_data->>'transmission'
    or current_profile.dual_brake is distinct from coalesce((profile_data->>'dual_brake')::boolean,false)
    or current_credential is distinct from nullif(btrim(private_license_number),'');
  update public.instructors set
    name=btrim(profile_data->>'name'), area=btrim(profile_data->>'area'),
    vehicle=btrim(profile_data->>'vehicle'),
    licenses=array(select jsonb_array_elements_text(profile_data->'licenses')),
    specialties=array(select jsonb_array_elements_text(profile_data->'specialties')),
    vehicle_year=(profile_data->>'vehicle_year')::integer,
    transmission=profile_data->>'transmission',
    dual_brake=coalesce((profile_data->>'dual_brake')::boolean,false),
    insurance_verified=case when needs_review then false else current_profile.insurance_verified end,
    active=case when needs_review then false else current_profile.active end,
    intro=nullif(btrim(profile_data->>'intro'),'')
  where id=target_instructor_id;
  update yata_private.instructor_credentials
    set license_number=nullif(btrim(private_license_number),''),updated_at=now()
    where instructor_id=target_instructor_id;
end $function$
;
CREATE OR REPLACE FUNCTION public.register_instructor(instructor_name text, service_area text, instructor_specialties text[], instructor_licenses text[], private_license_number text, education_vehicle text, education_vehicle_year integer, education_transmission text, has_dual_brake boolean, instructor_intro text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'yata_private'
AS $function$
declare new_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if coalesce(length(trim(instructor_name)),0)=0 or coalesce(length(trim(service_area)),0)=0 or coalesce(length(trim(education_vehicle)),0)=0 then raise exception 'REQUIRED_FIELDS'; end if;
  if coalesce(cardinality(instructor_specialties),0)=0 or coalesce(cardinality(instructor_licenses),0)=0 then raise exception 'REQUIRED_SELECTIONS'; end if;
  if exists(select 1 from public.instructors where user_id=auth.uid()) then raise exception 'INSTRUCTOR_EXISTS'; end if;
  insert into public.instructors(user_id,name,area,specialties,licenses,vehicle,vehicle_year,transmission,dual_brake,intro,active)
  values(auth.uid(),trim(instructor_name),trim(service_area),instructor_specialties,instructor_licenses,trim(education_vehicle),education_vehicle_year,education_transmission,has_dual_brake,nullif(trim(instructor_intro),''),false)
  returning id into new_id;
  insert into yata_private.instructor_credentials(instructor_id,owner_id,license_number,updated_at)
  values(new_id,auth.uid(),nullif(trim(private_license_number),''),now())
  on conflict (instructor_id) do update set owner_id=excluded.owner_id,license_number=excluded.license_number,updated_at=now();
  update public.profiles set role='instructor' where id=auth.uid() and role='learner';
  return new_id;
end $function$
;
CREATE OR REPLACE FUNCTION public.create_booking_request(p_instructor_id uuid, p_lesson_type text, p_lesson_date date, p_start_time text, p_duration_minutes integer, p_pickup_text text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := auth.uid();
  v_role text;
  v_amount integer;
  v_booking_id uuid;
  v_start time;
  v_end time;
  v_start_at timestamp;
  v_end_at timestamp;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='P0001'; end if;
  select role into v_role from public.profiles where id=v_user;
  if v_role is distinct from 'learner' then raise exception 'LEARNER_REQUIRED' using errcode='P0001'; end if;
  if p_lesson_date is null then raise exception 'INVALID_DATE'; end if;
  if p_lesson_date < (now() at time zone 'Asia/Seoul')::date then raise exception 'PAST_DATE' using errcode='P0001'; end if;
  if nullif(btrim(p_lesson_type),'') is null then raise exception 'LESSON_TYPE_REQUIRED' using errcode='P0001'; end if;
  if p_duration_minutes is distinct from 120 then raise exception 'INVALID_DURATION' using errcode='P0001'; end if;
  if nullif(btrim(p_pickup_text),'') is null then raise exception 'PICKUP_REQUIRED' using errcode='P0001'; end if;
  if p_start_time is null or p_start_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'INVALID_TIME'; end if;
  begin v_start := p_start_time::time; exception when others then raise exception 'INVALID_TIME' using errcode='P0001'; end;
  v_start_at := p_lesson_date + v_start;
  v_end_at := v_start_at + p_duration_minutes * interval '1 minute';
  if v_start_at <= (now() at time zone 'Asia/Seoul') then raise exception 'PAST_TIME'; end if;
  if v_end_at::date <> p_lesson_date then raise exception 'INVALID_TIME'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user::text || ':' || p_lesson_date::text, 0));
  perform pg_advisory_xact_lock(hashtextextended(p_instructor_id::text || ':' || p_lesson_date::text, 0));

  select base_price_2h into v_amount
  from public.instructors
  where id=p_instructor_id
    and active=true
    and insurance_verified=true
    and dual_brake=true
    and cardinality(licenses) > 0;
  if v_amount is null or v_amount <= 0 then raise exception 'INSTRUCTOR_NOT_BOOKABLE' using errcode='P0001'; end if;

  if not exists (
    select 1 from public.instructor_availability
    where instructor_id=p_instructor_id and lesson_date=p_lesson_date
      and start_time=p_start_time and is_available=true
  ) then raise exception 'SLOT_UNAVAILABLE' using errcode='P0001'; end if;

  if exists (
    select 1 from public.bookings b
    where b.instructor_id=p_instructor_id
      and b.status in ('requested','confirmed')
      and (b.lesson_date + b.start_time::time) < v_end_at
      and (b.lesson_date + b.start_time::time + b.duration_minutes*interval '1 minute') > v_start_at
  ) then raise exception 'SLOT_CONFLICT' using errcode='P0001'; end if;

  if exists (
    select 1 from public.bookings b
    where b.learner_id=v_user
      and b.status in ('requested','confirmed')
      and (b.lesson_date + b.start_time::time) < v_end_at
      and (b.lesson_date + b.start_time::time + b.duration_minutes*interval '1 minute') > v_start_at
  ) then raise exception 'LEARNER_CONFLICT' using errcode='P0001'; end if;

  insert into public.bookings(learner_id,instructor_id,lesson_type,lesson_date,start_time,duration_minutes,pickup_text,amount,status)
  values(v_user,p_instructor_id,btrim(p_lesson_type),p_lesson_date,p_start_time,p_duration_minutes,btrim(p_pickup_text),v_amount,'requested')
  returning id into v_booking_id;
  return v_booking_id;
end;
$function$
;
