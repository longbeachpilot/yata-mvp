'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Booking = {
  id: string
  learner_id: string
  instructor_id: string
  lesson_type: string
  lesson_date: string
  start_time: string
  duration_minutes: number
  pickup_text: string
  amount: number
  status:
    | 'requested'
    | 'confirmed'
    | 'completed'
    | 'cancelled'
  created_at: string
}

type InstructorProfile = {
  id: string
  name: string
  vehicle: string
  rating: number | string
}

export default function InstructorDashboard() {
  const router = useRouter()

  const [instructor, setInstructor] =
    useState<InstructorProfile | null>(null)

  const [bookings, setBookings] =
    useState<Booking[]>([])

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState('')

  const [updatingId, setUpdatingId] =
    useState<string | null>(null)

  async function loadDashboard() {
    try {
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
        return
      }

      if (!profile) {
        setError(
          '사용자 프로필을 찾을 수 없습니다.'
        )
        return
      }

      if (profile.role !== 'instructor') {
        router.replace('/instructors')
        return
      }

      const {
        data: instructorData,
        error: instructorError,
      } = await supabase
        .from('instructors')
        .select(
          'id, name, vehicle, rating'
        )
        .eq('user_id', user.id)
        .maybeSingle()

      if (instructorError) {
        setError(
          `교관 정보를 불러오지 못했습니다: ${instructorError.message}`
        )
        return
      }

      if (!instructorData) {
        router.replace('/instructor/register')
        return
      }

      setInstructor(instructorData)

      const {
        data: bookingData,
        error: bookingError,
      } = await supabase
        .from('bookings')
        .select('*')
        .eq(
          'instructor_id',
          instructorData.id
        )
        .order(
          'created_at',
          { ascending: false }
        )

      if (bookingError) {
        setError(
          `예약 정보를 불러오지 못했습니다: ${bookingError.message}`
        )
        return
      }

      setBookings(
        (bookingData ?? []) as Booking[]
      )
    } catch (err) {
      console.error(err)

      setError(
        '교관 대시보드를 불러오는 중 오류가 발생했습니다.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboard()
  }, [])

  async function updateBookingStatus(
    bookingId: string,
    status:
      | 'confirmed'
      | 'cancelled'
      | 'completed'
  ) {
    if (!instructor) return

    try {
      setUpdatingId(bookingId)

      const { error } = await supabase
        .from('bookings')
        .update({ status })
        .eq('id', bookingId)
        .eq(
          'instructor_id',
          instructor.id
        )

      if (error) {
        alert(
          `예약 상태 변경 실패: ${error.message}`
        )
        return
      }

      setBookings((current) =>
        current.map((booking) =>
          booking.id === bookingId
            ? {
                ...booking,
                status,
              }
            : booking
        )
      )
    } finally {
      setUpdatingId(null)
    }
  }

  const requestedCount =
    bookings.filter(
      (b) => b.status === 'requested'
    ).length

  const expectedSettlement =
    bookings
      .filter(
        (b) =>
          b.status === 'confirmed' ||
          b.status === 'completed'
      )
      .reduce(
        (sum, b) =>
          sum + Number(b.amount || 0),
        0
      )

  if (loading) {
    return (
      <main className="container section">
        <div className="panel">
          교관 권한을 확인하는 중...
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="container section">
        <div className="panel">
          <strong>
            교관 대시보드를 불러오지
            못했습니다.
          </strong>

          <p>{error}</p>

          <Link
            href="/"
            className="primaryBtn"
          >
            홈으로 돌아가기
          </Link>
        </div>
      </main>
    )
  }

  if (!instructor) return null

  return (
    <main className="container section">
      <div className="pageHead">
        <div>
          <span>
            INSTRUCTOR CENTER
          </span>

          <h1>
            {instructor.name} 교관
            대시보드
          </h1>
        </div>

        <Link
          className="primarySmall"
          href="/dashboard/instructor/profile"
        >
          프로필 관리
        </Link>
      </div>

      <div className="dashStats">
        <div>
          <span>예약 요청</span>
          <b>{requestedCount}</b>
          <small>
            확인 필요한 예약
          </small>
        </div>

        <div>
          <span>전체 예약</span>
          <b>{bookings.length}</b>
          <small>
            내 예약만 표시
          </small>
        </div>

        <div>
          <span>예상 정산</span>
          <b>
            {expectedSettlement.toLocaleString()}
            원
          </b>
          <small>
            테스트 금액 기준
          </small>
        </div>

        <div>
          <span>평점</span>
          <b>
            {Number(
              instructor.rating
            ).toFixed(2)}
          </b>
          <small>
            현재 프로필 기준
          </small>
        </div>
      </div>

      <div className="dashboardGrid">
        <section className="panel">
          <div className="panelHead">
            <h3>
              내 예약 관리
            </h3>
          </div>

          {bookings.length === 0 && (
            <p>
              아직 이 교관에게 들어온
              예약이 없습니다.
            </p>
          )}

          {bookings.map((booking) => (
            <div
              className="scheduleRow"
              key={booking.id}
            >
              <b>
                {booking.start_time}
              </b>

              <div>
                <strong>
                  {booking.lesson_type}
                </strong>

                <span>
                  {booking.lesson_date} ·{' '}
                  {booking.duration_minutes /
                    60}
                  시간 ·{' '}
                  {booking.pickup_text}
                </span>

                <span>
                  {instructor.vehicle} ·{' '}
                  {Number(
                    booking.amount
                  ).toLocaleString()}
                  원
                </span>

                <span>
                  상태:{' '}
                  {booking.status ===
                  'requested'
                    ? '예약 요청'
                    : booking.status ===
                        'confirmed'
                      ? '예약 확정'
                      : booking.status ===
                          'completed'
                        ? '수업 완료'
                        : '예약 취소'}
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                {booking.status ===
                  'requested' && (
                  <>
                    <button
                      disabled={
                        updatingId ===
                        booking.id
                      }
                      onClick={() =>
                        updateBookingStatus(
                          booking.id,
                          'confirmed'
                        )
                      }
                    >
                      확정
                    </button>

                    <button
                      disabled={
                        updatingId ===
                        booking.id
                      }
                      onClick={() =>
                        updateBookingStatus(
                          booking.id,
                          'cancelled'
                        )
                      }
                    >
                      거절
                    </button>
                  </>
                )}

                {booking.status ===
                  'confirmed' && (
                  <button
                    disabled={
                      updatingId ===
                      booking.id
                    }
                    onClick={() =>
                      updateBookingStatus(
                        booking.id,
                        'completed'
                      )
                    }
                  >
                    {updatingId ===
                    booking.id
                      ? '처리 중...'
                      : '수업 완료'}
                  </button>
                )}

                {booking.status ===
                  'completed' && (
                  <>
                    <button disabled>
                      수업 완료
                    </button>

                    <Link
                      href={`/dashboard/instructor/logbook/${booking.id}`}
                      className="primaryBtn"
                    >
                      Logbook 작성
                    </Link>
                  </>
                )}

                {booking.status ===
                  'cancelled' && (
                  <button disabled>
                    예약 취소
                  </button>
                )}
              </div>
            </div>
          ))}
        </section>

        <section className="panel">
          <div className="panelHead">
            <h3>
              내 교육차량
            </h3>

            <Link href="/dashboard/instructor/profile">
              수정
            </Link>
          </div>

          <div className="vehicleCard">
            <div className="vehicleArt">
              🚙
            </div>

            <div>
              <b>
                {instructor.vehicle}
              </b>

              <span>
                현재 등록 교육차량
              </span>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}