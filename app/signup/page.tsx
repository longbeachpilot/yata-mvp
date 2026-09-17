'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Role = 'learner' | 'instructor'

function safeNext(value: string | null) {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : null
}

function SignupContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = safeNext(searchParams.get('next'))

  const [role, setRole] = useState<Role | null>(next ? 'learner' : null)
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [agreed, setAgreed] = useState(false)

  async function handleSignup(event: React.FormEvent) {
    event.preventDefault()
    setMessage('')

    if (!role) {
      setMessage('소비자 또는 교관 중 하나를 선택해주세요.')
      return
    }
    if (!agreed) {
      setMessage('이용약관과 개인정보처리방침에 동의해주세요.')
      return
    }

    setLoading(true)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName.trim(), role, ...(role === 'learner' && next ? { post_auth_next: next } : {}) }, emailRedirectTo: `${window.location.origin}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ''}` },
    })

    if (error) {
      setMessage(`회원가입 실패: ${error.message}`)
      setLoading(false)
      return
    }

    if (data.session) {
      router.push(role === 'instructor' ? '/instructor/register' : (next ?? '/map'))
      router.refresh()
    } else {
      setMessage(
        role === 'instructor'
          ? '교관 계정 회원가입이 완료되었습니다. 이메일 인증 후 로그인하면 교관 등록으로 이동합니다.'
          : next
            ? '소비자 계정 회원가입이 완료되었습니다. 이메일 인증 후 이 화면의 로그인 버튼으로 돌아오면 선택한 예약 내용을 이어갈 수 있습니다.'
            : '소비자 계정 회원가입이 완료되었습니다. 이메일 인증 후 로그인해주세요.',
      )
    }
    setLoading(false)
  }

  const roleStyle = (selected: boolean): React.CSSProperties => ({
    width: '100%',
    textAlign: 'left',
    padding: 22,
    borderRadius: 18,
    border: selected ? '2px solid #ff4b12' : '1px solid #e5e5e5',
    background: selected ? '#fff4ef' : '#fff',
    cursor: 'pointer',
  })

  const loginHref = next ? `/login?next=${encodeURIComponent(next)}` : '/login'

  return (
    <main className="authShell">
      <section className="authCard wide">
        <div className="eyebrow">JOIN YA TA</div>
        <h1>{next ? '예약을 계속하려면 가입해주세요' : '야 타 시작하기'}</h1>
        <p>
          {next
            ? '선택한 교관과 장소는 그대로 유지됩니다.'
            : '먼저 어떤 방식으로 야 타를 이용할지 선택해주세요.'}
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))',
            gap: 14,
            marginTop: 24,
          }}
        >
          <button type="button" onClick={() => setRole('learner')} style={roleStyle(role === 'learner')}>
            <div style={{ fontSize: 30 }}>🚘</div>
            <h3>소비자로 이용할게요</h3>
            <p>교관을 비교하고 예약하며 수업 후 Logbook을 관리합니다.</p>
            {role === 'learner' && <b>✓ 소비자 선택됨</b>}
          </button>

          <button
            type="button"
            onClick={() => setRole('instructor')}
            style={roleStyle(role === 'instructor')}
          >
            <div style={{ fontSize: 30 }}>🧑‍🏫</div>
            <h3>교관으로 활동할게요</h3>
            <p>자격, 차량, 활동지역을 등록하고 예약과 수업을 관리합니다.</p>
            {role === 'instructor' && <b>✓ 교관 선택됨</b>}
          </button>
        </div>

        <form onSubmit={handleSignup} style={{ marginTop: 28, display: 'grid', gap: 14 }}>
          <label>
            이름
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required />
          </label>
          <label>
            이메일
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label>
            비밀번호
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={6}
              required
            />
          </label>
          <label style={{ display: 'flex', gap: 10 }}>
            <input
              type="checkbox"
              checked={agreed}
              onChange={(event) => setAgreed(event.target.checked)}
              required
              style={{ width: 18 }}
            />
            <span>
              <Link href="/terms" target="_blank">이용약관</Link> 및{' '}
              <Link href="/privacy" target="_blank">개인정보처리방침</Link>에 동의합니다.
            </span>
          </label>
          <button className="primaryBtn full" disabled={loading || !role || !agreed}>
            {loading
              ? '가입 중...'
              : role === 'instructor'
                ? '교관으로 가입하기'
                : role === 'learner'
                  ? '소비자로 가입하기'
                  : '이용 유형을 선택해주세요'}
          </button>
        </form>

        {message && <p style={{ marginTop: 16, fontWeight: 700 }}>{message}</p>}
        <p className="authFoot">
          이미 계정이 있나요? <Link href={loginHref}>로그인</Link>
        </p>
      </section>
    </main>
  )
}

export default function Signup() {
  return (
    <Suspense
      fallback={
        <main className="authShell">
          <section className="authCard">회원가입 화면을 준비하는 중...</section>
        </main>
      }
    >
      <SignupContent />
    </Suspense>
  )
}
