-- Append-only operations history. No client gets direct access to this table.
create table yata_private.booking_events (
  id bigint generated always as identity primary key,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('baseline','created','status_changed','contact_recorded')),
  previous_status text,
  status text not null check (status in ('requested','confirmed','completed','cancelled')),
  recipient_role text check (recipient_role in ('learner','instructor')),
  status_event_id bigint references yata_private.booking_events(id) on delete cascade,
  occurred_at timestamptz not null default clock_timestamp(),
  check ((event_type = 'contact_recorded') = (recipient_role is not null and status_event_id is not null))
);
create index booking_events_booking_history_idx on yata_private.booking_events(booking_id,id desc);
create unique index booking_contact_once_idx on yata_private.booking_events(booking_id,status_event_id,recipient_role)
  where event_type = 'contact_recorded';
alter table yata_private.booking_events enable row level security;
revoke all on yata_private.booking_events from public, anon, authenticated;
revoke all on sequence yata_private.booking_events_id_seq from public, anon, authenticated;

create function yata_private.record_booking_event() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into yata_private.booking_events(booking_id,actor_id,event_type,status)
    values(new.id,auth.uid(),'created',new.status);
  elsif old.status is distinct from new.status then
    insert into yata_private.booking_events(booking_id,actor_id,event_type,previous_status,status)
    values(new.id,auth.uid(),'status_changed',old.status,new.status);
  end if;
  return new;
end $$;
revoke all on function yata_private.record_booking_event() from public, anon, authenticated;
create trigger bookings_record_event after insert or update of status on public.bookings
for each row execute function yata_private.record_booking_event();

-- This is the current state at installation, not a reconstruction of old activity.
insert into yata_private.booking_events(booking_id,event_type,status)
select id,'baseline',status from public.bookings;

create function public.admin_list_bookings(p_status text default null, p_limit integer default 100, p_offset integer default 0)
returns table (
  id uuid, lesson_type text, lesson_date date, start_time text, duration_minutes integer,
  pickup_text text, amount integer, status text, created_at timestamptz,
  learner_name text, learner_email text, instructor_name text, instructor_email text,
  status_event_id bigint, status_changed_at timestamptz,
  learner_contacted_at timestamptz, instructor_contacted_at timestamptz
)
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_status is not null and p_status not in ('requested','confirmed','completed','cancelled') then
    raise exception 'INVALID_STATUS';
  end if;
  return query
  select b.id,b.lesson_type,b.lesson_date,b.start_time,b.duration_minutes,b.pickup_text,b.amount,b.status,b.created_at,
    p.display_name,learner.email::text,i.name,teacher.email::text,e.id,e.occurred_at,
    (select max(c.occurred_at) from yata_private.booking_events c where c.booking_id=b.id and c.status_event_id=e.id and c.recipient_role='learner'),
    (select max(c.occurred_at) from yata_private.booking_events c where c.booking_id=b.id and c.status_event_id=e.id and c.recipient_role='instructor')
  from public.bookings b
  join public.profiles p on p.id=b.learner_id
  join public.instructors i on i.id=b.instructor_id
  left join auth.users learner on learner.id=b.learner_id
  left join auth.users teacher on teacher.id=i.user_id
  left join lateral (
    select ev.id,ev.occurred_at from yata_private.booking_events ev
    where ev.booking_id=b.id and ev.event_type in ('baseline','created','status_changed')
    order by ev.id desc limit 1
  ) e on true
  where p_status is null or b.status=p_status
  order by b.created_at desc,b.id
  limit least(greatest(coalesce(p_limit,100),1),200) offset greatest(coalesce(p_offset,0),0);
end $$;

create function public.admin_record_booking_contact(target_booking_id uuid, expected_status_event_id bigint, recipient text)
returns void language plpgsql security definer set search_path = '' as $$
declare current_event bigint; current_status text;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if recipient is null or recipient not in ('learner','instructor') then raise exception 'INVALID_RECIPIENT'; end if;
  select b.status into current_status from public.bookings b where b.id=target_booking_id for update;
  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
  select e.id into current_event from yata_private.booking_events e
  where e.booking_id=target_booking_id and e.event_type in ('baseline','created','status_changed') order by e.id desc limit 1;
  if current_event is null or current_event is distinct from expected_status_event_id then
    raise exception 'BOOKING_CHANGED';
  end if;
  insert into yata_private.booking_events(booking_id,actor_id,event_type,status,recipient_role,status_event_id)
  values(target_booking_id,auth.uid(),'contact_recorded',current_status,recipient,current_event)
  on conflict (booking_id,status_event_id,recipient_role) where event_type='contact_recorded' do nothing;
end $$;

create function public.get_booking_history(target_booking_id uuid)
returns table(id bigint,event_type text,previous_status text,status text,recipient_role text,occurred_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.is_admin() and not exists (
    select 1 from public.bookings b join public.instructors i on i.id=b.instructor_id
    where b.id=target_booking_id and (b.learner_id=auth.uid() or i.user_id=auth.uid())
  ) then raise exception 'BOOKING_NOT_FOUND'; end if;
  return query select e.id,e.event_type,e.previous_status,e.status,e.recipient_role,e.occurred_at
  from yata_private.booking_events e where e.booking_id=target_booking_id
  -- Manual operator contact records are only visible in the admin console.
    and (e.event_type <> 'contact_recorded' or public.is_admin())
  order by e.id desc limit 100;
end $$;

revoke all on function public.admin_list_bookings(text,integer,integer) from public,anon;
revoke all on function public.admin_record_booking_contact(uuid,bigint,text) from public,anon;
revoke all on function public.get_booking_history(uuid) from public,anon;
grant execute on function public.admin_list_bookings(text,integer,integer) to authenticated,service_role;
grant execute on function public.admin_record_booking_contact(uuid,bigint,text) to authenticated,service_role;
grant execute on function public.get_booking_history(uuid) to authenticated,service_role;
