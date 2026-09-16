'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Instructor = { id:string; name:string; area:string; licenses:string[]; license_number:string|null; vehicle:string; insurance_verified:boolean }

export default function Admin(){
  const router=useRouter()
  const [items,setItems]=useState<Instructor[]>([])
  const [stats,setStats]=useState({users:0,instructors:0,bookings:0,gmv:0})
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [working,setWorking]=useState<string|null>(null)

  async function load(){
    setLoading(true); setError('')
    const {data:{user}}=await supabase.auth.getUser()
    if(!user){router.replace('/login');return}
    const {data:profile}=await supabase.from('profiles').select('role').eq('id',user.id).maybeSingle()
    if(profile?.role!=='admin'){router.replace('/');return}
    const [users,instructors,bookings,pending]=await Promise.all([
      supabase.from('profiles').select('id',{count:'exact',head:true}),
      supabase.from('instructors').select('id',{count:'exact',head:true}).eq('approval_status','approved'),
      supabase.from('bookings').select('amount,status'),
      supabase.from('instructors').select('id,name,area,licenses,license_number,vehicle,insurance_verified').eq('approval_status','pending').order('created_at'),
    ])
    const firstError=users.error||instructors.error||bookings.error||pending.error
    if(firstError)setError(firstError.message)
    else{
      const rows=bookings.data||[]
      setStats({users:users.count||0,instructors:instructors.count||0,bookings:rows.length,gmv:rows.filter(b=>b.status!=='cancelled').reduce((sum,b)=>sum+Number(b.amount||0),0)})
      setItems((pending.data||[]) as Instructor[])
    }
    setLoading(false)
  }
  useEffect(()=>{load()},[])

  async function review(id:string,decision:'approved'|'rejected'){
    const reason=decision==='rejected'?window.prompt('반려 사유를 입력해주세요.'):null
    if(decision==='rejected'&&!reason)return
    setWorking(id)
    const {error}=await supabase.rpc('admin_review_instructor',{target_id:id,decision,reason})
    if(error)setError(error.message);else setItems(current=>current.filter(item=>item.id!==id))
    setWorking(null)
  }
  if(loading)return <main className="container section"><div className="panel">관리자 권한을 확인하는 중...</div></main>
  return <main className="container section">
    <div className="pageHead"><div><span>YA TA OPERATIONS</span><h1>관리자 콘솔</h1></div><span className="status confirmed">ADMIN</span></div>
    {error&&<div className="panel" style={{marginBottom:16,color:'#b42318'}}>{error}</div>}
    <div className="dashStats"><div><span>가입 사용자</span><b>{stats.users.toLocaleString()}</b><small>실제 가입 계정</small></div><div><span>승인 교관</span><b>{stats.instructors.toLocaleString()}</b><small>심사중 {items.length}</small></div><div><span>전체 예약</span><b>{stats.bookings.toLocaleString()}</b><small>누적 예약</small></div><div><span>예약 거래액</span><b>₩{stats.gmv.toLocaleString()}</b><small>취소 제외</small></div></div>
    <section className="panel"><div className="panelHead"><h3>교관 인증 심사</h3><button onClick={load}>새로고침</button></div>
      {items.length===0&&<p>심사 대기 중인 교관이 없습니다.</p>}
      {items.map(item=><div className="adminRow" key={item.id}><div className="avatarSmall">{item.name[0]}</div><div><strong>{item.name}</strong><span>{item.area} · {item.vehicle}</span></div><span>{item.licenses.join(', ')||'자격 미입력'} · {item.license_number||'번호 미입력'} · 보험 {item.insurance_verified?'확인':'미확인'}</span><div><button disabled={working===item.id} onClick={()=>review(item.id,'rejected')}>반려</button><button className="primarySmall" disabled={working===item.id} onClick={()=>review(item.id,'approved')}>승인</button></div></div>)}
    </section>
  </main>
}
