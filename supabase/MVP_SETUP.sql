-- YA TA MVP unified Supabase setup
-- Fresh project or existing MVP project: designed to be re-runnable where practical.

create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('learner','instructor','admin');
  end if;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'learner',
  display_name text not null,
  phone text,
  avatar_url text,
  home_area text,
  created_at timestamptz not null default now()
);

create table if not exists public.instructors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  area text not null,
  specialties text[] not null default '{}',
  licenses text[] not null default '{}',
  license_number text,
  vehicle text not null,
  vehicle_year integer,
  transmission text,
  dual_brake boolean not null default false,
  insurance_verified boolean not null default false,
  rating numeric(3,2) not null default 0,
  reviews integer not null default 0,
  lessons integer not null default 0,
  next_slot text,
  intro text,
  active boolean not null default true,
  approval_status text not null default 'pending' check (approval_status in ('pending','approved','rejected')),
  rejection_reason text,
  created_at timestamptz not null default now()
);

alter table public.instructors add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.instructors add column if not exists license_number text;
alter table public.instructors add column if not exists vehicle_year integer;
alter table public.instructors add column if not exists transmission text;
alter table public.instructors add column if not exists dual_brake boolean not null default false;
alter table public.instructors add column if not exists insurance_verified boolean not null default false;
alter table public.instructors add column if not exists approval_status text not null default 'pending';
alter table public.instructors add column if not exists rejection_reason text;

