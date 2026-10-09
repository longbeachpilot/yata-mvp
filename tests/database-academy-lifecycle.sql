BEGIN;
-- Execute as one batch: fixtures never commit and production locks are bounded.
SET LOCAL statement_timeout = '20s';
SET LOCAL lock_timeout = '3s';
DO $$
declare teacher uuid:=gen_random_uuid(); learner uuid:=gen_random_uuid(); admin_id uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); inst uuid;
begin
 insert into auth.users(id,email,raw_user_meta_data) values
 (teacher,teacher||'@example.invalid','{"role":"instructor"}'),(learner,learner||'@example.invalid','{"role":"learner"}'),(admin_id,admin_id||'@example.invalid','{"role":"learner"}'),(outsider,outsider||'@example.invalid','{"role":"learner"}');
 insert into public.admin_users(user_id) values(admin_id);
 insert into public.instructors(user_id,name,area,specialties,licenses,vehicle,dual_brake,insurance_verified,active,base_price_2h)
 values(teacher,'Academy regression','서울 강남구',array['주차'],array['2종 보통'],'Test car',true,true,true,90000) returning id into inst;
 insert into public.instructor_availability(instructor_id,lesson_date,start_time,is_available) values(inst,(now() at time zone 'Asia/Seoul')::date+2,'10:00',true),(inst,(now() at time zone 'Asia/Seoul')::date+2,'14:00',true);
 perform set_config('yata.test.teacher',teacher::text,true);perform set_config('yata.test.learner',learner::text,true);perform set_config('yata.test.admin',admin_id::text,true);perform set_config('yata.test.outsider',outsider::text,true);perform set_config('yata.test.inst',inst::text,true);
