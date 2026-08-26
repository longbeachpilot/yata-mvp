'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, LocateFixed, Search, ShieldCheck } from 'lucide-react'
import { InstructorCard } from '@/components/instructor-card'
import { lessonTypes } from '@/lib/data'
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
  next_slot?: string | null
}

export default function HomePage() {
  const [instructors, setInstructors] = useState<Instructor[]>([])

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('instructors')
        .select('id,name,area,specialties,licenses,vehicle,rating,reviews,lessons,next_slot')
        .eq('active', true)
        .order('rating', { ascending: false })
        .limit(2)
      setInstructors((data ?? []) as Instructor[])
    }
    load()
  }, [])

  return (
    <>
      <section className="hero">
        <div className="container heroGrid">
          <div>
            <div className="eyebrow">내가 고르는 운전 교관</div>
            <h1>운전이 필요할 때,<br/><em>야 타.</em></h1>
            <p>면허 준비부터 장롱면허 탈출까지.<br/>내 일정과 목적에 맞는 교관과 교육차량을 직접 선택하세요.</p>
            <div className="searchPanel">
              <button type="button"><LocateFixed size={18}/><span><small>지역</small>내 주변</span></button>
              <button type="button"><span><small>교육 목적</small>원하는 연수 선택</span></button>
              <Link href="/instructors" className="primaryBtn"><Search size={18}/> 교관 찾기</Link>
            </div>
            <div className="trustRow"><span><ShieldCheck size={16}/> 교관 정보</span><span>교육 차량 정보</span><span>연수 기록</span></div>
          </div>
          <div className="heroMock">
            <div className="phoneCard">
              <div className="miniLabel">YA TA MVP</div>
              <div className="miniProfile"><div className="miniAvatar">🚙</div><div><strong>내가 고르는 교관</strong><span>지역 · 분야 · 차량 비교</span></div></div>
              <div className="routeBox"><span>📍 원하는 장소</span><strong>교관과 직접 예약 요청</strong><span>📘 수업 후 Logbook 기록</span></div>
              <button type="button">교관 찾아보기</button>
            </div>
          </div>
        </div>
      </section>

      <section className="section container">
        <div className="sectionHead"><div><span>무엇을 배우시나요?</span><h2>필요한 연수부터 선택하세요</h2></div></div>
        <div className="lessonGrid">{lessonTypes.map(([title, desc, icon]) => <Link href="/instructors" className="lessonCard" key={title}><b>{icon}</b><strong>{title}</strong><span>{desc}</span><ArrowRight size={17}/></Link>)}</div>
      </section>

      <section className="section softSection">
        <div className="container">
          <div className="sectionHead"><div><span>추천 교관</span><h2>등록된 교관을 만나보세요</h2></div><Link href="/instructors">전체보기 <ArrowRight size={16}/></Link></div>
          {instructors.length > 0 ? <div className="instructorList">{instructors.map(i => <InstructorCard key={i.id} instructor={i}/>)}</div> : <div className="panel">아직 공개된 교관이 없습니다. 교관 등록 후 이곳에 표시됩니다.</div>}
        </div>
      </section>

      <section className="section container splitBanner">
        <div><span className="eyebrow">YA TA LOGBOOK</span><h2>연수할수록 쌓이는<br/>나만의 운전 기록</h2><p>교관이 수업 내용, 숙련도와 다음 목표를 기록합니다. 교관이 바뀌어도 학습 흐름을 이어갈 수 있습니다.</p><Link className="textLink" href="/logbook">내 Logbook 보기 <ArrowRight size={16}/></Link></div>
        <div className="progressCard"><div className="progressTop"><strong>수업 후 자동 누적</strong><span>MVP</span></div>{[['기본 조작',100],['차선 변경',80],['주차',60],['고속도로',40]].map(([x,p]) => <div className="skill" key={x as string}><div><span>{x}</span><b>{p}%</b></div><div className="bar"><i style={{width:`${p}%`}}/></div></div>)}</div>
      </section>
    </>
  )
}
