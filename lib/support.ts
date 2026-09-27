export const SUPPORT_EMAIL = 'ssk04058@gmail.com'
export const OPERATOR_NAME = '윤상준'
export const SUPPORT_AVAILABILITY = '상시 이메일 접수·응대 가능'
export const SUPPORT_RESPONSE_NOTE = '문의 내용과 확인 상황에 따라 답변까지 시간이 걸릴 수 있습니다.'

export function supportMailto(topic: 'general' | 'booking' | 'account' = 'general', bookingId?: string): string {
  const subjects = {
    general: '[YA TA] 이용 문의',
    booking: '[YA TA] 예약 문의',
    account: '[YA TA] 회원 탈퇴·개인정보 문의',
  }
  // Include only the booking reference, never account, contact or pickup details.
  const body = topic === 'booking' && bookingId
    ? `예약번호: ${bookingId}\n\n문의 내용:\n`
    : '문의 내용:\n'
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subjects[topic])}&body=${encodeURIComponent(body)}`
}
