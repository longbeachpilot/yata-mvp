export const SUPPORT_EMAIL = 'ssk04058@gmail.com'

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
