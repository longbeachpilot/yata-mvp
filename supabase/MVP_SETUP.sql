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
  created_at timestamptz not null default now()
);

alter table public.instructors add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.instructors add column if not exists license_number text;
alter table public.instructors add column if not exists vehicle_year integer;
alter table public.instructors add column if not exists transmission text;
alter table public.instructors add column if not exists dual_brake boolean not null default false;
alter table public.instructors add column if not exists insurance_verified boolean not null default false;

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

-- clean known MVP policies
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies WHERE schemaname='public' AND tablename IN ('profiles','instructors','bookings','lesson_logs','skill_progress') LOOP
    EXECUTE format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- profiles
create policy profiles_select_own on public.profiles for select to authenticated using (auth.uid() = id);
create policy profiles_update_own on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- instructors: active public profiles + owner management
create policy instructors_public_read on public.instructors for select to anon, authenticated using (active = true or user_id = auth.uid());
create policy instructors_insert_own on public.instructors for insert to authenticated with check (user_id = auth.uid());
create policy instructors_update_own on public.instructors for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- bookings: learner owns request, instructor owns fulfillment
create policy bookings_learner_select on public.bookings for select to authenticated using (learner_id = auth.uid());
create policy bookings_learner_insert on public.bookings for insert to authenticated with check (learner_id = auth.uid());
create policy bookings_instructor_select on public.bookings for select to authenticated using (
  exists(select 1 from public.instructors i where i.id = bookings.instructor_id and i.user_id = auth.uid())
);
create policy bookings_instructor_update on public.bookings for update to authenticated using (
  exists(select 1 from public.instructors i where i.id = bookings.instructor_id and i.user_id = auth.uid())
) with check (
  exists(select 1 from public.instructors i where i.id = bookings.instructor_id and i.user_id = auth.uid())
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

grant select, update on public.profiles to authenticated;
grant select on public.instructors to anon, authenticated;
grant insert, update on public.instructors to authenticated;
grant select, insert, update on public.bookings to authenticated;
grant select, insert on public.lesson_logs to authenticated;
grant select, insert on public.skill_progress to authenticated;
