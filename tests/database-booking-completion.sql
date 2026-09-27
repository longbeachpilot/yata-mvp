BEGIN;
-- Run this entire file as ONE batch. All fixture data is rolled back.
DO $$
declare
  learner uuid := gen_random_uuid();
  teacher uuid := gen_random_uuid();
  other_teacher uuid := gen_random_uuid();
  instructor uuid;
  other_instructor uuid;
  ongoing uuid;
  ended uuid;
  start_at timestamp := date_trunc('minute', now() at time zone 'Asia/Seoul') - interval '1 hour';
begin
  insert into auth.users(id,email,raw_user_meta_data) values
    (learner,learner||'@example.invalid','{"role":"learner","display_name":"Completion regression"}'),
    (teacher,teacher||'@example.invalid','{"role":"instructor","display_name":"Completion regression"}'),
    (other_teacher,other_teacher||'@example.invalid','{"role":"instructor","display_name":"Completion regression"}');
  insert into public.instructors(user_id,name,area,specialties,licenses,vehicle,dual_brake,insurance_verified,active,base_price_2h)
    values(teacher,'Completion regression','서울 강남구',array['주차'],array['2종 보통'],'Test car',true,true,true,90000) returning id into instructor;
  insert into public.instructors(user_id,name,area,specialties,licenses,vehicle,dual_brake,insurance_verified,active,base_price_2h)
    values(other_teacher,'Completion regression','서울 강남구',array['주차'],array['2종 보통'],'Test car',true,true,true,90000) returning id into other_instructor;
  insert into public.instructor_availability(instructor_id,lesson_date,start_time,is_available) values
    (instructor,(now() at time zone 'Asia/Seoul')::date+2,'10:00',true),
    (instructor,(now() at time zone 'Asia/Seoul')::date+2,'11:00',true),
    (other_instructor,(now() at time zone 'Asia/Seoul')::date+2,'10:00',true);
  -- Historical/in-progress fixtures cannot be created through the future-only booking API.
  insert into public.bookings(learner_id,instructor_id,lesson_type,lesson_date,start_time,duration_minutes,pickup_text,amount,status)
    values(learner,instructor,'주차',start_at::date,to_char(start_at,'HH24:MI'),120,'Test pickup',90000,'confirmed') returning id into ongoing;
  insert into public.bookings(learner_id,instructor_id,lesson_type,lesson_date,start_time,duration_minutes,pickup_text,amount,status)
    values(learner,instructor,'주차',(now() at time zone 'Asia/Seoul')::date-1,'10:00',120,'Test pickup',90000,'confirmed') returning id into ended;
  perform set_config('yata.test.learner',learner::text,true);
  perform set_config('yata.test.teacher',teacher::text,true);
  perform set_config('yata.test.other_teacher',other_teacher::text,true);
  perform set_config('yata.test.instructor',instructor::text,true);
  perform set_config('yata.test.other_instructor',other_instructor::text,true);
  perform set_config('yata.test.ongoing',ongoing::text,true);
  perform set_config('yata.test.ended',ended::text,true);
end $$;

SET LOCAL ROLE authenticated;
-- Intentionally use a non-Korean session zone: the RPC must use Asia/Seoul explicitly.
SET LOCAL TIME ZONE 'America/Los_Angeles';
DO $$
declare
  booking uuid;
  replacement uuid;
  rejected boolean;
  instructor uuid := current_setting('yata.test.instructor')::uuid;
  lesson_day date := (now() at time zone 'Asia/Seoul')::date+2;
