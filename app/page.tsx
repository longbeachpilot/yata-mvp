'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, MapPin, Search, ShieldCheck } from 'lucide-react'
import { InstructorCard } from '@/components/instructor-card'
import { lessonTypes } from '@/lib/data'
import { supabase } from '@/lib/supabase'

type Instructor={id:string;name:string;area:string;specialties:string[];licenses:string[];vehicle:string;rating:number|string;reviews:number;lessons:number;next_slot?:string|null}
export default function HomePage(){
 const router=useRouter();const[instructors,setInstructors]=useState<Instructor[]>([]);const[region,setRegion]=useState('');const[purpose,setPurpose]=useState('')
 useEffect(()=>{supabase.from('instructors').select('id,name,area,specialties,licenses,vehicle,rating,reviews,lessons,next_slot').eq('active',true).order('rating',{ascending:false}).limit(2).then(({data})=>setInstructors((data??[]) as Instructor[]))},[])
 function startSearch(e:React.FormEvent){e.preventDefault();const p=new URLSearchParams();if(region.trim())p.set('q',region.trim());if(purpose)p.set('purpose',purpose);router.push(`/map${p.toString()?`?${p.toString()}`:''}`)}
 return <>
 <section className="hero"><div className="container heroGrid"><div><div className="eyebrow">내가 고르는 운전 교관</div><h1>운전이 필요할 때,<br/><em>야 타.</em></h1><p>면허 준비부터 장롱면허 탈출까지.<br/>지역과 연수 목적을 입력하고 방문 가능한 교관을 비교하세요.</p>
 <form className="searchPanel" onSubmit={startSearch}><label style={{display:'flex',alignItems:'center',gap:8,flex:1}}><MapPin size={18}/><span style={{width:'100%'}}><small>지역</small><input aria-label="연수 지역" value={region} onChange={e=>setRegion(e.target.value)} placeholder="강남역, 판교역, 역삼동" style={{border:0,outline:0,width:'100%',background:'transparent'}}/></span></label><label style={{flex:1}}><span><small>교육 목적</small><select aria-label="교육 목적" value={purpose} onChange={e=>setPurpose(e.target.value)} style={{border:0,outline:0,width:'100%',background:'transparent'}}><option value="">전체 연수</option>{lessonTypes.map(([title])=><option key={title} value={title}>{title}</option>)}</select></span></label><button className="primaryBtn" type="submit"><Search size={18}/>교관 찾기</button></form>
 <div className="trustRow"><span><ShieldCheck size={16}/> 교관 정보</span><span>교육 차량 정보</span><span>연수 기록</span></div></div><div className="heroMock"><div className="phoneCard"><div className="miniLabel">YA TA</div><div className="miniProfile"><div className="miniAvatar">🚙</div><div><strong>지역부터 찾는 방문 연수</strong><span>지역 · 분야 · 차량 · 가격 비교</span></div></div><div className="routeBox"><span>📍 원하는 장소 검색</span><strong>방문 가능한 교관 선택</strong><span>📘 수업 후 Logbook 기록</span></div><Link href="/map">지도에서 교관 찾기</Link></div></div></div></section>
 <section className="section container"><div className="sectionHead"><div><span>무엇을 배우시나요?</span><h2>필요한 연수부터 선택하세요</h2></div></div><div className="lessonGrid">{lessonTypes.map(([title,desc,icon])=><Link href={`/map?purpose=${encodeURIComponent(title)}`} className="lessonCard" key={title}><b>{icon}</b><strong>{title}</strong><span>{desc}</span><ArrowRight size={17}/></Link>)}</div></section>
 <section className="section softSection"><div className="container"><div className="sectionHead"><div><span>등록 교관</span><h2>교관 정보를 먼저 살펴보세요</h2></div><Link href="/map">지도에서 찾기 <ArrowRight size={16}/></Link></div>{instructors.length>0?<div className="instructorList">{instructors.map(i=><InstructorCard key={i.id} instructor={i}/>)}</div>:<div className="panel">아직 공개된 교관이 없습니다.</div>}</div></section>
 <section className="section container splitBanner"><div><span className="eyebrow">YA TA LOGBOOK</span><h2>연수할수록 쌓이는<br/>나만의 운전 기록</h2><p>교관이 수업 내용, 숙련도와 다음 목표를 기록합니다. 교관이 바뀌어도 학습 흐름을 이어갈 수 있습니다.</p><Link className="textLink" href="/logbook">내 Logbook 보기 <ArrowRight size={16}/></Link></div><div className="progressCard"><div className="progressTop"><strong>수업 후 누적</strong><span>LOGBOOK</span></div>{[['기본 조작',100],['차선 변경',80],['주차',60],['고속도로',40]].map(([x,p])=><div className="skill" key={x as string}><div><span>{x}</span><b>{p}%</b></div><div className="bar"><i style={{width:`${p}%`}}/></div></div>)}</div></section></>
}
