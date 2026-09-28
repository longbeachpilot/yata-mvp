-- Keep discovery regions in the same transaction as registration/profile edits.
-- Only the existing owner-checked instructor RPCs can write instructor profiles.
create or replace function yata_private.sync_profile_service_regions()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if TG_OP = 'UPDATE' and old.area is not distinct from new.area then return new; end if;
  update public.instructor_service_regions set active=false where instructor_id=new.id;
  insert into public.instructor_service_regions(instructor_id,region_name,active)
    select distinct new.id,btrim(part),true
    from regexp_split_to_table(new.area,E'[,·/;\n]+') as part
    where btrim(part)<>''
    on conflict (instructor_id,region_name) do update set active=true;
  return new;
end $$;
revoke all on function yata_private.sync_profile_service_regions() from public,anon,authenticated;
create trigger instructors_sync_service_regions
after insert or update of area on public.instructors
for each row execute function yata_private.sync_profile_service_regions();

-- Fill genuinely missing rows only; preserve existing manually reviewed coverage.
insert into public.instructor_service_regions(instructor_id,region_name,active)
select distinct i.id,btrim(part),true
from public.instructors i cross join lateral regexp_split_to_table(i.area,E'[,·/;\n]+') part
where btrim(part)<>'' and not exists (
  select 1 from public.instructor_service_regions r where r.instructor_id=i.id
)
on conflict (instructor_id,region_name) do nothing;

-- The UI already uses validated RPCs for these writes. Direct inserts could
-- otherwise bypass six-skill validation and create incomplete lesson records.
revoke insert,update,delete on public.lesson_logs,public.skill_progress,public.reviews from anon,authenticated;

-- Validate writes from the teacher UI/API, including attempts to reopen an
-- already reserved slot. Internal booking transitions run as their definer.
create or replace function yata_private.validate_public_availability()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if current_user not in ('anon','authenticated') then return new; end if;
  if new.start_time !~ '^([01][0-9]|2[01]):[0-5][0-9]$' then raise exception 'INVALID_SLOT_TIME'; end if;
  if new.is_available then
    if new.lesson_date + new.start_time::time <= now() at time zone 'Asia/Seoul' then
      raise exception 'PAST_SLOT';
    end if;
    -- Same lock key as create_booking_request, before checking conflicts.
    perform pg_advisory_xact_lock(hashtextextended(new.instructor_id::text||':'||new.lesson_date::text,0));
    if exists(select 1 from public.bookings b where b.instructor_id=new.instructor_id
      and b.status in ('requested','confirmed')
      and b.lesson_date+b.start_time::time < new.lesson_date+new.start_time::time+interval '2 hours'
      and b.lesson_date+b.start_time::time+b.duration_minutes*interval '1 minute' > new.lesson_date+new.start_time::time) then
      raise exception 'SLOT_CONFLICT';
    end if;
  end if;
  return new;
end $$;
revoke all on function yata_private.validate_public_availability() from public,anon,authenticated;
create trigger availability_validate_public_write
before insert or update on public.instructor_availability
for each row execute function yata_private.validate_public_availability();
