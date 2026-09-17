'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function safeNext(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null
  return value
}

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = safeNext(searchParams.get('next'))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error || !data.user) { setMessage(`로그인 실패: ${error?.message ?? '사용자 정보를 확인할 수 없습니다.'}`); setLoading(false); return }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle()
    const role = profile?.role ?? 'learner'
    if (role === 'instructor') {
      const { data: instructor } = await supabase.from('instructors').select('id').eq('user_id', data.user.id).maybeSingle()
      router.push(instructor ? '/dashboard/instructor' : '/instructor/register')
    } else {
      router.push(next ?? '/instructors')
    }
    router.refresh()
    setLoading(false)
  }

  const signupHref = next ? `/signup?next=${encodeURIComponent(next)}` : '/signup'
  return <main className="authShell"><section className="authCard"><div className="eyebrow">WELCOME BACK</div><h1>야 타에 로그인</h1><p>{next ? '선택한 교관과 예약 내용을 유지한 채 로그인합니다.' : '예약, 연수 기록, 교관 활동을 한 곳에서 관리하세요.'}</p><form onSubmit={handleLogin}><label>이메일<input placeholder="name@example.com" type="email" value={email} onChange={e=>setEmail(e.target.value)} required /></label><label>비밀번호<input placeholder="••••••••" type="password" value={password} onChange={e=>setPassword(e.target.value)} required /></label><button type="submit" className="primaryBtn full" disabled={loading}>{loading?'로그인 중...':'로그인'}</button></form>{message&&<p style={{marginTop:16,fontWeight:700}}>{message}</p>}<p className="authFoot">처음이신가요? <Link href={signupHref}>회원가입</Link></p></section></main>
}

export default function Login(){return <Suspense fallback={<main className="authShell"><section className="authCard">로그인 화면을 준비하는 중...</section></main>}><LoginContent/></Suspense>}
