'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { bookingStatusLabels, type BookingStatus } from '@/lib/bookings'

type Event = { id: number; event_type: string; status: BookingStatus; previous_status: BookingStatus | null; recipient_role: string | null; occurred_at: string }

export function BookingHistory({ bookingId }: { bookingId: string }) {
  const [events, setEvents] = useState<Event[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  async function toggle() {
    if (open) { setOpen(false); return }
    setOpen(true); setLoading(true); setError('')
    try {
      const { data, error } = await supabase.rpc('get_booking_history', { target_booking_id: bookingId })
      if (error) throw error
      setEvents((data ?? []) as Event[])
    } catch { setError('이력을 불러오지 못했습니다. 닫았다가 다시 확인해주세요.') }
    finally { setLoading(false) }
  }
  return <div className="bookingHistory">
    <button type="button" aria-expanded={open} onClick={() => void toggle()}>{open ? '변경 이력 닫기' : '변경 이력 보기'}</button>
    {open && <div className="bookingHistoryContent">
      {loading ? <p>이력을 불러오는 중...</p> : error ? <p role="alert">{error}</p> : events.length === 0 ? <p>기록된 변경 이력이 없습니다.</p> : <ol>
        {events.map(event => <li key={event.id}>
          <strong>{event.event_type === 'contact_recorded' ? `${event.recipient_role === 'learner' ? '학습자' : '교관'} 수동 안내 기록` : event.event_type === 'baseline' ? `이력 기록 시작 · ${bookingStatusLabels[event.status]}` : bookingStatusLabels[event.status]}</strong>
          <time dateTime={event.occurred_at}>{new Date(event.occurred_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</time>
        </li>)}
      </ol>}
    </div>}
  </div>
}
