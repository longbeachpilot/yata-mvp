-- Partner operations are private; public APIs expose only explicit safe fields.
create table yata_private.partner_academies (
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 120),
 address text not null default '', public_phone text not null default '', refund_policy text not null default '',
 contact_email text not null default '', business_number text not null default '', notes text not null default '',
 mou_signed_on date, expires_on date, registration_checked boolean not null default false,
 insurance_checked boolean not null default false, status text not null default 'draft' check(status in ('draft','active','paused')),
 updated_at timestamptz not null default now(), updated_by uuid references auth.users(id),
 check(expires_on is null or mou_signed_on is null or expires_on >= mou_signed_on)
);
create table yata_private.instructor_academies (
 instructor_id uuid primary key references public.instructors(id) on delete cascade,
 academy_id uuid not null references yata_private.partner_academies(id),
 updated_at timestamptz not null default now(), updated_by uuid references auth.users(id)
);
create index instructor_academies_academy_idx on yata_private.instructor_academies(academy_id);
create table yata_private.booking_academies (
 booking_id uuid primary key references public.bookings(id) on delete cascade,
 academy_id uuid not null references yata_private.partner_academies(id),
 name text not null,address text not null,public_phone text not null,refund_policy text not null,
 recorded_at timestamptz not null default now()
);
create index booking_academies_academy_idx on yata_private.booking_academies(academy_id);
alter table yata_private.partner_academies enable row level security;
alter table yata_private.instructor_academies enable row level security;
alter table yata_private.booking_academies enable row level security;
revoke all on yata_private.partner_academies,yata_private.instructor_academies,yata_private.booking_academies from public,anon,authenticated;

-- Guarded API: no client role may write the private tables directly.
create function public.admin_save_academy(academy_data jsonb, target_academy_id uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare a yata_private.partner_academies; result_id uuid;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
 a.name:=btrim(coalesce(academy_data->>'name','')); a.address:=btrim(coalesce(academy_data->>'address',''));
 a.public_phone:=btrim(coalesce(academy_data->>'public_phone','')); a.refund_policy:=btrim(coalesce(academy_data->>'refund_policy',''));
 a.contact_email:=btrim(coalesce(academy_data->>'contact_email','')); a.business_number:=btrim(coalesce(academy_data->>'business_number',''));
 a.notes:=coalesce(academy_data->>'notes',''); a.mou_signed_on:=nullif(academy_data->>'mou_signed_on','')::date;
 a.expires_on:=nullif(academy_data->>'expires_on','')::date; a.registration_checked:=coalesce((academy_data->>'registration_checked')::boolean,false);
 a.insurance_checked:=coalesce((academy_data->>'insurance_checked')::boolean,false); a.status:=coalesce(academy_data->>'status','draft');
 if length(a.name) not between 1 and 120 or length(a.address)>500 or length(a.refund_policy)>4000 or length(a.notes)>4000 or length(a.contact_email)>200 or length(a.public_phone)>50 or length(a.business_number)>30 then raise exception 'INVALID_ACADEMY'; end if;
 if a.status='active' and (a.mou_signed_on is null or a.mou_signed_on>(now() at time zone 'Asia/Seoul')::date or not a.registration_checked or not a.insurance_checked or a.address='' or a.public_phone='' or a.refund_policy='' or a.business_number='' or (a.expires_on is not null and a.expires_on<(now() at time zone 'Asia/Seoul')::date)) then raise exception 'ACADEMY_CHECKS_REQUIRED'; end if;
 if target_academy_id is null then
  insert into yata_private.partner_academies(name,address,public_phone,refund_policy,contact_email,business_number,notes,mou_signed_on,expires_on,registration_checked,insurance_checked,status,updated_by)
  values(a.name,a.address,a.public_phone,a.refund_policy,a.contact_email,a.business_number,a.notes,a.mou_signed_on,a.expires_on,a.registration_checked,a.insurance_checked,a.status,auth.uid()) returning id into result_id;
 else
  update yata_private.partner_academies set name=a.name,address=a.address,public_phone=a.public_phone,refund_policy=a.refund_policy,contact_email=a.contact_email,business_number=a.business_number,notes=a.notes,mou_signed_on=a.mou_signed_on,expires_on=a.expires_on,registration_checked=a.registration_checked,insurance_checked=a.insurance_checked,status=a.status,updated_at=now(),updated_by=auth.uid() where id=target_academy_id returning id into result_id;
  if result_id is null then raise exception 'ACADEMY_NOT_FOUND'; end if;
 end if;
 return result_id;
end $$;
create function public.admin_academy_overview() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
 return jsonb_build_object('academies',(select coalesce(jsonb_agg(to_jsonb(a) order by a.name),'[]'::jsonb) from yata_private.partner_academies a),
 'instructors',(select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'name',i.name,'area',i.area,'academy_id',l.academy_id) order by i.name),'[]'::jsonb) from public.instructors i left join yata_private.instructor_academies l on l.instructor_id=i.id));
