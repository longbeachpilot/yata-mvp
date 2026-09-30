'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
type Academy = { name?: string; address?: string; public_phone?: string; refund_policy?: string; booking_allowed: boolean; snapshot?: boolean }
export function AcademyInfo({ instructorId, bookingId, onReady }: { instructorId?: string; bookingId?: string; onReady?: (ready: boolean) => void }) {
 const [data,setData]=useState<Academy|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(false),[retry,setRetry]=useState(0)
 useEffect(()=>{let active=true;setLoading(true);setError(false);onReady?.(false)
  void (async()=>{try{const {data,error}=await supabase.rpc('get_booking_academy',{p_instructor_id:instructorId??null,p_booking_id:bookingId??null});if(!active)return;if(error)throw error;setData(data);onReady?.(!data||data.booking_allowed===true)}catch{if(active){setError(true);onReady?.(false)}}finally{if(active)setLoading(false)}})()
  return()=>{active=false}
 },[instructorId,bookingId,onReady,retry])
 return <section className="academyInfo" aria-label="수업 제공 학원"><strong>{bookingId?'예약 당시 수업 제공 학원':'수업 제공 학원'}</strong>
 {loading?<p role="status">학원 정보를 확인하는 중...</p>:error?<div role="alert"><p>학원 정보를 확인하지 못했습니다.</p><button type="button" className="ghostBtn" onClick={()=>setRetry(x=>x+1)}>학원 정보 다시 확인</button></div>:!data?<p>연결된 제휴 학원 정보가 없습니다. 예약 확정 전 교육 제공 학원과 결제·취소 조건을 확인해주세요.</p>:!data.booking_allowed?<p role="alert">제휴 학원이 현재 예약 준비 중이거나 운영 중지 상태입니다. 다른 교관을 선택해주세요.</p>:<><h3>{data.name}</h3><p>{data.address}</p><p>학원 문의 · {data.public_phone}</p><p>결제는 학원에 직접 진행합니다.</p><details><summary>취소·환불 안내 확인</summary><p className="academyPolicy">{data.refund_policy}</p></details></>}
 </section>
}
