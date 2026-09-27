'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { bookingNoticeMailto, bookingStatusLabels, formatCheckedAt, type BookingStatus } from '@/lib/bookings'
import { usePageRefresh } from '@/lib/use-page-refresh'
import { BookingHistory } from '@/components/booking-history'

type Booking = {
  id: string; lesson_type: string; lesson_date: string; start_time: string;
  duration_minutes: number; pickup_text: string; amount: number; status: BookingStatus;
  learner_name: string; learner_email: string | null;
  instructor_name: string; instructor_email: string | null;
  status_event_id: number; status_changed_at: string;
  learner_contacted_at: string | null; instructor_contacted_at: string | null;
}
const pageSize = 50
const timestamp = (value: string) => new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })

export default function AdminBookingsPage() {
  const router = useRouter()
  const [items, setItems] = useState<Booking[]>([])
  const [filter, setFilter] = useState('')
  const [page, setPage] = useState(0)
  const [hasNext, setHasNext] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [checkedAt, setCheckedAt] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const version = useRef(0)
  const load = useCallback(async () => {
    const request = ++version.current
    setRefreshing(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setItems([]); router.replace('/login?next=%2Fadmin%2Fbookings'); return }
      const { data, error } = await supabase.rpc('admin_list_bookings', {
        p_status: filter || null, p_limit: pageSize + 1, p_offset: page * pageSize,
      })
      if (request !== version.current) return
      if (error) {
        // Fail closed: never keep displaying sensitive contacts after an access failure.
        setItems([]); setHasNext(false)
        setError(error.message.includes('ADMIN_REQUIRED') ? '관리자 권한이 필요합니다.' : '예약을 불러오지 못했습니다. 다시 확인해주세요.')
        return
      }
      const rows = (data ?? []) as Booking[]
      setItems(rows.slice(0, pageSize)); setHasNext(rows.length > pageSize)
      setError(''); setCheckedAt(Date.now())
    } catch {
      if (request === version.current) { setItems([]); setHasNext(false); setError('연결을 확인하고 다시 시도해주세요.') }
    } finally {
      if (request === version.current) { setLoading(false); setRefreshing(false) }
    }
  }, [filter, page, router])
  useEffect(() => { void load(); return () => { version.current++ } }, [load])
  usePageRefresh(load, loading || !!busy)

  async function recordContact(booking: Booking, recipient: 'learner' | 'instructor') {
    if (busy || !window.confirm(`${recipient === 'learner' ? '학습자' : '교관'}에게 현재 예약 상태를 실제로 안내하셨나요?\n메일 발송은 별도입니다. 이 버튼은 운영자의 안내 기록만 남깁니다.`)) return
    setBusy(`${booking.id}:${recipient}`); setActionError('')
    try {
      const { error } = await supabase.rpc('admin_record_booking_contact', {
        target_booking_id: booking.id, expected_status_event_id: booking.status_event_id, recipient,
      })
      if (error) {
        setActionError(error.message.includes('BOOKING_CHANGED') ? '안내 도중 예약 상태가 변경되었습니다. 최신 상태를 확인하고 다시 안내해주세요.' : '안내 기록을 저장하지 못했습니다. 최신 상태를 확인해주세요.')
      }
      version.current++
      await load()
    } catch { setActionError('저장 결과를 확인하지 못했습니다. 새로고침 후 안내 기록을 확인해주세요.') }
    finally { setBusy(null) }
  }

  return <main className="container section pageTop">
    <div className="pageHead"><div><span>YA TA ADMIN</span><h1>예약 운영 관리</h1><p>예약 상태와 양쪽 안내 여부를 확인합니다.</p></div><Link className="ghostBtn" href="/admin/instructors">교관 승인 관리</Link></div>
    <section className="panel">
      <p>자동 이메일 알림은 제공하지 않습니다. 메일 초안을 열어 내용을 확인하고 직접 발송한 뒤 안내 기록을 남겨주세요. 발송·수신 여부가 자동으로 검증되지는 않습니다.</p>
      <p>상태가 변경되면 새 상태에 대한 안내가 필요합니다. 취소 기록은 환불 완료를 뜻하지 않습니다.</p>
      <div className="adminBookingFilters">
        <label>예약 상태<select value={filter} disabled={!!busy} onChange={e => { setItems([]); setLoading(true); setFilter(e.target.value); setPage(0) }}><option value="">전체</option>{Object.entries(bookingStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <button type="button" disabled={refreshing || !!busy} onClick={() => void load()}>{refreshing ? '확인 중...' : '예약 새로고침'}</button>
      </div>
      <p className="refreshStatus" aria-live="polite">{checkedAt ? `마지막 확인 ${formatCheckedAt(checkedAt)} (한국시간) · 화면이 열려 있으면 30초마다 확인` : '예약을 확인해주세요.'}</p>
      {!loading && !error && <p>현재 페이지 {items.length}건 · 양쪽 안내 기록이 모두 남지 않은 예약 {items.filter(b => !b.learner_contacted_at || !b.instructor_contacted_at).length}건</p>}
    </section>
    {(error || actionError) && <p className="bookingError" role="alert">{error || actionError}</p>}
    {loading ? <p>예약을 불러오는 중...</p> : !error && items.length === 0 ? <p className="panel">해당하는 예약이 없습니다.</p> : <div className="adminBookingList">{items.map(booking => <article className="panel adminBooking" key={booking.id}>
      <div className="panelHead"><h2>{booking.lesson_type}</h2><strong className="status">{bookingStatusLabels[booking.status]}</strong></div>
      <p>{booking.lesson_date} {booking.start_time} · {booking.duration_minutes}분 · {Number(booking.amount).toLocaleString()}원</p>
      <p>시작 장소: {booking.pickup_text}</p><p className="bookingReference">예약번호: {booking.id}</p>
      <div className="adminContacts">{(['learner', 'instructor'] as const).map(recipient => {
        const email = booking[`${recipient}_email`], contacted = booking[`${recipient}_contacted_at`]
        const href = bookingNoticeMailto(email, booking)
        return <section key={recipient}>
          <h3>{recipient === 'learner' ? '학습자' : '교관'} · {booking[`${recipient}_name`]}</h3>
          <p>{email || '이메일 확인 필요'}</p>
          <p>{contacted ? `운영자 안내 기록: ${timestamp(contacted)}` : '현재 상태에 대한 안내 기록 없음'}</p>
          <div className="adminContactActions">{href && <a className="ghostBtn" href={href}>메일 초안 열기</a>}<button type="button" disabled={!!busy || !!contacted || refreshing} onClick={() => void recordContact(booking, recipient)}>{contacted ? '안내 기록됨' : '안내한 뒤 기록하기'}</button></div>
        </section>
      })}</div>
      <BookingHistory key={`${booking.id}:${booking.status_event_id}:${booking.learner_contacted_at}:${booking.instructor_contacted_at}`} bookingId={booking.id}/>
    </article>)}</div>}
    <nav className="adminPagination" aria-label="예약 페이지"><button disabled={page === 0 || refreshing || !!busy} onClick={() => { setItems([]); setLoading(true); setPage(p => p - 1) }}>이전</button><span>{page + 1}페이지</span><button disabled={!hasNext || refreshing || !!busy} onClick={() => { setItems([]); setLoading(true); setPage(p => p + 1) }}>다음</button></nav>
  </main>
}