end $$;
create function public.admin_assign_academy(target_instructor_id uuid,target_academy_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
 perform 1 from public.instructors where id=target_instructor_id for update;
 if not found then raise exception 'INSTRUCTOR_NOT_FOUND'; end if;
 if target_academy_id is null then
  delete from yata_private.instructor_academies where instructor_id=target_instructor_id;
 else
  perform 1 from yata_private.partner_academies where id=target_academy_id;
  if not found then raise exception 'ACADEMY_NOT_FOUND'; end if;
  insert into yata_private.instructor_academies(instructor_id,academy_id,updated_by) values(target_instructor_id,target_academy_id,auth.uid())
  on conflict(instructor_id) do update set academy_id=excluded.academy_id,updated_by=auth.uid(),updated_at=now();
 end if;
end $$;
-- Snapshot only newly-created bookings. Never infer a provider for historical bookings.
create function yata_private.snapshot_booking_academy() returns trigger language plpgsql security definer set search_path='' as $$
declare a yata_private.partner_academies;
begin
 perform 1 from public.instructors where id=new.instructor_id for share;
 select p.* into a from yata_private.partner_academies p join yata_private.instructor_academies l on l.academy_id=p.id where l.instructor_id=new.instructor_id for share of p;
 if not found then return new; end if;
 if a.status<>'active' or (a.expires_on is not null and new.lesson_date>a.expires_on) then raise exception 'ACADEMY_UNAVAILABLE'; end if;
 insert into yata_private.booking_academies(booking_id,academy_id,name,address,public_phone,refund_policy) values(new.id,a.id,a.name,a.address,a.public_phone,a.refund_policy);
 return new;
end $$;
create trigger booking_academy_snapshot after insert on public.bookings for each row execute function yata_private.snapshot_booking_academy();
revoke all on function yata_private.snapshot_booking_academy() from public,anon,authenticated;

create function public.get_booking_academy(p_instructor_id uuid default null,p_booking_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; a yata_private.partner_academies;
begin
 if p_booking_id is not null then
  if auth.uid() is null or not exists(select 1 from public.bookings b join public.instructors i on i.id=b.instructor_id where b.id=p_booking_id and (b.learner_id=auth.uid() or i.user_id=auth.uid() or public.is_admin())) then raise exception 'BOOKING_ACCESS_DENIED'; end if;
  select jsonb_build_object('name',name,'address',address,'public_phone',public_phone,'refund_policy',refund_policy,'booking_allowed',true,'snapshot',true) into result from yata_private.booking_academies where booking_id=p_booking_id;
  return result;
 end if;
 if not exists(select 1 from public.instructors where id=p_instructor_id and active) then return null; end if;
 select p.* into a from yata_private.partner_academies p join yata_private.instructor_academies l on l.academy_id=p.id where l.instructor_id=p_instructor_id;
 if not found then return null; end if;
 if a.status<>'active' or (a.expires_on is not null and a.expires_on<(now() at time zone 'Asia/Seoul')::date) then return jsonb_build_object('booking_allowed',false); end if;
 return jsonb_build_object('name',a.name,'address',a.address,'public_phone',a.public_phone,'refund_policy',a.refund_policy,'booking_allowed',true,'snapshot',false);
end $$;
create function public.admin_academy_monthly(p_month date) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
 if p_month is null or extract(day from p_month)<>1 then raise exception 'INVALID_MONTH'; end if;
 return (select coalesce(jsonb_agg(to_jsonb(r) order by r.name),'[]'::jsonb) from (
 select a.id,a.name,count(b.id) as total,count(b.id) filter(where b.status='requested') as requested,count(b.id) filter(where b.status='confirmed') as confirmed,count(b.id) filter(where b.status='completed') as completed,count(b.id) filter(where b.status='cancelled') as cancelled,coalesce(sum(b.amount) filter(where b.status='completed'),0) as completed_amount
 from yata_private.partner_academies a left join yata_private.booking_academies s on s.academy_id=a.id left join public.bookings b on b.id=s.booking_id and b.lesson_date>=p_month and b.lesson_date<(p_month+interval '1 month') group by a.id,a.name) r);
end $$;
revoke all on function public.admin_save_academy(jsonb,uuid),public.admin_academy_overview(),public.admin_assign_academy(uuid,uuid),public.admin_academy_monthly(date),public.get_booking_academy(uuid,uuid) from public,anon,authenticated;
grant execute on function public.admin_save_academy(jsonb,uuid),public.admin_academy_overview(),public.admin_assign_academy(uuid,uuid),public.admin_academy_monthly(date) to authenticated;
grant execute on function public.get_booking_academy(uuid,uuid) to anon,authenticated;

create index partner_academies_updated_by_idx on yata_private.partner_academies(updated_by);
create index instructor_academies_updated_by_idx on yata_private.instructor_academies(updated_by);
