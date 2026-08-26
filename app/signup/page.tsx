'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Signup() {
  const router = useRouter()
  const [role, setRole] = useState<'learner' | 'instructor'>('learner')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName.trim(), role } },
    })

    if (error) {
      setMessage(`회원가입 실패: ${error.message}`)
      setLoading(false)
      return
    }

    if (data.session) {
      router.push(role === 'instructor' ? '/instructor/register' : '/profile')
      router.refresh()
    } else {
      setMessage('회원가입이 완료되었습니다. 이메일 인증 후 로그인해주세요.')
    }
    setLoading(false)
  }

  return (
    <main className="authShell">
      <section className="authCard wide">
        <div className="eyebrow">JOIN YA TA</div>
        <h1>야 타 시작하기</h1>
        <p>운전을 배우거나, 교관으로 활동할 수 있습니다.</p>

        <div className="roleGrid">
          <button type="button" className={`roleCard ${role === 'learner' ? 'active' : ''}`} onClick={() => setRole('learner')}>
            <b>🚘</b><h3>운전을 배우고 싶어요</h3><p>교관을 비교하고 예약하며 내 연수 기록을 관리합니다.</p>
          </button>
          <button type="button" className={`roleCard ${role === 'instructor' ? 'active' : ''}`} onClick={() => setRole('instructor')}>
            <b>🧑‍🏫</b><h3>교관으로 활동할래요</h3><p>자격·차량·활동지역을 등록하고 내 수업을 운영합니다.</p>
          </button>
        </div>

        <form onSubmit={handleSignup} style={{ marginTop: 28 }}>
          <div style={{ display: 'grid', gap: 14 }}>
            <label>이름<input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required /></label>
            <label>이메일<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="example@email.com" required /></label>
            <label>비밀번호<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="6자 이상" required minLength={6} /></label>
            <button type="submit" className="primaryBtn full" disabled={loading}>{loading ? '가입 중...' : '야 타 시작하기'}</button>
          </div>
        </form>
        {message && <p style={{ marginTop: 16, fontWeight: 700 }}>{message}</p>}
        <p className="authFoot">이미 계정이 있나요? <Link href="/login">로그인</Link></p>
      </section>
    </main>
  )
}
