'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { safeNext } from '@/lib/navigation'


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
    if (loading) return
    setLoading(true)
    setMessage('')
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error || !data.user) { setMessage('로그인하지 못했습니다. 이메일·비밀번호와 이메일 인증 여부를 확인해주세요.'); return }
      const [{ data: profile, error: profileError }, { data: isAdmin }] = await Promise.all([
        supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle(),
        supabase.rpc('is_admin'),
      ])
      if (profileError || !profile) { setMessage('계정 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'); return }
      if (isAdmin) router.push(next ?? '/admin/instructors')
      else if (profile.role === 'instructor') {
        const { data: instructor, error: instructorError } = await supabase.from('instructors').select('id').eq('user_id', data.user.id).maybeSingle()
        if (instructorError) { setMessage('교관 정보를 불러오지 못했습니다. 다시 시도해주세요.'); return }
        router.push(instructor ? '/dashboard/instructor' : '/instructor/register')
      } else router.push(next ?? '/map')
      router.refresh()
    } catch { setMessage('연결을 확인한 뒤 다시 로그인해주세요.') }
    finally { setLoading(false) }
  }

  const signupHref = next ? `/signup?next=${encodeURIComponent(next)}` : '/signup'
  return <main className="authShell"><section className="authCard"><div className="eyebrow">WELCOME BACK</div><h1>야 타에 로그인</h1><p>{next ? '선택한 교관과 예약 내용을 유지한 채 로그인합니다.' : '예약, 연수 기록, 교관 활동을 한 곳에서 관리하세요.'}</p><form onSubmit={handleLogin}><label>이메일<input placeholder="name@example.com" type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required /></label><label>비밀번호<input placeholder="••••••••" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required /></label><button type="submit" className="primaryBtn full" disabled={loading}>{loading?'로그인 중...':'로그인'}</button></form>{message&&<p style={{marginTop:16,fontWeight:700}}>{message}</p>}<p className="authFoot"><Link href="/reset-password">비밀번호를 잊으셨나요?</Link></p><p className="authFoot">처음이신가요? <Link href={signupHref}>회원가입</Link></p></section></main>
}

export default function Login(){return <Suspense fallback={<main className="authShell"><section className="authCard">로그인 화면을 준비하는 중...</section></main>}><LoginContent/></Suspense>}

