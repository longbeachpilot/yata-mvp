'use client'

import { useEffect, useMemo, useState } from 'react'
import { MapPin, Search, SlidersHorizontal, ShieldCheck } from 'lucide-react'
import { InstructorCard } from '@/components/instructor-card'
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
  const [query, setQuery] = useState('')
  const [specialty, setSpecialty] = useState('전체')

  useEffect(() => {
    async function loadInstructors() {
      const { data, error } = await supabase
        .from('instructors')
        .select('id,name,area,specialties,licenses,vehicle,rating,reviews,lessons,next_slot,intro,active')
        .eq('active', true)
        .order('rating', { ascending: false })

      if (error) setError(error.message)
      else setInstructors(data ?? [])
      setLoading(false)
    }
    loadInstructors()
  }, [])

  const specialties = useMemo(() => {
    const values = instructors.flatMap((item) => item.specialties ?? [])
    return ['전체', ...Array.from(new Set(values)).slice(0, 6)]
  }, [instructors])

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    return instructors.filter((item) => {
      const matchesSpecialty = specialty === '전체' || item.specialties?.includes(specialty)
      const haystack = [item.name, item.area, item.vehicle, item.intro, ...(item.specialties ?? []), ...(item.licenses ?? [])]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return matchesSpecialty && (!keyword || haystack.includes(keyword))
    })
  }, [instructors, query, specialty])

  if (loading) return <main className="container section pageTop"><div className="panel">교관 정보를 불러오는 중...</div></main>
  if (error) return <main className="container section pageTop"><div className="panel"><strong>교관 조회 오류</strong><p>{error}</p></div></main>

  return (
    <main className="container section pageTop">
      <div className="pageTitle">
        <span>INSTRUCTOR MARKETPLACE</span>
        <h1>나에게 맞는 교관을 직접 선택하세요</h1>
        <p><MapPin size={16}/> 지역, 교육 분야, 차량과 실제 수업 기록을 비교해 예약할 수 있습니다.</p>
      </div>

      <section className="marketSearch" aria-label="교관 검색">
        <div className="marketSearchInput">
          <Search size={19}/>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="지역, 교관명, 차량, 교육 분야 검색" aria-label="교관 검색어" />
        </div>
        <div className="marketFilterTitle"><SlidersHorizontal size={16}/> 교육 분야</div>
        <div className="filterChips">
          {specialties.map((item) => (
            <button key={item} type="button" className={specialty === item ? 'active' : ''} onClick={() => setSpecialty(item)}>{item}</button>
          ))}
        </div>
      </section>

      <div className="marketMeta">
        <div><strong>{filtered.length}명</strong>의 교관을 찾았습니다</div>
        <span><ShieldCheck size={15}/> 등록된 교관 정보</span>
      </div>

      {filtered.length > 0 ? (
        <div className="instructorList">
          {filtered.map((instructor) => <InstructorCard key={instructor.id} instructor={instructor}/>) }
        </div>
      ) : (
        <div className="panel emptyState"><strong>조건에 맞는 교관이 없습니다.</strong><p>검색어나 교육 분야를 바꿔 다시 찾아보세요.</p></div>
      )}
    </main>
  )
}
