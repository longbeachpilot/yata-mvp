BEGIN;
-- Transactional regression suite. Run after the hardening DDL within BEGIN.
-- Synthetic users never leave this transaction; rollback is mandatory.
create function pg_temp.assert_true(ok boolean, description text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'ASSERTION FAILED: %', description; end if; end $$;
create function pg_temp.expect_error(statement text, expected text) returns void language plpgsql as $$
begin
  begin execute statement;
  exception when others then
    if position(expected in SQLERRM)>0 then return; end if;
    raise exception 'Unexpected error: % (expected %)', SQLERRM, expected;
  end;
  raise exception 'Expected rejection: %', expected;
end $$;

do $$ declare learner uuid:=gen_random_uuid(); teacher uuid:=gen_random_uuid(); other_teacher uuid:=gen_random_uuid(); i uuid; j uuid;
begin
  perform set_config('yata.test.learner',learner::text,true);
  perform set_config('yata.test.teacher',teacher::text,true);
  insert into auth.users(id,email,raw_user_meta_data) values
    (learner,learner||'@example.invalid','{"role":"learner","display_name":"Launch test"}'),
    (teacher,teacher||'@example.invalid','{"role":"instructor","display_name":"Launch test"}'),
    (other_teacher,other_teacher||'@example.invalid','{"role":"instructor","display_name":"Launch test"}');
  insert into public.instructors(user_id,name,area,specialties,licenses,vehicle,dual_brake,insurance_verified,active,base_price_2h)
    values(teacher,'Launch test','서울 강남구',array['주차'],array['2종 보통'],'Test car',true,true,true,90000) returning id into i;
  insert into public.instructors(user_id,name,area,specialties,licenses,vehicle,dual_brake,insurance_verified,active,base_price_2h)
    values(other_teacher,'Launch test','서울 강남구',array['주차'],array['2종 보통'],'Test car',true,true,true,90000) returning id into j;
  perform set_config('yata.test.instructor',i::text,true);
  perform set_config('yata.test.other_instructor',j::text,true);
  insert into public.instructor_availability(instructor_id,lesson_date,start_time,is_available)
    values(i,(now() at time zone 'Asia/Seoul')::date,'00:00',true),
    (i,(now() at time zone 'Asia/Seoul')::date+2,'10:00',true),
    (i,(now() at time zone 'Asia/Seoul')::date+2,'11:00',true),
    (i,(now() at time zone 'Asia/Seoul')::date+2,'23:00',true),
    (j,(now() at time zone 'Asia/Seoul')::date+2,'10:00',true);
  perform set_config('request.jwt.claim.sub',learner::text,true);
end $$;
set local role authenticated;
select pg_temp.assert_true(not has_column_privilege('authenticated','public.profiles','role','UPDATE'),'profile role is protected');
select pg_temp.assert_true(has_column_privilege('authenticated','public.profiles','display_name','UPDATE'),'profile name remains editable');
update public.profiles set display_name='Updated launch test' where id=auth.uid();
select pg_temp.expect_error('update public.profiles set role=''admin'' where id=auth.uid()', 'permission denied');
select pg_temp.expect_error($q$select public.create_booking_request(current_setting('yata.test.instructor')::uuid,'주차',(now() at time zone 'Asia/Seoul')::date,'00:00',120,'Test pickup')$q$,'PAST_TIME');
select pg_temp.expect_error($q$select public.create_booking_request(current_setting('yata.test.instructor')::uuid,'주차',(now() at time zone 'Asia/Seoul')::date+2,'10:00',480,'Test pickup')$q$,'INVALID_DURATION');
select pg_temp.expect_error($q$select public.create_booking_request(current_setting('yata.test.instructor')::uuid,'주차',(now() at time zone 'Asia/Seoul')::date+2,'23:00',120,'Test pickup')$q$,'INVALID_TIME');
select public.create_booking_request(current_setting('yata.test.instructor')::uuid,'주차',(now() at time zone 'Asia/Seoul')::date+2,'10:00',120,'Test pickup');
select pg_temp.assert_true((select amount=90000 and duration_minutes=120 from public.bookings where learner_id=auth.uid()),'server sets the two-hour price');
select pg_temp.expect_error($q$select public.create_booking_request(current_setting('yata.test.instructor')::uuid,'주차',(now() at time zone 'Asia/Seoul')::date+2,'10:00',120,'Test pickup')$q$,'SLOT_UNAVAILABLE');
select pg_temp.expect_error($q$select public.create_booking_request(current_setting('yata.test.instructor')::uuid,'주차',(now() at time zone 'Asia/Seoul')::date+2,'11:00',120,'Test pickup')$q$,'SLOT_CONFLICT');
select pg_temp.expect_error($q$select public.create_booking_request(current_setting('yata.test.other_instructor')::uuid,'주차',(now() at time zone 'Asia/Seoul')::date+2,'10:00',120,'Test pickup')$q$,'LEARNER_CONFLICT');
select pg_temp.expect_error($q$select public.yata_get_my_credential(current_setting('yata.test.instructor')::uuid)$q$,'본인 자격정보');
select pg_temp.expect_error($q$select public.admin_review_instructor(current_setting('yata.test.instructor')::uuid,true,true)$q$,'ADMIN_REQUIRED');
select set_config('request.jwt.claim.sub',current_setting('yata.test.teacher'),true);
select public.yata_save_my_instructor(current_setting('yata.test.instructor')::uuid,
  '{"name":"Launch test","area":"서울 강남구","specialties":["주차"],"licenses":["2종 보통"],"vehicle":"Changed car","vehicle_year":null,"transmission":null,"dual_brake":true,"insurance_verified":true}',null);
select pg_temp.assert_true((select not insurance_verified and not active from public.instructors where id=current_setting('yata.test.instructor')::uuid),'safety changes require review');
select public.yata_save_my_instructor(current_setting('yata.test.instructor')::uuid,
  '{"name":"Launch test","area":"서울 강남구","specialties":["주차"],"licenses":["2종 보통"],"vehicle":"Changed car","vehicle_year":null,"transmission":null,"dual_brake":true,"insurance_verified":true}',null);
select pg_temp.assert_true((select not insurance_verified and not active from public.instructors where id=current_setting('yata.test.instructor')::uuid),'instructor cannot self-verify insurance');
reset role;

ROLLBACK;
