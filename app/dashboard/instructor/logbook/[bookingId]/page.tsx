'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
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
  status: string
}

type Instructor = {
  id: string
  name: string
  vehicle: string
}

type SkillState = {
  basicControl: number
  laneKeeping: number
  laneChange: number
  parking: number
  highway: number
  nightDriving: number
}

export default function InstructorLogbookPage() {
  const params = useParams()
  const router = useRouter()

  const bookingId = params.bookingId as string

  const [booking, setBooking] = useState<Booking | null>(null)
  const [instructor, setInstructor] = useState<Instructor | null>(null)

  const [minutes, setMinutes] = useState(120)
  const [note, setNote] = useState('')
  const [nextGoal, setNextGoal] = useState('')

  const [skills, setSkills] = useState<SkillState>({
    basicControl: 50,
    laneKeeping: 50,
    laneChange: 50,
    parking: 50,
    highway: 50,
    nightDriving: 50,
  })

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        setError('')

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError || !user) {
          setError('로그인이 필요합니다.')
          return
        }

        const {
          data: instructorData,
          error: instructorError,
        } = await supabase
          .from('instructors')
          .select('id, name, vehicle')
          .eq('user_id', user.id)
          .maybeSingle()

        if (instructorError) {
          setError(
            `교관 정보를 불러오지 못했습니다: ${instructorError.message}`
          )
          return
        }

        if (!instructorData) {
          setError('현재 계정에 연결된 교관 프로필이 없습니다.')
          return
        }

        setInstructor(instructorData)

        const {
          data: bookingData,
          error: bookingError,
        } = await supabase
          .from('bookings')
          .select('*')
          .eq('id', bookingId)
          .eq('instructor_id', instructorData.id)
          .maybeSingle()

        if (bookingError) {
          setError(
            `예약 정보를 불러오지 못했습니다: ${bookingError.message}`
          )
          return
        }

        if (!bookingData) {
          setError('해당 예약을 찾을 수 없습니다.')
          return
        }

        if (bookingData.status !== 'completed') {
          setError('수업 완료된 예약만 Logbook을 작성할 수 있습니다.')
          return
        }

        setBooking(bookingData as Booking)

        if (bookingData.duration_minutes) {
          setMinutes(bookingData.duration_minutes)
        }
      } catch (err) {
        console.error(err)
        setError('Logbook 정보를 불러오는 중 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }

    if (bookingId) {
      loadData()
    }
  }, [bookingId])

  function updateSkill(
    key: keyof SkillState,
    value: number
  ) {
    setSkills((current) => ({
      ...current,
      [key]: value,
    }))
  }

  async function handleSave() {
    if (!booking || !instructor) return

    if (!note.trim()) {
      setMessage('교관 코멘트를 입력해주세요.')
      return
    }

    setSaving(true)
    setMessage('')

    try {
      const skillRows = [
        {
          skill_key: 'basic_control',
          score: skills.basicControl,
          note: null,
        },
        {
          skill_key: 'lane_keeping',
          score: skills.laneKeeping,
          note: null,
        },
        {
          skill_key: 'lane_change',
          score: skills.laneChange,
          note: null,
        },
        {
          skill_key: 'parking',
          score: skills.parking,
          note: null,
        },
        {
          skill_key: 'highway',
          score: skills.highway,
          note: null,
        },
        {
          skill_key: 'night_driving',
          score: skills.nightDriving,
          note: null,
        },
      ]

      const { error: skillError } = await supabase.rpc('create_lesson_log', {
        target_booking_id: booking.id,
        lesson_minutes: minutes,
        note_text: note.trim(),
        next_goal_text: nextGoal.trim(),
        skills: skillRows,
      })

      if (skillError) {
        setMessage(
          `숙련도 저장 실패: ${skillError.message}`
        )
        return
      }

      setMessage('Logbook이 저장되었습니다.')

      setTimeout(() => {
        router.push('/dashboard/instructor')
      }, 1000)
    } catch (err) {
      console.error(err)
      setMessage('Logbook 저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="container section pageTop">
        <div className="panel">
          Logbook 정보를 불러오는 중...
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="container section pageTop">
        <div className="panel">
          <strong>Logbook 오류</strong>
          <p>{error}</p>
        </div>
      </main>
    )
  }

  if (!booking || !instructor) {
    return null
  }

  const skillItems = [
    {
      key: 'basicControl' as const,
      label: '기본 조작',
      value: skills.basicControl,
    },
    {
      key: 'laneKeeping' as const,
      label: '차선 유지',
      value: skills.laneKeeping,
    },
    {
      key: 'laneChange' as const,
      label: '차선 변경',
      value: skills.laneChange,
    },
    {
      key: 'parking' as const,
      label: '주차',
      value: skills.parking,
    },
    {
      key: 'highway' as const,
      label: '고속도로',
      value: skills.highway,
    },
    {
      key: 'nightDriving' as const,
      label: '야간주행',
      value: skills.nightDriving,
    },
  ]

  return (
    <main className="container section pageTop">
      <div
        style={{
          maxWidth: 820,
          margin: '0 auto',
        }}
      >
        <div className="pageTitle">
          <span>YA TA LOGBOOK</span>

          <h1>수업 기록 작성</h1>

          <p>
            수업 내용을 기록하면 학습자의 YA TA Logbook에
            누적됩니다.
          </p>
        </div>

        <section
          className="panel"
          style={{
            marginTop: 28,
            marginBottom: 18,
          }}
        >
          <h3>{booking.lesson_type}</h3>

          <p>
            {booking.lesson_date} · {booking.start_time}
          </p>

          <p>
            {booking.pickup_text} ·{' '}
            {instructor.vehicle}
          </p>

          <p>
            담당 교관: {instructor.name}
          </p>
        </section>

        <section
          className="panel"
          style={{
            display: 'grid',
            gap: 24,
          }}
        >
          <label>
            <div
              style={{
                fontWeight: 700,
                marginBottom: 8,
              }}
            >
              실제 교육시간
            </div>

            <select
              value={minutes}
              onChange={(e) =>
                setMinutes(Number(e.target.value))
              }
              style={{
                width: '100%',
                padding: '13px',
                borderRadius: 10,
                border: '1px solid #ddd',
              }}
            >
              <option value={60}>1시간</option>
              <option value={90}>1시간 30분</option>
              <option value={120}>2시간</option>
              <option value={150}>2시간 30분</option>
              <option value={180}>3시간</option>
            </select>
          </label>

          <div>
            <h3>운전 숙련도</h3>

            <p style={{ color: '#777' }}>
              현재 수업을 기준으로 각 항목의 숙련도를
              평가해주세요.
            </p>

            <div
              style={{
                display: 'grid',
                gap: 18,
                marginTop: 18,
              }}
            >
              {skillItems.map((skill) => (
                <div key={skill.key}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: 7,
                    }}
                  >
                    <strong>{skill.label}</strong>
                    <span>{skill.value}%</span>
                  </div>

                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="10"
                    value={skill.value}
                    onChange={(e) =>
                      updateSkill(
                        skill.key,
                        Number(e.target.value)
                      )
                    }
                    style={{
                      width: '100%',
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          <label>
            <div
              style={{
                fontWeight: 700,
                marginBottom: 8,
              }}
            >
              교관 코멘트
            </div>

            <textarea
              value={note}
              onChange={(e) =>
                setNote(e.target.value)
              }
              rows={5}
              placeholder="예: 차선 유지가 안정적이며 차선 변경 전 후방 확인을 조금 더 연습할 필요가 있습니다."
              style={{
                width: '100%',
                padding: 14,
                borderRadius: 10,
                border: '1px solid #ddd',
                resize: 'vertical',
              }}
            />
          </label>

          <label>
            <div
              style={{
                fontWeight: 700,
                marginBottom: 8,
              }}
            >
              다음 수업 목표
            </div>

            <textarea
              value={nextGoal}
              onChange={(e) =>
                setNextGoal(e.target.value)
              }
              rows={3}
              placeholder="예: 평행주차와 자동차전용도로 진입 연습"
              style={{
                width: '100%',
                padding: 14,
                borderRadius: 10,
                border: '1px solid #ddd',
                resize: 'vertical',
              }}
            />
          </label>

          <button
            type="button"
            className="primaryBtn full"
            disabled={saving}
            onClick={handleSave}
          >
            {saving
              ? '저장 중...'
              : 'Logbook 저장'}
          </button>

          {message && (
            <p
              style={{
                margin: 0,
                fontWeight: 700,
              }}
            >
              {message}
            </p>
          )}
        </section>
      </div>
    </main>
  )
}
