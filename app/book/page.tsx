'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  MapPin,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

type Instructor = {
  id: string
  name: string
  area: string
  specialties: string[]
  vehicle: string
}

function tomorrowString() {
  const d = new Date()
  d.setDate(d.getDate() + 1)

  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')

  return `${y}-${m}-${day}`
}

function BookContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const instructorId = searchParams.get('instructor')

  const [instructor, setInstructor] =
    useState<Instructor | null>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [lessonType, setLessonType] = useState('')
  const [lessonDate, setLessonDate] =
    useState(tomorrowString())

  const [startTime, setStartTime] =
    useState('14:00')

  const [pickupText, setPickupText] =
    useState('')

  const amount = 90000

  useEffect(() => {
    async function loadInstructor() {
      if (!instructorId) {
        setError(
          '교관 정보가 없습니다. 교관을 다시 선택해주세요.'
        )
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('instructors')
        .select(
          'id, name, area, specialties, vehicle'
        )
        .eq('id', instructorId)
        .maybeSingle()

      if (error || !data) {
        setError(
          error?.message ||
            '교관 정보를 찾을 수 없습니다.'
        )
        setLoading(false)
        return
      }

      const item = data as Instructor

      setInstructor(item)

      setLessonType(
        item.specialties?.[0] || '운전 연수'
      )

      setPickupText(item.area)
      setLoading(false)
    }

    loadInstructor()
  }, [instructorId])

  const formattedAmount = useMemo(
    () => amount.toLocaleString('ko-KR'),
    [amount]
  )

  async function handleBooking() {
    if (!instructor) return

    setSaving(true)
    setError('')

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setSaving(false)
      router.push('/login')
      return
    }

    const { error: bookingError } =
      await supabase.from('bookings').insert({
        learner_id: user.id,
        instructor_id: instructor.id,
        lesson_type: lessonType,
        lesson_date: lessonDate,
        start_time: startTime,
        duration_minutes: 120,
        pickup_text:
          pickupText.trim() || instructor.area,
        amount,
        status: 'requested',
      })

    if (bookingError) {
      setError(
        `예약 저장 실패: ${bookingError.message}`
      )
      setSaving(false)
      return
    }

    router.push('/bookings?created=1')
  }

  if (loading) {
    return (
      <main className="container section pageTop narrow">
        <div className="panel">
          예약 정보를 준비하는 중...
        </div>
      </main>
    )
  }

  if (error && !instructor) {
    return (
      <main className="container section pageTop narrow">
        <div className="panel">
          <strong>
            예약을 시작할 수 없습니다.
          </strong>

          <p>{error}</p>
        </div>

        <Link
          href="/instructors"
          className="textLink"
          style={{ marginTop: 18 }}
        >
          ← 교관 다시 선택
        </Link>
      </main>
    )
  }

  if (!instructor) return null

  return (
    <section className="section container pageTop narrow">
      <div className="pageTitle">
        <span>예약</span>

        <h1>연수 예약하기</h1>

        <p>
          {instructor.name} 교관과 수업 정보를
          선택하세요.
        </p>
      </div>

      <div
        className="contentCard bookingSummary"
        style={{ marginTop: 22 }}
      >
        <div className="summaryRow">
          <span>교관</span>

          <strong>
            {instructor.name} 교관
          </strong>
        </div>

        <div className="summaryRow">
          <span>교육차량</span>

          <strong>
            {instructor.vehicle}
          </strong>
        </div>

        <label
          style={{
            display: 'block',
            marginTop: 22,
            fontWeight: 800,
          }}
        >
          교육 목적

          <select
            value={lessonType}
            onChange={(e) =>
              setLessonType(e.target.value)
            }
            style={{
              width: '100%',
              marginTop: 8,
              padding: 13,
              border: '1px solid #e9e9e9',
              borderRadius: 12,
              background: '#fff',
            }}
          >
            {(instructor.specialties?.length
              ? instructor.specialties
              : ['운전 연수']
            ).map((item) => (
              <option
                key={item}
                value={item}
              >
                {item}
              </option>
            ))}
          </select>
        </label>

        <label
          style={{
            display: 'block',
            marginTop: 18,
            fontWeight: 800,
          }}
        >
          <span
            style={{
              display: 'flex',
              gap: 6,
              alignItems: 'center',
            }}
          >
            <CalendarDays size={16} />
            날짜
          </span>

          <input
            type="date"
            value={lessonDate}
            min={tomorrowString()}
            onChange={(e) =>
              setLessonDate(e.target.value)
            }
            style={{
              width: '100%',
              marginTop: 8,
              padding: 13,
              border: '1px solid #e9e9e9',
              borderRadius: 12,
            }}
          />
        </label>

        <label
          style={{
            display: 'block',
            marginTop: 18,
            fontWeight: 800,
          }}
        >
          <span
            style={{
              display: 'flex',
              gap: 6,
              alignItems: 'center',
            }}
          >
            <Clock3 size={16} />
            시작 시간
          </span>

          <select
            value={startTime}
            onChange={(e) =>
              setStartTime(e.target.value)
            }
            style={{
              width: '100%',
              marginTop: 8,
              padding: 13,
              border: '1px solid #e9e9e9',
              borderRadius: 12,
              background: '#fff',
            }}
          >
            <option value="09:00">09:00</option>
            <option value="10:00">10:00</option>
            <option value="14:00">14:00</option>
            <option value="16:00">16:00</option>
            <option value="18:00">18:00</option>
          </select>
        </label>

        <label
          style={{
            display: 'block',
            marginTop: 18,
            fontWeight: 800,
          }}
        >
          <span
            style={{
              display: 'flex',
              gap: 6,
              alignItems: 'center',
            }}
          >
            <MapPin size={16} />
            시작 장소
          </span>

          <input
            value={pickupText}
            onChange={(e) =>
              setPickupText(e.target.value)
            }
            placeholder="예: 서울 강남구 역삼동"
            style={{
              width: '100%',
              marginTop: 8,
              padding: 13,
              border: '1px solid #e9e9e9',
              borderRadius: 12,
            }}
          />
        </label>

        <div className="summaryTotal">
          <span>예상 결제금액</span>

          <strong>
            {formattedAmount}원
          </strong>
        </div>

        {error && (
          <p
            style={{
              color: '#b42318',
              fontWeight: 700,
            }}
          >
            {error}
          </p>
        )}

        <button
          type="button"
          className="primaryBtn full"
          onClick={handleBooking}
          disabled={saving}
        >
          <CheckCircle2 size={18} />

          {saving
            ? '예약 저장 중...'
            : '예약 요청하기'}
        </button>

        <p className="helper">
          현재 테스트 버전에서는 예약 요청만
          저장합니다. 실제 결제는 이후 버전에서
          연결합니다.
        </p>
      </div>

      <Link
        href={`/instructors/${instructor.id}`}
        className="textLink"
      >
        ← 교관 상세로 돌아가기
      </Link>
    </section>
  )
}

export default function BookPage() {
  return (
    <Suspense
      fallback={
        <main className="container section pageTop narrow">
          <div className="panel">
            예약 정보를 준비하는 중...
          </div>
        </main>
      }
    >
      <BookContent />
    </Suspense>
  )
}