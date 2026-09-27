export type BookingStatus = 'requested' | 'confirmed' | 'completed' | 'cancelled'
export const bookingStatusLabels: Record<BookingStatus, string> = {
  requested: '예약 요청', confirmed: '예약 확정', completed: '수업 완료', cancelled: '예약 취소',
}

export function formatCheckedAt(value: number | null): string {
  return value === null ? '' : new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(value)
}

export function bookingNoticeMailto(email: string | null, booking: {
  id: string; status: BookingStatus; lesson_date: string; start_time: string;
}): string | null {
  if (!email || /[\r\n]/.test(email)) return null
  const subject = `[YA TA] ${bookingStatusLabels[booking.status]} 안내`
  const body = [
    '안녕하세요. YA TA입니다.', '',
    `예약번호: ${booking.id}`,
    `예약 일정: ${booking.lesson_date} ${booking.start_time} (한국시간)`,
    `현재 상태: ${bookingStatusLabels[booking.status]}`, '',
    booking.status === 'requested' ? '현재 일정 확인 중이며, 아직 확정된 예약은 아닙니다.' :
    booking.status === 'confirmed' ? '예약이 확정되었습니다. 수업 전 만남 장소와 교육 제공 학원, 최종 금액 및 취소 조건을 확인해주세요.' :
    booking.status === 'cancelled' ? '예약이 취소되었습니다. 이미 결제한 금액은 결제한 학원에 환불 절차를 확인해주세요.' :
    '수업이 완료 처리되었습니다. 내 예약에서 수업 기록과 후기 작성 여부를 확인할 수 있습니다.', '',
    '예약 확인: https://yata-mvp-gules.vercel.app/bookings',
    '문의: ssk04058@gmail.com',
  ].join('\n')
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
