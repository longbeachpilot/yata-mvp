'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MapPin, Star, Car } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type Instructor = {
  id: string
  name: string
  area: string
  specialties: string[]
  licenses: string[]
  vehicle: string
  rating: number | string
  reviews: number
  lessons: number
  next_slot: string | null
  intro: string | null
  active: boolean
}

export default function InstructorsPage() {
  const [instructors, setInstructors] = useState<Instructor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadInstructors() {
      const { data, error } = await supabase
        .from('instructors')
        .select('id,name,area,specialties,licenses,vehicle,rating,reviews,lessons,next_slot,intro,active')
        .eq('active', true)
        .order('rating', { ascending: false })

      if (error) {
        setError(error.message)
      } else {
        setInstructors(data ?? [])
      }

      setLoading(false)
    }

    loadInstructors()
  }, [])

  if (loading) {
    return (
      <main className="container section pageTop">
        <div className="panel">
          교관 정보를 불러오는 중...
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="container section pageTop">
        <div className="panel">
          <strong>교관 조회 오류</strong>
          <p>{error}</p>
        </div>
      </main>
    )
  }

  return (
    <main className="container section pageTop">
      <div className="pageTitle">
        <span>교관 찾기</span>
        <h1>나에게 맞는 교관을 찾아보세요</h1>

        <p>
          <MapPin size={16} />
          서울 기준
        </p>
      </div>

      <div
        className="resultMeta"
        style={{ marginTop: 30, marginBottom: 16 }}
      >
        추천 교관 <strong>{instructors.length}명</strong>
      </div>

      <div style={{ display: 'grid', gap: 18 }}>
        {instructors.map((instructor) => (
          <Link
            key={instructor.id}
            href={`/instructors/${instructor.id}`}
            className="panel"
            style={{
              display: 'block',
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 20,
                flexWrap: 'wrap',
              }}
            >
              <div>
                <h2 style={{ marginBottom: 8 }}>
                  {instructor.name} 교관
                </h2>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: 8,
                  }}
                >
                  <Star size={16} />

                  <strong>
                    {Number(instructor.rating).toFixed(2)}
                  </strong>

                  <span>
                    후기 {instructor.reviews} · 교육{' '}
                    {instructor.lessons.toLocaleString()}회
                  </span>
                </div>

                <p>
                  <MapPin size={14} />
                  {instructor.area}
                </p>

                <p>
                  <Car size={14} />
                  {instructor.vehicle}
                </p>

                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    flexWrap: 'wrap',
                    marginTop: 12,
                  }}
                >
                  {instructor.specialties?.map((item) => (
                    <span
                      key={item}
                      style={{
                        padding: '6px 10px',
                        background: '#f5f5f5',
                        borderRadius: 20,
                        fontSize: 13,
                      }}
                    >
                      {item}
                    </span>
                  ))}
                </div>

                {instructor.intro && (
                  <p style={{ marginTop: 14 }}>
                    {instructor.intro}
                  </p>
                )}
              </div>

              <div>
                {instructor.next_slot && (
                  <>
                    <small>다음 가능 시간</small>
                    <strong
                      style={{
                        display: 'block',
                        marginTop: 4,
                      }}
                    >
                      {instructor.next_slot}
                    </strong>
                  </>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  )
}