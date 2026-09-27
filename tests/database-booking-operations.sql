BEGIN;
-- Run this entire file as ONE batch. All fixture data is rolled back.
DO $$
declare
  learner uuid := gen_random_uuid();
  operator uuid := gen_random_uuid();
  teacher uuid := gen_random_uuid();
  other_teacher uuid := gen_random_uuid();
  instructor uuid;
  other_instructor uuid;
  ongoing uuid;
  ended uuid;
  start_at timestamp := date_trunc('minute', now() at time zone 'Asia/Seoul') - interval '1 hour';
begin
  insert into auth.users(id,email,raw_user_meta_data) values
    (operator,operator||'@example.invalid','{"role":"learner","display_name":"Operations regression"}'),
    (learner,learner||'@example.invalid','{"role":"learner","display_name":"Operations regression"}'),
    (teacher,teacher||'@example.invalid','{"role":"instructor","display_name":"Operations regression"}'),
    (other_teacher,other_teacher||'@example.invalid','{"role":"instructor","display_name":"Operations regression"}');
  insert into public.admin_users(user_id) values(operator);
  perform set_config('yata.test.operator',operator::text,true);
  insert into public.instructors(user_id,name,area,specialties,licenses,vehicle,dual_brake,insurance_verified,active,base_price_2h)
    values(teacher,'Operations regression','서울 강남구',array['주차'],array['2종 보통'],'Test car',true,true,true,90000) returning id into instructor;
  insert into public.instructors(user_id,name,area,specialties,licenses,vehicle,dual_brake,insurance_verified,active,base_price_2h)
    values(other_teacher,'Operations regression','서울 강남구',array['주차'],array['2종 보통'],'Test car',true,true,true,90000) returning id into other_instructor;
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
DO $$
declare
  booking uuid;
  event_id bigint;
  later_event bigint;
  rejected boolean;
  log_id uuid;
  review_id uuid;
  ended uuid := current_setting('yata.test.ended')::uuid;
  skills jsonb := '[{"skill_key":"basic_control","score":60},{"skill_key":"lane_keeping","score":60},{"skill_key":"lane_change","score":60},{"skill_key":"parking","score":70},{"skill_key":"highway","score":50},{"skill_key":"night_driving","score":50}]';
