'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, CalendarDays, Car, Check, Clock3, Info, MapPin, ShieldCheck, Star } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type Instructor = { id:string; name:string; area:string; specialties:string[]; licenses:string[]; vehicle:string; vehicle_year:number|null; transmission:string|null; dual_brake:boolean; rating:number|string; reviews:number; lessons:number; next_slot:string|null; intro:string|null; active:boolean }

export default function DetailPage(){
 const params=useParams(); const id=params.id as string
 const [instructor,setInstructor]=useState<Instructor|null>(null); const [loading,setLoading]=useState(true); const [error,setError]=useState('')
 useEffect(()=>{async function load(){setLoading(true);const {data,error}=await supabase.from('instructors').select('id,name,area,specialties,licenses,vehicle,vehicle_year,transmission,dual_brake,rating,reviews,lessons,next_slot,intro,active').eq('id',id).eq('active',true).maybeSingle();if(error)setError(error.message);else if(!data)setError('해당 교관을 찾을 수 없습니다.');else setInstructor(data as Instructor);setLoading(false)}if(id)load()},[id])
 if(loading)return <main className="container section pageTop"><div className="panel">교관 정보를 불러오는 중...</div></main>
 if(error||!instructor)return <main className="container section pageTop"><div className="panel"><strong>교관 정보를 불러오지 못했습니다.</strong><p>{error}</p><Link href="/instructors" className="primaryBtn">교관 목록으로</Link></div></main>
 const i=instructor; const hasMarketplaceHistory=i.lessons>0||i.reviews>0
 return <section className="section container pageTop">
  <Link href="/instructors" className="detailBack"><ArrowLeft size={16}/> 교관 목록</Link>
  <div className="detailGrid">
   <div>
    <div className="profileHero detailProfileHero"><div className="bigAvatar">{i.name?.charAt(0)||'야'}</div><div><div className="verifiedLabel"><ShieldCheck size={14}/> 승인 교관</div><h1>{i.name} 교관</h1><div className="rating"><Star size={16} fill="currentColor"/>{hasMarketplaceHistory?Number(i.rating).toFixed(2):'신규'}<span>{hasMarketplaceHistory?`후기 ${i.reviews} · 교육 ${i.lessons.toLocaleString()}회`:'첫 수업을 준비 중인 교관입니다'}</span></div><div className="muted"><MapPin size={15}/>{i.area}</div></div></div>
    <div className="contentCard"><h3>이 교관의 연수 분야</h3><div className="chips detailChips">{i.specialties?.map(x=><span key={x}>{x}</span>)}</div><p>{i.intro||'아직 등록된 소개가 없습니다.'}</p></div>
    <div className="contentCard"><h3>자격 및 신뢰 정보</h3><div className="checkList">{i.licenses?.map(x=><div key={x}><Check size={17}/><span>{x}</span></div>)}</div><div className="trustNotice"><ShieldCheck size={18}/><div><strong>YA TA 승인 교관</strong><span>공개 프로필은 운영 승인된 교관만 노출됩니다. 세부 자격·차량 서류는 공개하지 않습니다.</span></div></div></div>
    <div className="contentCard"><h3>교육 차량</h3><div className="vehicleDetail"><div>🚘</div><div><strong>{i.vehicle}</strong><span>{i.vehicle_year?`${i.vehicle_year}년식`:'연식 미등록'} · {i.transmission||'변속기 미등록'}</span><small><Car size={14}/>교관 등록 교육 차량</small></div></div><div className="vehicleTrustGrid"><div><strong>보조브레이크</strong><span>{i.dual_brake?'장착으로 등록':'확인 필요'}</span></div><div><strong>활동 지역</strong><span>{i.area}</span></div></div><div className="infoNotice"><Info size={15}/>예약 전 차량·보험 등 필요한 확인사항을 안내할 수 있도록 검증 체계를 고도화하고 있습니다.</div></div>
   </div>
   <aside className="bookingCard bookingCta"><span className="bookingEyebrow">2시간 연수</span><div className="price"><strong>90,000원</strong><span>/ 기본 2시간</span></div><div className="bookingQuickFacts"><div><CalendarDays size={17}/><span><small>날짜</small>예약 화면에서 선택</span></div><div><Clock3 size={17}/><span><small>가장 빠른 가능 시간</small>{i.next_slot||'교관과 일정 조율'}</span></div><div><MapPin size={17}/><span><small>기본 활동지역</small>{i.area}</span></div></div><Link className="primaryBtn full bookingPrimary" href={`/book?instructor=${i.id}`}>이 교관에게 예약 요청</Link><small className="centerText">교육 목적 · 날짜 · 시간 · 시작 장소를 다음 단계에서 선택합니다.</small></aside>
  </div>
 </section>
}
