-- Keep confirmed bookings in conflict checks until their scheduled lesson has ended.
CREATE OR REPLACE FUNCTION public.instructor_transition_booking(target_booking_id uuid, next_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
declare
  booking public.bookings%rowtype;
  lesson_end timestamp;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if next_status is null or next_status not in ('confirmed', 'cancelled', 'completed') then
    raise exception '올바르지 않은 예약 상태입니다.';
  end if;

  select b.* into booking
  from public.bookings b
  join public.instructors i on i.id = b.instructor_id
  where b.id = target_booking_id and i.user_id = auth.uid()
  for update of b;

  if not found then
    raise exception '본인이 담당하는 예약만 변경할 수 있습니다.';
  end if;

  -- Preserve ownership checks and idempotent duplicate clicks.
  if booking.status = next_status then return; end if;

  if not (
    (booking.status = 'requested' and next_status in ('confirmed', 'cancelled'))
    or (booking.status = 'confirmed' and next_status in ('completed', 'cancelled'))
  ) then
    raise exception '현재 상태에서는 변경할 수 없습니다. 새로고침해주세요.';
  end if;

  if next_status = 'completed' then
    if booking.lesson_date is null or booking.start_time is null
       or booking.duration_minutes is null or booking.duration_minutes <= 0 then
      raise exception 'INVALID_LESSON_SCHEDULE';
    end if;
    lesson_end := booking.lesson_date + booking.start_time::time
                  + booking.duration_minutes * interval '1 minute';
    if lesson_end > (now() at time zone 'Asia/Seoul') then
      raise exception 'LESSON_NOT_FINISHED' using errcode = 'P0001';
    end if;
  end if;

  update public.bookings set status = next_status where id = target_booking_id;
end;
$function$;

-- Retain the existing API roles; anonymous callers may not execute this RPC.
REVOKE ALL ON FUNCTION public.instructor_transition_booking(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.instructor_transition_booking(uuid, text) TO authenticated, service_role;
