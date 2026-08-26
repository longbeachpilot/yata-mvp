'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { CalendarDays } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type Booking = {
  id: string
  lesson_type: string
  lesson_date: string
  start_time: string
  duration_minutes: number
  pickup_text: string
  amount: number
  status: 'requested' | 'confirmed' | 'completed' | 'cancelled'
  instructor: {
    name: string
    vehicle: string
  } | null
}

const statusLabel: Record<Booking['status'], string> = {
  requested: '예약 요청',
  confirmed: '예약 확정',
  completed: '수업 완료',
  cancelled: '취소',
}

function BookingsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const created = searchParams.get('created') === '1'

  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadBookings() {
      setLoading(true)
      setError('')

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        router.replace('/login')
        return
      }

      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

      if (profileError) {
        setError(
          `사용자 권한을 확인하지 못했습니다: ${profileError.message}`
        )
        setLoading(false)
        return
      }

      if (!profile) {
        setError('사용자 프로필을 찾을 수 없습니다.')
        setLoading(false)
        return
      }

      if (profile.role === 'instructor') {
        router.replace('/dashboard/instructor')
        return
      }

      if (profile.role !== 'learner') {
        router.replace('/')
        return
      }

      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id,
          lesson_type,
          lesson_date,
          start_time,
          duration_minutes,
          pickup_text,
          amount,
          status,
          instructor:instructors(name, vehicle)
        `)
        .eq('learner_id', user.id)
        .order('lesson_date', { ascending: true })
        .order('start_time', { ascending: true })

      if (error) {
        setError(error.message)
      } else {
        setBookings((data || []) as unknown as Booking[])
      }

      setLoading(false)
    }

    loadBookings()
  }, [router])

  const getStatusStyle = (status: Booking['status']) => {
    if (status === 'confirmed') {
      return {
        background: '#e8f7ee',
        color: '#16803a',
      }
    }

    if (status === 'completed') {
      return {
        background: '#eeeeee',
        color: '#444',
      }
    }

    if (status === 'cancelled') {
      return {
        background: '#fff0f0',
        color: '#c62828',
      }
    }

    return {
      background: '#fff4e8',
      color: '#d96700',
    }
  }

  if (loading) {
    return (
      <main className="container section">
        <div className="panel">
          사용자 권한을 확인하는 중...
        </div>
      </main>
    )
  }

  return (
    <main className="container section">
      <div className="pageHead">
        <div>
          <span>BOOKINGS</span>
          <h1>내 예약</h1>
        </div>

        <Link href="/instructors" className="primaryBtn">
          교관 찾기
        </Link>
      </div>

      {created && (
        <div
          className="panel"
          style={{
            marginBottom: 16,
            borderColor: '#cdebd9',
          }}
        >
          <strong>예약 요청이 저장되었습니다.</strong>

          <p
            style={{
              marginBottom: 0,
              color: '#666',
            }}
          >
            교관 확인 후 예약 확정 단계로 진행됩니다.
          </p>
        </div>
      )}

      {error && (
        <div className="panel">
          <strong>
            예약 정보를 불러오지 못했습니다.
          </strong>

          <p>{error}</p>
        </div>
      )}

      {!error && bookings.length === 0 && (
        <div
          className="panel"
          style={{
            textAlign: 'center',
            padding: 40,
          }}
        >
          <CalendarDays
            size={34}
            style={{ marginBottom: 12 }}
          />

          <h3>아직 예약이 없습니다.</h3>

          <p style={{ color: '#777' }}>
            나에게 맞는 교관을 찾고 첫 연수를
            예약해보세요.
          </p>

          <Link
            href="/instructors"
            className="primaryBtn"
            style={{ marginTop: 8 }}
          >
            교관 찾기
          </Link>
        </div>
      )}

      {!error && bookings.length > 0 && (
        <div className="panel">
          {bookings.map((booking) => {
            const d = new Date(
              `${booking.lesson_date}T00:00:00`
            )

            const day = String(
              d.getDate()
            ).padStart(2, '0')

            const month = d
              .toLocaleString('en-US', {
                month: 'short',
              })
              .toUpperCase()

            return (
              <div
                className="bookingRow"
                key={booking.id}
              >
                <div className="dateBox">
                  <b>{day}</b>
                  <span>{month}</span>
                </div>

                <div>
                  <h3>
                    {booking.lesson_type}
                  </h3>

                  <p>
                    {booking.instructor?.name || '교관'}{' '}
                    교관 · {booking.start_time} ·{' '}
                    {booking.duration_minutes / 60}
                    시간 · {booking.pickup_text}
                  </p>

                  <p>
                    {booking.instructor?.vehicle ||
                      '교육차량'}{' '}
                    ·{' '}
                    {booking.amount.toLocaleString(
                      'ko-KR'
                    )}
                    원
                  </p>
                </div>

                <span
                  className="status"
                  style={getStatusStyle(
                    booking.status
                  )}
                >
                  {statusLabel[booking.status]}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}

export default function BookingsPage() {
  return (
    <Suspense
      fallback={
        <main className="container section">
          <div className="panel">
            사용자 권한을 확인하는 중...
          </div>
        </main>
      }
    >
      <BookingsContent />
    </Suspense>
  )
}