end $$;
SET LOCAL ROLE authenticated;
DO $$ begin assert public.get_booking_academy(current_setting('yata.test.inst')::uuid,null) is null; end $$;
DO $$
declare a uuid; booking uuid; denied boolean; payload jsonb; info jsonb; inst uuid:=current_setting('yata.test.inst')::uuid; lesson_day date:=(now() at time zone 'Asia/Seoul')::date+2;
begin
 assert not has_schema_privilege('authenticated','yata_private','USAGE'),'private schema still inaccessible';
 assert not has_function_privilege('anon','public.admin_save_academy(jsonb,uuid)','EXECUTE'),'anon cannot create partners';
 perform set_config('request.jwt.claim.sub',current_setting('yata.test.learner'),true);
 denied:=false;begin perform public.admin_academy_overview();exception when others then if SQLERRM<>'ADMIN_REQUIRED' then raise;end if;denied:=true;end;assert denied,'learner denied admin data';
 denied:=false;begin perform public.admin_save_academy('{"name":"forged"}');exception when others then if SQLERRM<>'ADMIN_REQUIRED' then raise;end if;denied:=true;end;assert denied,'learner cannot create partner';
 perform set_config('request.jwt.claim.sub',current_setting('yata.test.admin'),true);
 denied:=false;begin perform public.admin_save_academy('{"name":"incomplete","status":"active"}');exception when others then if SQLERRM<>'ACADEMY_CHECKS_REQUIRED' then raise;end if;denied:=true;end;assert denied,'incomplete partner activation denied';
 payload:=jsonb_build_object('name','Regression academy','address','Seoul','public_phone','02-000-0000','refund_policy','Agreed refund policy','business_number','000-00-00000','contact_email','private@example.invalid','notes','PRIVATE CONTRACT NOTE','mou_signed_on',lesson_day-3,'expires_on',lesson_day+30,'registration_checked',true,'insurance_checked',true,'status','active');
 
 -- Ordinary instructor: request, confirm, learner cancel, instructor cancel.
 perform set_config('request.jwt.claim.sub',current_setting('yata.test.learner'),true);
 booking:=public.create_booking_request(inst,'주차',lesson_day,'10:00',120,'Test pickup');
 assert public.get_booking_academy(null,booking) is null,'ordinary booking has no academy snapshot';
 perform set_config('request.jwt.claim.sub',current_setting('yata.test.teacher'),true);
 perform public.instructor_transition_booking(booking,'confirmed');
 assert (select status='confirmed' from public.bookings where id=booking),'ordinary confirmation saved';
 perform set_config('request.jwt.claim.sub',current_setting('yata.test.learner'),true);
 perform public.cancel_my_booking(booking);
 assert (select status='cancelled' from public.bookings where id=booking),'ordinary learner cancellation saved';
 booking:=public.create_booking_request(inst,'주차',lesson_day,'10:00',120,'Test pickup');
 perform set_config('request.jwt.claim.sub',current_setting('yata.test.teacher'),true);
 perform public.instructor_transition_booking(booking,'confirmed');
 perform public.instructor_transition_booking(booking,'cancelled');
 assert (select status='cancelled' from public.bookings where id=booking),'ordinary instructor cancellation saved';
 perform set_config('request.jwt.claim.sub',current_setting('yata.test.admin'),true);
 a:=public.admin_save_academy(payload);perform public.admin_assign_academy(inst,a);
 perform set_config('request.jwt.claim.sub',current_setting('yata.test.learner'),true);
 info:=public.get_booking_academy(inst,null);assert info->>'name'='Regression academy','public instructor provider shown';assert not(info?'notes') and not(info?'contact_email') and not(info?'business_number'),'private partner fields omitted';
 booking:=public.create_booking_request(inst,'주차',lesson_day,'10:00',120,'Test pickup');
 
 assert public.get_booking_academy(null,booking)->>'name'='Regression academy','snapshot saved';
 perform set_config('request.jwt.claim.sub',current_setting('yata.test.teacher'),true);
 perform public.instructor_transition_booking(booking,'confirmed');
 assert (select status='confirmed' from public.bookings where id=booking),'partner confirmation saved';
 perform set_config('request.jwt.claim.sub',current_setting('yata.test.learner'),true);
 perform public.cancel_my_booking(booking);
 assert (select status='cancelled' from public.bookings where id=booking),'partner learner cancellation saved';
 booking:=public.create_booking_request(inst,'주차',lesson_day,'10:00',120,'Test pickup');
 perform set_config('request.jwt.claim.sub',current_setting('yata.test.teacher'),true);
 perform public.instructor_transition_booking(booking,'confirmed');
 perform public.instructor_transition_booking(booking,'cancelled');
 assert (select status='cancelled' from public.bookings where id=booking),'partner instructor cancellation saved';
 perform set_config('request.jwt.claim.sub',current_setting('yata.test.learner'),true);
 assert public.get_booking_academy(null,booking)->>'name'='Regression academy','snapshot survives cancellation';
 perform set_config('request.jwt.claim.sub',current_setting('yata.test.outsider'),true);
 denied:=false;begin perform public.get_booking_academy(null,booking);exception when others then if SQLERRM<>'BOOKING_ACCESS_DENIED' then raise;end if;denied:=true;end;assert denied,'other learner cannot read booking provider';
 perform set_config('request.jwt.claim.sub',current_setting('yata.test.teacher'),true);
 denied:=false;begin perform public.admin_assign_academy(inst,null);exception when others then if SQLERRM<>'ADMIN_REQUIRED' then raise;end if;denied:=true;end;assert denied,'instructor cannot self-assign partner';
 perform set_config('request.jwt.claim.sub',current_setting('yata.test.admin'),true);
 perform public.admin_save_academy(payload||'{"name":"Renamed academy","status":"paused"}',a);
 assert public.get_booking_academy(null,booking)->>'name'='Regression academy','existing booking provider remains immutable';
 assert (public.get_booking_academy(inst,null)->>'booking_allowed')::boolean=false,'paused partner not available';
 perform set_config('request.jwt.claim.sub',current_setting('yata.test.learner'),true);
 denied:=false;begin perform public.create_booking_request(inst,'주차',lesson_day,'14:00',120,'Test pickup');exception when others then if SQLERRM<>'ACADEMY_UNAVAILABLE' then raise;end if;denied:=true;end;assert denied,'paused partner blocks new booking transaction';
 perform set_config('request.jwt.claim.sub',current_setting('yata.test.admin'),true);
 assert exists(select 1 from jsonb_array_elements(public.admin_academy_monthly(date_trunc('month',lesson_day)::date)) r where r->>'id'=a::text and (r->>'total')::int=2 and (r->>'cancelled')::int=2 and (r->>'completed_amount')::int=0),'monthly cancellation report correct; not paid revenue';
 perform public.admin_save_academy(payload||jsonb_build_object('expires_on',lesson_day-1),a);
 perform set_config('request.jwt.claim.sub',current_setting('yata.test.learner'),true);
 denied:=false;begin perform public.create_booking_request(inst,'주차',lesson_day,'14:00',120,'Test pickup');exception when others then if SQLERRM<>'ACADEMY_UNAVAILABLE' then raise;end if;denied:=true;end;assert denied,'cannot book beyond agreement expiry';
end $$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $$
declare denied boolean:=false;
begin
 assert public.get_booking_academy(null,null) is null,'public lookup has no private fallback';
 begin perform public.get_booking_academy(null,gen_random_uuid());exception when others then if SQLERRM<>'BOOKING_ACCESS_DENIED' then raise;end if;denied:=true;end;
 assert denied,'anonymous booking snapshot denied';
end $$;
RESET ROLE;
ROLLBACK;