begin
  assert not has_schema_privilege('authenticated','yata_private','USAGE'), 'private operations history cannot be read or forged directly';
  assert not has_function_privilege('anon','public.admin_list_bookings(text,integer,integer)','EXECUTE'), 'anonymous admin listing denied';
  assert not has_function_privilege('anon','public.get_booking_history(uuid)','EXECUTE'), 'anonymous history denied';
  perform set_config('request.jwt.claim.sub',current_setting('yata.test.learner'),true);
  booking := public.create_booking_request(current_setting('yata.test.instructor')::uuid,'주차',(now() at time zone 'Asia/Seoul')::date+2,'10:00',120,'Test pickup');
  assert (select count(*)=1 from public.get_booking_history(booking) where event_type='created' and status='requested'), 'request produces one history event';
  rejected := false;
  begin perform public.admin_list_bookings(); exception when others then if SQLERRM <> 'ADMIN_REQUIRED' then raise; end if; rejected:=true; end;
  assert rejected, 'ordinary learner cannot list customer emails';
  rejected := false;
  begin perform public.admin_record_booking_contact(booking,1,'learner'); exception when others then if SQLERRM <> 'ADMIN_REQUIRED' then raise; end if; rejected:=true; end;
  assert rejected, 'ordinary learner cannot mark operator contacts';
  perform set_config('request.jwt.claim.sub',current_setting('yata.test.other_teacher'),true);
  rejected := false;
  begin perform public.get_booking_history(booking); exception when others then if SQLERRM <> 'BOOKING_NOT_FOUND' then raise; end if; rejected:=true; end;
  assert rejected, 'unrelated user cannot see booking history';

  perform set_config('request.jwt.claim.sub',current_setting('yata.test.teacher'),true);
  assert (select count(*)=1 from public.get_booking_history(booking)), 'own instructor can read history';
  perform public.instructor_transition_booking(booking,'confirmed');
  perform set_config('request.jwt.claim.sub',current_setting('yata.test.operator'),true);
  select status_event_id into event_id from public.admin_list_bookings() where id=booking;
  assert event_id is not null, 'operator sees current event';
  assert (select learner_contacted_at is null and instructor_contacted_at is null and learner_email is not null and instructor_email is not null from public.admin_list_bookings() where id=booking), 'admin contact details and uncontacted state';
  perform public.admin_record_booking_contact(booking,event_id,'learner');
  perform public.admin_record_booking_contact(booking,event_id,'learner');
  perform public.admin_record_booking_contact(booking,event_id,'instructor');
  assert (select count(*)=2 from public.get_booking_history(booking) where event_type='contact_recorded'), 'contact writes are idempotent';
  assert (select learner_contacted_at is not null and instructor_contacted_at is not null from public.admin_list_bookings('confirmed') where id=booking), 'both contact records returned';

  perform set_config('request.jwt.claim.sub',current_setting('yata.test.learner'),true);
  assert (select count(*)=2 from public.get_booking_history(booking)), 'learner sees status changes but no internal contact records';
  perform public.cancel_my_booking(booking);
  perform set_config('request.jwt.claim.sub',current_setting('yata.test.operator'),true);
  select status_event_id into later_event from public.admin_list_bookings() where id=booking;
  assert later_event > event_id, 'cancellation records new status event';
  assert (select learner_contacted_at is null and instructor_contacted_at is null from public.admin_list_bookings() where id=booking), 'new state needs a fresh notice';
  rejected := false;
  begin perform public.admin_record_booking_contact(booking,event_id,'learner'); exception when others then if SQLERRM <> 'BOOKING_CHANGED' then raise; end if; rejected:=true; end;
  assert rejected, 'stale state cannot be marked notified';
  perform public.admin_record_booking_contact(booking,later_event,'learner');

  -- Completion, logbook and review are tested against the real RPCs, in this rolled-back transaction.
  perform set_config('request.jwt.claim.sub',current_setting('yata.test.learner'),true);
  rejected := false;
  begin perform public.submit_booking_review(ended,5,'아직 완료되지 않은 수업에 남기는 테스트 후기입니다.'); exception when others then rejected:=true; end;
  assert rejected, 'review before completion is denied';
  perform set_config('request.jwt.claim.sub',current_setting('yata.test.teacher'),true);
  perform public.instructor_transition_booking(ended,'completed');
  log_id := public.create_lesson_log(ended,120,'Operations regression note','다음 주차 연습',skills);
  assert log_id is not null, 'completed lesson accepts a logbook';
  rejected := false;
  begin perform public.create_lesson_log(ended,120,'Operations regression duplicate','다음 목표',skills); exception when others then if position('이미 이 수업의 Logbook' in SQLERRM)=0 then raise; end if; rejected:=true; end;
  assert rejected, 'duplicate logbook rejected';
  perform set_config('request.jwt.claim.sub',current_setting('yata.test.other_teacher'),true);
  rejected := false;
  begin perform public.submit_booking_review(ended,5,'다른 사람이 작성하려고 하는 테스트 후기입니다.'); exception when others then rejected:=true; end;
  assert rejected, 'unrelated review denied';
  assert (select count(*)=0 from public.lesson_logs where id=log_id), 'unrelated user cannot read the learner logbook';
  perform set_config('request.jwt.claim.sub',current_setting('yata.test.learner'),true);
  assert (select count(*)=1 from public.lesson_logs where id=log_id and instructor_note='Operations regression note'), 'learner sees own completed lesson log';
  assert (select count(*)=6 from public.skill_progress where lesson_log_id=log_id), 'learner sees all six skill scores';
  review_id := public.submit_booking_review(ended,5,'친절한 설명으로 주차를 차근차근 연습했습니다.');
  assert review_id is not null, 'learner can review completed lesson';
  rejected := false;
  begin perform public.submit_booking_review(ended,5,'중복 후기를 저장하지 않도록 확인하는 테스트입니다.'); exception when others then if SQLERRM <> 'REVIEW_ALREADY_EXISTS' then raise; end if; rejected:=true; end;
  assert rejected, 'duplicate review rejected';
  assert (select count(*)=1 from public.reviews where booking_id=ended), 'one review per completed lesson';
end $$;
RESET ROLE;
ROLLBACK;
