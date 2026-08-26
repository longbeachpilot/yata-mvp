'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Skill = {
  skill_key: string
  score: number
  note: string | null
}

type Logbook = {
  id: string
  booking_id: string
  learner_id: string
  instructor_id: string
  minutes: number
  instructor_note: string
  next_goal: string | null
  created_at: string

  instructor: {
    name: string
    vehicle: string
  } | null

  booking: {
    lesson_type: string
    lesson_date: string
    start_time: string
    pickup_text: string
  } | null

  skills: Skill[]
}

const skillLabel: Record<string, string> = {
  basic_control: '기본 조작',
  lane_keeping: '차선 유지',
  lane_change: '차선 변경',
  parking: '주차',
  highway: '고속도로',
  night_driving: '야간주행',
}

export default function LogbookPage() {
  const router = useRouter()

  const [logs, setLogs] = useState<Logbook[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadLogbook() {
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
          setError('사용자 프로필을 찾을 수 없습니다.')
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
          .from('lesson_logs')
          .select(`
            id,
            booking_id,
            learner_id,
            instructor_id,
            minutes,
            instructor_note,
            next_goal,
            created_at,

            instructor:instructors(
              name,
              vehicle
            ),

            booking:bookings(
              lesson_type,
              lesson_date,
              start_time,
              pickup_text
            ),

            skills:skill_progress(
              skill_key,
              score,
              note
            )
          `)
          .eq('learner_id', user.id)
          .order('created_at', {
            ascending: false,
          })

        if (error) {
          setError(
            `Logbook을 불러오지 못했습니다: ${error.message}`
          )
          return
        }

        setLogs(
          (data ?? []) as unknown as Logbook[]
        )
      } catch (err) {
        console.error(err)

        setError(
          'Logbook을 불러오는 중 오류가 발생했습니다.'
        )
      } finally {
        setLoading(false)
      }
    }

    loadLogbook()
  }, [router])

  const totalMinutes = logs.reduce(
    (sum, log) =>
      sum + Number(log.minutes || 0),
    0
  )

  const totalHours = totalMinutes / 60

  function getAverageSkill(
    skillKey: string
  ) {
    const values = logs
      .flatMap(
        (log) => log.skills || []
      )
      .filter(
        (skill) =>
          skill.skill_key === skillKey
      )
      .map(
        (skill) =>
          Number(skill.score)
      )

    if (values.length === 0) {
      return null
    }

    const total = values.reduce(
      (sum, score) =>
        sum + score,
      0
    )

    return Math.round(
      total / values.length
    )
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

  if (error) {
    return (
      <main className="container section">
        <div className="panel">
          <strong>
            Logbook 오류
          </strong>

          <p>{error}</p>
        </div>
      </main>
    )
  }

  return (
    <main className="container section">
      <div className="pageHead">
        <div>
          <span>
            YA TA LOGBOOK
          </span>

          <h1>
            내 연수 기록
          </h1>
        </div>
      </div>

      <div className="dashStats">
        <div>
          <span>누적 연수</span>

          <b>
            {Number.isInteger(totalHours)
              ? `${totalHours}h`
              : `${totalHours.toFixed(1)}h`}
          </b>

          <small>
            실제 완료 수업 기준
          </small>
        </div>

        <div>
          <span>완료 수업</span>

          <b>
            {logs.length}
          </b>

          <small>
            Logbook 작성 완료
          </small>
        </div>

        <div>
          <span>
            주차 숙련도
          </span>

          <b>
            {getAverageSkill(
              'parking'
            ) !== null
              ? `${getAverageSkill(
                  'parking'
                )}%`
              : '-'}
          </b>

          <small>
            최근 기록 평균
          </small>
        </div>

        <div>
          <span>
            차선 변경
          </span>

          <b>
            {getAverageSkill(
              'lane_change'
            ) !== null
              ? `${getAverageSkill(
                  'lane_change'
                )}%`
              : '-'}
          </b>

          <small>
            최근 기록 평균
          </small>
        </div>
      </div>

      {logs.length === 0 && (
        <section
          className="panel"
          style={{
            marginTop: 24,
            textAlign: 'center',
            padding: 40,
          }}
        >
          <h3>
            아직 연수 기록이 없습니다.
          </h3>

          <p
            style={{
              color: '#777',
            }}
          >
            수업이 완료되고 교관이
            Logbook을 작성하면 이곳에
            기록이 쌓입니다.
          </p>
        </section>
      )}

      {logs.length > 0 && (
        <div
          style={{
            display: 'grid',
            gap: 20,
            marginTop: 24,
          }}
        >
          {logs.map((log) => (
            <section
              className="panel"
              key={log.id}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent:
                    'space-between',
                  alignItems:
                    'flex-start',
                  gap: 20,
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#777',
                    }}
                  >
                    {log.booking
                      ?.lesson_date ||
                      ''}
                  </span>

                  <h2
                    style={{
                      marginTop: 6,
                      marginBottom: 6,
                    }}
                  >
                    {log.booking
                      ?.lesson_type ||
                      '운전 연수'}
                  </h2>

                  <p>
                    {log.instructor
                      ?.name ||
                      '교관'}{' '}
                    교관 ·{' '}
                    {log.minutes / 60}
                    시간
                  </p>

                  {log.booking && (
                    <p
                      style={{
                        color:
                          '#777',
                      }}
                    >
                      {
                        log.booking
                          .start_time
                      }
                      {' · '}
                      {
                        log.booking
                          .pickup_text
                      }
                      {' · '}
                      {log
                        .instructor
                        ?.vehicle ||
                        '교육차량'}
                    </p>
                  )}
                </div>

                <div
                  style={{
                    padding:
                      '9px 13px',
                    borderRadius: 20,
                    background:
                      '#e8f7ee',
                    color:
                      '#16803a',
                    fontWeight: 700,
                  }}
                >
                  수업 완료
                </div>
              </div>

              <div
                style={{
                  marginTop: 22,
                  paddingTop: 20,
                  borderTop:
                    '1px solid #eee',
                }}
              >
                <h3>
                  숙련도
                </h3>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: 14,
                    marginTop: 14,
                  }}
                >
                  {(log.skills ||
                    []).map(
                    (skill) => (
                      <div
                        key={
                          skill.skill_key
                        }
                        style={{
                          padding: 14,
                          borderRadius:
                            12,
                          background:
                            '#f7f7f7',
                        }}
                      >
                        <div
                          style={{
                            display:
                              'flex',
                            justifyContent:
                              'space-between',
                            gap: 10,
                          }}
                        >
                          <strong>
                            {skillLabel[
                              skill
                                .skill_key
                            ] ||
                              skill.skill_key}
                          </strong>

                          <b>
                            {
                              skill.score
                            }
                            %
                          </b>
                        </div>

                        <div
                          style={{
                            height: 7,
                            background:
                              '#e5e5e5',
                            borderRadius:
                              20,
                            marginTop: 10,
                            overflow:
                              'hidden',
                          }}
                        >
                          <div
                            style={{
                              height:
                                '100%',
                              width: `${skill.score}%`,
                              background:
                                '#ff4b12',
                            }}
                          />
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>

              <div
                style={{
                  marginTop: 22,
                  paddingTop: 20,
                  borderTop:
                    '1px solid #eee',
                }}
              >
                <h3>
                  교관 코멘트
                </h3>

                <p
                  style={{
                    lineHeight: 1.7,
                  }}
                >
                  {
                    log.instructor_note
                  }
                </p>
              </div>

              {log.next_goal && (
                <div
                  style={{
                    marginTop: 18,
                    padding: 16,
                    borderRadius: 12,
                    background:
                      '#fff5ef',
                  }}
                >
                  <strong>
                    다음 수업 목표
                  </strong>

                  <p
                    style={{
                      marginBottom: 0,
                      marginTop: 6,
                    }}
                  >
                    {log.next_goal}
                  </p>
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </main>
  )
}