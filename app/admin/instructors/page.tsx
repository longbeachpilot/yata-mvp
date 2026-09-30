'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
type Instructor = { id:string; name:string; area:string; vehicle:string; licenses:string[]; specialties:string[]; dual_brake:boolean; insurance_verified:boolean; active:boolean; created_at:string }

export default function AdminInstructorsPage() {
  const router = useRouter()
  const [items, setItems] = useState<Instructor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const load = useCallback(async () => {
    setLoading(true); setError(''); setItems([])
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (!user) { router.replace('/login?next=%2Fadmin%2Finstructors'); return }
      if (userError) throw userError
      const { data: isAdmin, error: adminError } = await supabase.rpc('is_admin')
      if (adminError) throw adminError
      if (isAdmin !== true) { setError('관리자 권한이 필요합니다.'); return }
      const { data, error: listError } = await supabase.rpc('admin_list_instructors')
      if (listError) throw listError
      setItems((data ?? []) as Instructor[])
    } catch { setError('교관 심사 목록을 불러오지 못했습니다. 다시 시도해주세요.') }
    finally { setLoading(false) }
  }, [router])
  useEffect(() => { void load() }, [load])
  async function review(i: Instructor, insurance: boolean, publish: boolean) {
    if (busy) return
    setBusy(i.id); setError('')
    try {
      const { error } = await supabase.rpc('admin_review_instructor', { target_instructor_id:i.id, verified_insurance:insurance, publish })
      if (error) throw error
      await load()
    } catch { setError('상태 변경 결과를 확인하지 못했습니다. 목록을 다시 확인해주세요.') }
    finally { setBusy(null) }
  }
  return <main className="container section pageTop">
    <div className="pageTitle"><span>YA TA ADMIN</span><h1>교관 승인 관리</h1>
      <Link className="ghostBtn" href="/admin/bookings">예약 운영 관리</Link>
      <Link className="ghostBtn" href="/admin/academies">제휴 학원·소속 교관 관리</Link><p>등록 정보와 제출 자료를 별도로 확인한 뒤 보험 확인 및 공개 여부를 결정하세요.</p>
      <button disabled={loading || !!busy} onClick={() => void load()}>{loading ? '확인 중...' : '목록 새로고침'}</button>
    </div>
    {error && <p role="alert" className="bookingError">{error}</p>}
    {loading ? <p role="status">교관 심사 목록을 불러오는 중...</p> : <div style={{display:'grid',gap:16,marginTop:24}}>
      {!error && items.length === 0 && <div className="panel">등록된 교관이 없습니다.</div>}
      {items.map(i => {
        const ready = i.insurance_verified && i.dual_brake && i.licenses.length > 0
        return <section className="panel" key={i.id}>
          <div className="panelHead"><div><h3>{i.name}</h3><p>{i.area} · {i.vehicle}</p></div><strong>{i.active ? '공개 중' : ready ? '공개 가능' : '검토 필요'}</strong></div>
          <p>자격 등록: {i.licenses.length ? i.licenses.join(', ') : '없음'}<br/>전문 분야: {i.specialties.length ? i.specialties.join(', ') : '없음'}<br/>보조브레이크 등록: {i.dual_brake ? '예' : '아니오'}<br/>보험 운영 확인: {i.insurance_verified ? '완료' : '미확인'}</p>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            <button disabled={!!busy} onClick={() => void review(i, true, i.active)}>보험 확인 완료</button>
            <button disabled={!!busy || !ready} className="primaryBtn" onClick={() => void review(i, true, true)}>확인 후 공개</button>
            <button disabled={!!busy} onClick={() => void review(i, false, false)}>보류·비공개</button>
          </div>
        </section>
      })}
    </div>}
  </main>
}
