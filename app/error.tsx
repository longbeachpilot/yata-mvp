 'use client'
import Link from 'next/link'
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return <main className="container section pageTop narrow"><section className="panel">
    <h1>화면을 불러오지 못했습니다</h1>
    <p role="alert">잠시 후 다시 시도해주세요. 예약 요청 중이었다면 내 예약에서 접수 여부를 먼저 확인해주세요.</p>
    <button className="primaryBtn" onClick={reset}>다시 시도</button>{' '}
    <Link href="/bookings">내 예약 확인</Link>
  </section></main>
}
