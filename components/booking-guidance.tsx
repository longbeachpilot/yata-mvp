import Link from 'next/link'

export function BookingGuidance() {
  return (
    <section className="bookingGuidance" aria-label="예약과 결제 안내">
      <strong>예약 요청 전 확인해주세요</strong>
      <ul>
        <li>교관이 일정을 확인한 뒤 ‘예약 확정’으로 바뀌어야 확정된 예약입니다.</li>
        <li>YA TA에서는 결제하지 않습니다. 확정 후 교육 제공 학원에 직접 결제하며, 결제 전 최종 금액·수업 범위·취소 및 환불 조건을 확인해주세요.</li>
        <li>YA TA의 예약 취소는 자동 환불을 뜻하지 않습니다. 이미 결제한 금액은 결제한 학원에 환불을 문의해주세요.</li>
      </ul>
      <Link href="/support">예약·결제 안내와 고객 문의 →</Link>
    </section>
  )
}