create unique index if not exists instructors_user_id_unique on public.instructors(user_id) where user_id is not null;

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references auth.users(id) on delete cascade,
  instructor_id uuid not null references public.instructors(id) on delete cascade,
  lesson_type text not null,
  lesson_date date not null,
  start_time text not null,
  duration_minutes integer not null default 120,
  pickup_text text not null,
  amount integer not null default 90000,
  status text not null default 'requested' check (status in ('requested','confirmed','completed','cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.lesson_logs (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid unique not null references public.bookings(id) on delete cascade,
  learner_id uuid not null references auth.users(id) on delete cascade,
  instructor_id uuid not null references public.instructors(id) on delete cascade,
  minutes integer not null,
  instructor_note text not null,
  next_goal text,
  created_at timestamptz not null default now()
);

create table if not exists public.skill_progress (
  id uuid primary key default gen_random_uuid(),
  lesson_log_id uuid not null references public.lesson_logs(id) on delete cascade,
  skill_key text not null,
  score integer not null check (score between 0 and 100),
  note text
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid unique not null references public.bookings(id) on delete cascade,
  learner_id uuid not null references auth.users(id) on delete cascade,
  instructor_id uuid not null references public.instructors(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  content text not null check (char_length(content) between 10 and 1000),
  created_at timestamptz not null default now()
);

-- Prevent two live lessons from occupying the exact same instructor slot.
create unique index if not exists bookings_live_slot_unique
on public.bookings(instructor_id, lesson_date, start_time)
where status in ('requested','confirmed');

-- Auth -> profiles automatic creation
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare selected_role public.user_role;
begin
  selected_role := case when new.raw_user_meta_data ->> 'role' = 'instructor'
    then 'instructor'::public.user_role else 'learner'::public.user_role end;
  insert into public.profiles(id, role, display_name)
  values(new.id, selected_role, coalesce(nullif(new.raw_user_meta_data ->> 'display_name',''), split_part(new.email,'@',1), 'YA TA 사용자'))
  on conflict(id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

insert into public.profiles(id, role, display_name)
select u.id,
  case when u.raw_user_meta_data ->> 'role' = 'instructor' then 'instructor'::public.user_role else 'learner'::public.user_role end,
  coalesce(nullif(u.raw_user_meta_data ->> 'display_name',''), split_part(u.email,'@',1), 'YA TA 사용자')
from auth.users u
where not exists(select 1 from public.profiles p where p.id = u.id);

-- RLS
alter table public.profiles enable row level security;
alter table public.instructors enable row level security;
alter table public.bookings enable row level security;
alter table public.lesson_logs enable row level security;
alter table public.skill_progress enable row level security;
alter table public.reviews enable row level security;

-- clean known MVP policies
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies WHERE schemaname='public' AND tablename IN ('profiles','instructors','bookings','lesson_logs','skill_progress','reviews') LOOP
    EXECUTE format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- profiles
create policy profiles_select_own on public.profiles for select to authenticated using (auth.uid() = id);
create policy profiles_update_own on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role='admin');
$$;
grant execute on function public.is_admin() to authenticated;
create policy profiles_admin_read on public.profiles for select to authenticated using (public.is_admin());

-- instructors: active public profiles + owner management
create policy instructors_public_read on public.instructors for select to anon, authenticated using ((active = true and approval_status='approved') or user_id = auth.uid());
create policy instructors_insert_own on public.instructors for insert to authenticated with check (
  user_id = auth.uid() and approval_status='pending' and active=false
);
create policy instructors_update_own on public.instructors for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy instructors_admin_all on public.instructors for all to authenticated using (
  public.is_admin()
) with check (
  public.is_admin()
);

-- bookings: learner owns request, instructor owns fulfillment
create policy bookings_learner_select on public.bookings for select to authenticated using (learner_id = auth.uid());
create policy bookings_learner_insert on public.bookings for insert to authenticated with check (
  learner_id = auth.uid() and status='requested' and exists(
    select 1 from public.instructors i where i.id=bookings.instructor_id and i.active=true and i.approval_status='approved'
  )
);
create policy bookings_instructor_select on public.bookings for select to authenticated using (
  exists(select 1 from public.instructors i where i.id = bookings.instructor_id and i.user_id = auth.uid())
);
create policy bookings_instructor_update on public.bookings for update to authenticated using (
  exists(select 1 from public.instructors i where i.id = bookings.instructor_id and i.user_id = auth.uid())
) with check (
  exists(select 1 from public.instructors i where i.id = bookings.instructor_id and i.user_id = auth.uid())
);
create policy bookings_admin_read on public.bookings for select to authenticated using (
  public.is_admin()
);

-- logbook
create policy lesson_logs_learner_select on public.lesson_logs for select to authenticated using (learner_id = auth.uid());
create policy lesson_logs_instructor_select on public.lesson_logs for select to authenticated using (
  exists(select 1 from public.instructors i where i.id = lesson_logs.instructor_id and i.user_id = auth.uid())
);
create policy lesson_logs_instructor_insert on public.lesson_logs for insert to authenticated with check (
  exists(select 1 from public.instructors i where i.id = lesson_logs.instructor_id and i.user_id = auth.uid())
);
create policy skill_progress_read on public.skill_progress for select to authenticated using (
  exists(select 1 from public.lesson_logs l left join public.instructors i on i.id=l.instructor_id where l.id=skill_progress.lesson_log_id and (l.learner_id=auth.uid() or i.user_id=auth.uid()))
);
create policy skill_progress_instructor_insert on public.skill_progress for insert to authenticated with check (
  exists(select 1 from public.lesson_logs l join public.instructors i on i.id=l.instructor_id where l.id=skill_progress.lesson_log_id and i.user_id=auth.uid())
);

create policy reviews_public_read on public.reviews for select to anon, authenticated using (true);
create policy reviews_learner_insert on public.reviews for insert to authenticated with check (
  learner_id=auth.uid() and exists(
    select 1 from public.bookings b where b.id=reviews.booking_id
    and b.learner_id=auth.uid() and b.instructor_id=reviews.instructor_id and b.status='completed'
  )
);

create or replace function public.refresh_instructor_rating()
returns trigger language plpgsql security definer set search_path=public as $$
declare target_id uuid;
begin
  target_id := coalesce(new.instructor_id, old.instructor_id);
  update public.instructors i set
    rating=coalesce((select round(avg(r.rating)::numeric,2) from public.reviews r where r.instructor_id=target_id),0),
    reviews=(select count(*) from public.reviews r where r.instructor_id=target_id)
  where i.id=target_id;
  return coalesce(new,old);
end; $$;
drop trigger if exists reviews_refresh_rating on public.reviews;
create trigger reviews_refresh_rating after insert or update or delete on public.reviews
for each row execute procedure public.refresh_instructor_rating();

create or replace function public.cancel_my_booking(target_booking_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  update public.bookings set status='cancelled'
  where id=target_booking_id and learner_id=auth.uid() and status in ('requested','confirmed');
  if not found then raise exception '취소할 수 없는 예약입니다.'; end if;
end; $$;
grant execute on function public.cancel_my_booking(uuid) to authenticated;

create or replace function public.become_instructor()
returns void language plpgsql security definer set search_path=public as $$
begin
  update public.profiles set role='instructor' where id=auth.uid() and role='learner';
end; $$;
grant execute on function public.become_instructor() to authenticated;

create or replace function public.admin_review_instructor(target_id uuid, decision text, reason text default null)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then raise exception '관리자 권한이 필요합니다.'; end if;
  if decision not in ('approved','rejected') then raise exception '잘못된 심사 상태입니다.'; end if;
  update public.instructors set approval_status=decision,
    active=(decision='approved'), rejection_reason=case when decision='rejected' then reason else null end
  where id=target_id;
end; $$;
grant execute on function public.admin_review_instructor(uuid,text,text) to authenticated;

create or replace function public.instructor_transition_booking(target_booking_id uuid, next_status text)
returns void language plpgsql security definer set search_path=public as $$
declare current_status text;
begin
  select b.status into current_status from public.bookings b join public.instructors i on i.id=b.instructor_id
  where b.id=target_booking_id and i.user_id=auth.uid() for update;
  if current_status is null then raise exception '예약을 찾을 수 없습니다.'; end if;
  if not ((current_status='requested' and next_status in ('confirmed','cancelled')) or
          (current_status='confirmed' and next_status in ('completed','cancelled'))) then
    raise exception '허용되지 않은 상태 변경입니다.';
  end if;
  update public.bookings set status=next_status where id=target_booking_id;
end; $$;
grant execute on function public.instructor_transition_booking(uuid,text) to authenticated;

create or replace function public.create_lesson_log(target_booking_id uuid, lesson_minutes integer, note_text text, next_goal_text text, skills jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare b public.bookings%rowtype; log_id uuid; skill jsonb;
begin
  select b0.* into b from public.bookings b0 join public.instructors i on i.id=b0.instructor_id
  where b0.id=target_booking_id and i.user_id=auth.uid() and b0.status='completed';
  if b.id is null then raise exception '완료된 본인 수업만 기록할 수 있습니다.'; end if;
  if lesson_minutes < 1 or lesson_minutes > 720 then raise exception '수업 시간을 확인해주세요.'; end if;
  if char_length(trim(note_text)) < 1 then raise exception '교관 코멘트를 입력해주세요.'; end if;
  insert into public.lesson_logs(booking_id,learner_id,instructor_id,minutes,instructor_note,next_goal)
  values(b.id,b.learner_id,b.instructor_id,lesson_minutes,trim(note_text),nullif(trim(next_goal_text),'')) returning id into log_id;
  for skill in select * from jsonb_array_elements(skills) loop
    insert into public.skill_progress(lesson_log_id,skill_key,score,note)
    values(log_id,skill->>'skill_key',(skill->>'score')::integer,null);
  end loop;
  return log_id;
end; $$;
grant execute on function public.create_lesson_log(uuid,integer,text,text,jsonb) to authenticated;

grant select on public.profiles to authenticated;
grant update(display_name, phone, avatar_url, home_area) on public.profiles to authenticated;
grant select on public.instructors to anon, authenticated;
grant insert on public.instructors to authenticated;
grant update(name, area, specialties, licenses, license_number, vehicle, vehicle_year, transmission, dual_brake, insurance_verified, next_slot, intro) on public.instructors to authenticated;
grant select, insert on public.bookings to authenticated;
grant select, insert on public.lesson_logs to authenticated;
grant select, insert on public.skill_progress to authenticated;
grant select, insert on public.reviews to anon, authenticated;
