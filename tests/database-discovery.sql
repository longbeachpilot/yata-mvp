BEGIN;
-- Entire batch must be rolled back; synthetic users never become persistent.
create function pg_temp.expect_rejection(statement text, expected text) returns void language plpgsql as $$
begin
  begin execute statement;
  exception when others then
    if position(expected in SQLERRM)>0 then return; end if;
    raise exception 'Unexpected error: % (expected %)', SQLERRM, expected;
  end;
  raise exception 'Expected rejection: %', expected;
end $$;
DO $$ declare u uuid:=gen_random_uuid(); l uuid:=gen_random_uuid(); begin
  insert into auth.users(id,email,raw_user_meta_data) values
    (u,u||'@example.invalid','{"role":"instructor","display_name":"Discovery regression"}'),
    (l,l||'@example.invalid','{"role":"learner","display_name":"Discovery regression"}');
  perform set_config('yata.test.teacher',u::text,true);
  perform set_config('yata.test.learner',l::text,true);
  perform set_config('request.jwt.claim.sub',u::text,true);
end $$;
SET LOCAL ROLE authenticated;
DO $$ declare i uuid; begin
  i:=public.register_instructor('Discovery regression','서울 강남',array['주차'],array['2종 보통'],null,'Test car',2024,'자동',true,null);
  perform set_config('yata.test.instructor',i::text,true);
  assert (select count(*)=1 from public.instructor_service_regions where instructor_id=i and active and region_name='서울 강남'), 'registration creates discovery coverage';
  perform public.yata_save_my_instructor(i,'{"name":"Discovery regression","area":"경기 성남시 분당구, 서울 서초구","specialties":["주차"],"licenses":["2종 보통"],"vehicle":"Test car","vehicle_year":2024,"transmission":"자동","dual_brake":true}',null);
  assert (select count(*)=2 from public.instructor_service_regions where instructor_id=i and active), 'area edit updates both discovery regions';
  assert not exists(select 1 from public.instructor_service_regions where instructor_id=i and active and region_name='서울 강남'), 'old area is no longer searchable';
  assert not has_table_privilege('authenticated','public.lesson_logs','insert'), 'direct incomplete logbook insert denied';
  assert not has_table_privilege('authenticated','public.skill_progress','insert'), 'direct skill writes denied';
  assert not has_table_privilege('authenticated','public.reviews','insert'), 'reviews require validated RPC';
  insert into public.instructor_availability(instructor_id,lesson_date,start_time) values(i,(now() at time zone 'Asia/Seoul')::date+2,'10:00');
end $$;
select pg_temp.expect_rejection($q$insert into public.instructor_availability(instructor_id,lesson_date,start_time) values(current_setting('yata.test.instructor')::uuid,(now() at time zone 'Asia/Seoul')::date-1,'10:00')$q$,'PAST_SLOT');
select pg_temp.expect_rejection($q$insert into public.instructor_availability(instructor_id,lesson_date,start_time) values(current_setting('yata.test.instructor')::uuid,(now() at time zone 'Asia/Seoul')::date+2,'23:00')$q$,'INVALID_SLOT_TIME');
RESET ROLE;
update public.instructors set insurance_verified=true,active=true where id=current_setting('yata.test.instructor')::uuid;
SET LOCAL ROLE authenticated;
select set_config('request.jwt.claim.sub',current_setting('yata.test.learner'),true);
select public.create_booking_request(current_setting('yata.test.instructor')::uuid,'주차',(now() at time zone 'Asia/Seoul')::date+2,'10:00',120,'Test pickup');
select set_config('request.jwt.claim.sub',current_setting('yata.test.teacher'),true);
select pg_temp.expect_rejection($q$update public.instructor_availability set is_available=true where instructor_id=current_setting('yata.test.instructor')::uuid$q$,'SLOT_CONFLICT');
select pg_temp.expect_rejection($q$insert into public.instructor_availability(instructor_id,lesson_date,start_time) values(current_setting('yata.test.instructor')::uuid,(now() at time zone 'Asia/Seoul')::date+2,'11:00')$q$,'SLOT_CONFLICT');
select set_config('request.jwt.claim.sub',current_setting('yata.test.learner'),true);
select public.cancel_my_booking(id) from public.bookings where learner_id=auth.uid();
select set_config('request.jwt.claim.sub',current_setting('yata.test.teacher'),true);
DO $$ begin
  assert (select is_available from public.instructor_availability where instructor_id=current_setting('yata.test.instructor')::uuid), 'cancellation still releases the original slot';
end $$;
RESET ROLE;
select 'PASS registration, region edit, write privileges, slot validation, conflict and cancellation' as result;
ROLLBACK;
