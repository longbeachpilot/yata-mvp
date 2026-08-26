'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  BadgeCheck,
  CalendarDays,
  Check,
  MapPin,
  ShieldCheck,
  Star,
  Car,
} from 'lucide-react'

import { supabase } from '@/lib/supabase'

type Instructor = {
  id: string
  name: string
  area: string
  specialties: string[]
  licenses: string[]
  license_number: string | null
  vehicle: string
  vehicle_year: number | null
  transmission: string | null
  dual_brake: boolean
  insurance_verified: boolean
  rating: number | string
  reviews: number
  lessons: number
  next_slot: string | null
  intro: string | null
  active: boolean
}

export default function DetailPage() {
  const params = useParams()
  const id = params.id as string

  const [instructor, setInstructor] = useState<Instructor | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadInstructor() {
      try {
        setLoading(true)
        setError('')

        const { data, error } = await supabase
          .from('instructors')
          .select(`
            id,
            name,
            area,
            specialties,
            licenses,
            license_number,
            vehicle,
            vehicle_year,
            transmission,
            dual_brake,
            insurance_verified,
            rating,
            reviews,
            lessons,
            next_slot,
            intro,
            active
          `)
          .eq('id', id)
          .eq('active', true)
          .maybeSingle()

        if (error) {
          setError(error.message)
          return
        }

        if (!data) {
          setError('해당 교관을 찾을 수 없습니다.')
          return
        }

        setInstructor(data as Instructor)
      } catch (err) {
        console.error(err)
        setError('교관 정보를 불러오는 중 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }

    if (id) {
      loadInstructor()
    }
  }, [id])

  if (loading) {
    return (
      <main className="container section pageTop">
        <div className="panel">
          교관 정보를 불러오는 중...
        </div>
      </main>
    )
  }

  if (error || !instructor) {
    return (
      <main className="container section pageTop">
        <div className="panel">
          <strong>교관 정보를 불러오지 못했습니다.</strong>
          <p>{error}</p>

          <Link
            href="/instructors"
            className="primaryBtn"
            style={{
              display: 'inline-flex',
              marginTop: 16,
            }}
          >
            교관 목록으로 돌아가기
          </Link>
        </div>
      </main>
    )
  }

  const i = instructor
  const initial = i.name?.charAt(0) || '야'

  return (
    <section className="section container pageTop">
      <div className="detailGrid">
        <div>
          <div className="profileHero">
            <div className="bigAvatar">
              {initial}
            </div>

            <div>
              <span className="verified">
                <BadgeCheck size={15} />
                등록 교관
              </span>

              <h1>{i.name} 교관</h1>

              <div className="rating">
                <Star
                  size={16}
                  fill="currentColor"
                />

                {Number(i.rating).toFixed(2)}

                <span>
                  후기 {i.reviews}개 · 교육{' '}
                  {i.lessons.toLocaleString()}회
                </span>
              </div>

              <div className="muted">
                <MapPin size={15} />
                {i.area}
              </div>
            </div>
          </div>

          <div className="contentCard">
            <h3>교관 소개</h3>

            <p>
              {i.intro || '아직 등록된 소개가 없습니다.'}
            </p>

            <div className="chips">
              {i.specialties?.map((item) => (
                <span key={item}>
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="contentCard">
            <h3>자격 및 교육 가능 종별</h3>

            <div className="checkList">
              {i.licenses?.map((item) => (
                <div key={item}>
                  <Check size={17} />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            {i.license_number && (
              <div
                style={{
                  marginTop: 18,
                  paddingTop: 16,
                  borderTop: '1px solid #eee',
                }}
              >
                <strong>자격증 번호</strong>

                <p
                  style={{
                    marginBottom: 0,
                    marginTop: 6,
                    color: '#666',
                  }}
                >
                  {i.license_number}
                </p>
              </div>
            )}
          </div>

          <div className="contentCard">
            <h3>교육 차량</h3>

            <div className="vehicleDetail">
              <div>
                🚘
              </div>

              <div>
                <strong>
                  {i.vehicle}
                </strong>

                <span>
                  {i.vehicle_year
                    ? `${i.vehicle_year}년식`
                    : '연식 미등록'}
                  {' · '}
                  {i.transmission || '변속기 미등록'}
                </span>

                <small>
                  <Car size={14} />
                  교육용 등록 차량
                </small>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 12,
                marginTop: 20,
              }}
            >
              <div
                style={{
                  padding: 14,
                  borderRadius: 12,
                  background: i.dual_brake
                    ? '#eef8f1'
                    : '#f7f7f7',
                }}
              >
                <strong>
                  보조브레이크
                </strong>

                <p
                  style={{
                    marginBottom: 0,
                    marginTop: 6,
                  }}
                >
                  {i.dual_brake
                    ? '장착 확인'
                    : '미확인'}
                </p>
              </div>

              <div
                style={{
                  padding: 14,
                  borderRadius: 12,
                  background: i.insurance_verified
                    ? '#eef8f1'
                    : '#f7f7f7',
                }}
              >
                <strong>
                  보험
                </strong>

                <p
                  style={{
                    marginBottom: 0,
                    marginTop: 6,
                  }}
                >
                  {i.insurance_verified
                    ? '확인 완료'
                    : '미확인'}
                </p>
              </div>
            </div>

            <div
              style={{
                marginTop: 18,
                padding: 14,
                borderRadius: 12,
                background: '#fff7f2',
              }}
            >
              <small
                style={{
                  display: 'flex',
                  gap: 6,
                  alignItems: 'center',
                }}
              >
                <ShieldCheck size={15} />

                자격·보험·교육차량 정보는 향후 운영자 검증 절차를 거쳐
                인증 배지로 표시할 예정입니다.
              </small>
            </div>
          </div>
        </div>

        <aside className="bookingCard">
          <div className="price">
            <strong>90,000원</strong>
            <span>/ 기본 2시간</span>
          </div>

          <label>
            교육 목적

            <select>
              {i.specialties?.map((item) => (
                <option
                  key={item}
                  value={item}
                >
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label>
            날짜

            <button
              type="button"
              className="inputLike"
            >
              <CalendarDays size={17} />
              날짜 선택
            </button>
          </label>

          <label>
            시작 장소

            <button
              type="button"
              className="inputLike"
            >
              <MapPin size={17} />
              {i.area}
            </button>
          </label>

          {i.next_slot && (
            <div
              style={{
                marginBottom: 16,
              }}
            >
              <small>
                가장 빠른 가능 시간
              </small>

              <strong
                style={{
                  display: 'block',
                  marginTop: 5,
                }}
              >
                {i.next_slot}
              </strong>
            </div>
          )}

          <Link
            className="primaryBtn full"
            href={`/book?instructor=${i.id}`}
          >
            예약하기
          </Link>

          <small className="centerText">
            예약 요청 후 교관 확인을 거쳐 확정됩니다.
          </small>
        </aside>
      </div>
    </section>
  )
}