begin
  assert not has_function_privilege('anon','public.instructor_transition_booking(uuid,text)','EXECUTE'), 'anonymous RPC access remains denied';
  perform set_config('request.jwt.claim.sub',current_setting('yata.test.learner'),true);
  booking := public.create_booking_request(instructor,'주차',lesson_day,'10:00',120,'Test pickup');
  rejected := false;
  begin perform public.instructor_transition_booking(booking,'confirmed');
  exception when others then
    if position('본인이 담당하는 예약' in SQLERRM)=0 then raise; end if;
    rejected := true;
  end;
  assert rejected, 'learner cannot transition instructor bookings';

  perform set_config('request.jwt.claim.sub','',true);
  rejected := false;
  begin perform public.instructor_transition_booking(booking,'confirmed');
  exception when others then
    if position('로그인이 필요' in SQLERRM)=0 then raise; end if;
    rejected := true;
  end;
  assert rejected, 'missing authentication is rejected';

  perform set_config('request.jwt.claim.sub',current_setting('yata.test.teacher'),true);
  perform public.instructor_transition_booking(booking,'confirmed');
  rejected := false;
  begin perform public.instructor_transition_booking(booking,'completed');
  exception when others then
    if SQLERRM <> 'LESSON_NOT_FINISHED' then raise; end if;
    rejected := true;
  end;
  assert rejected, 'future lesson cannot be completed';
  assert (select status='confirmed' from public.bookings where id=booking), 'failed completion preserves confirmed status';
  rejected := false;
  begin perform public.instructor_transition_booking(current_setting('yata.test.ongoing')::uuid,'completed');
  exception when others then
    if SQLERRM <> 'LESSON_NOT_FINISHED' then raise; end if;
    rejected := true;
  end;
  assert rejected, 'ongoing lesson cannot be completed';

  perform set_config('request.jwt.claim.sub',current_setting('yata.test.learner'),true);
  rejected := false;
  begin perform public.create_booking_request(instructor,'주차',lesson_day,'11:00',120,'Test pickup');
  exception when others then
    if SQLERRM <> 'SLOT_CONFLICT' then raise; end if;
    rejected := true;
  end;
  assert rejected, 'overlapping instructor slot stays blocked after failed completion';
  rejected := false;
  begin perform public.create_booking_request(current_setting('yata.test.other_instructor')::uuid,'주차',lesson_day,'10:00',120,'Test pickup');
  exception when others then
    if SQLERRM <> 'LEARNER_CONFLICT' then raise; end if;
    rejected := true;
  end;
  assert rejected, 'overlapping learner booking stays blocked';

  perform set_config('request.jwt.claim.sub',current_setting('yata.test.other_teacher'),true);
  rejected := false;
  begin perform public.instructor_transition_booking(current_setting('yata.test.ended')::uuid,'completed');
  exception when others then
    if position('본인이 담당하는 예약' in SQLERRM)=0 then raise; end if;
    rejected := true;
  end;
  assert rejected, 'another instructor cannot complete an ended lesson';

  perform set_config('request.jwt.claim.sub',current_setting('yata.test.teacher'),true);
  perform public.instructor_transition_booking(current_setting('yata.test.ended')::uuid,'completed');
  perform public.instructor_transition_booking(current_setting('yata.test.ended')::uuid,'completed');
  assert (select status='completed' from public.bookings where id=current_setting('yata.test.ended')::uuid), 'ended lesson completes and duplicate completion is idempotent';
  rejected := false;
  begin perform public.instructor_transition_booking(current_setting('yata.test.ended')::uuid,'confirmed');
  exception when others then
    if position('현재 상태에서는 변경할 수 없습니다' in SQLERRM)=0 then raise; end if;
    rejected := true;
  end;
  assert rejected, 'completed lesson cannot return to confirmed';

  perform public.instructor_transition_booking(booking,'cancelled');
  assert (select status='cancelled' from public.bookings where id=booking), 'future confirmed booking can still be cancelled';
  perform set_config('request.jwt.claim.sub',current_setting('yata.test.learner'),true);
  replacement := public.create_booking_request(instructor,'주차',lesson_day,'10:00',120,'Test pickup');
  assert replacement is not null, 'cancelled slot becomes bookable again';
  perform set_config('request.jwt.claim.sub',current_setting('yata.test.teacher'),true);
  perform public.instructor_transition_booking(replacement,'cancelled');
  assert (select status='cancelled' from public.bookings where id=replacement), 'requested booking can still be rejected';
end $$;
RESET ROLE;
ROLLBACK;
