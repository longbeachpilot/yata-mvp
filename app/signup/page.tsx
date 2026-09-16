'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Role = 'learner' | 'instructor'

export default function Signup() {
  const router = useRouter()

  const [role, setRole] = useState<Role | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [agreed, setAgreed] = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
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
      options: {
        data: {
          display_name: displayName.trim(),
          role,
        },
      },
    })

    if (error) {
      setMessage(`회원가입 실패: ${error.message}`)
      setLoading(false)
      return
    }

    if (data.session) {
      if (role === 'instructor') {
        router.push('/instructor/register')
      } else {
        router.push('/instructors')
      }

      router.refresh()
    } else {
      setMessage(
        role === 'instructor'
          ? '교관 계정 회원가입이 완료되었습니다. 이메일 인증 후 로그인하면 교관 등록으로 이동합니다.'
          : '소비자 계정 회원가입이 완료되었습니다. 이메일 인증 후 로그인해주세요.'
      )
    }

    setLoading(false)
  }

  const roleStyle = (selected: boolean): React.CSSProperties => ({
    width: '100%',
    textAlign: 'left',
    padding: 22,
    borderRadius: 18,
    border: selected
      ? '2px solid #ff4b12'
      : '1px solid #e5e5e5',
    background: selected ? '#fff4ef' : '#ffffff',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    boxShadow: selected
      ? '0 0 0 3px rgba(255,75,18,0.08)'
      : 'none',
  })

  return (
    <main className="authShell">
      <section className="authCard wide">
        <div className="eyebrow">JOIN YA TA</div>

        <h1>야 타 시작하기</h1>

        <p>
          먼저 어떤 방식으로 야 타를 이용할지 선택해주세요.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(230px, 1fr))',
            gap: 14,
            marginTop: 24,
          }}
        >
          <button
            type="button"
            onClick={() => {
              setRole('learner')
              setMessage('')
            }}
            aria-pressed={role === 'learner'}
            style={roleStyle(role === 'learner')}
          >
            <div
              style={{
                fontSize: 30,
                marginBottom: 10,
              }}
            >
              🚘
            </div>

            <h3
              style={{
                margin: '0 0 8px',
              }}
            >
              소비자로 이용할게요
            </h3>

            <p
              style={{
                margin: 0,
                color: '#666',
                lineHeight: 1.55,
              }}
            >
              교관을 찾아 비교하고 예약하며,
              수업 후 내 Logbook을 관리합니다.
            </p>

            {role === 'learner' && (
              <div
                style={{
                  marginTop: 14,
                  fontWeight: 800,
                  color: '#ff4b12',
                }}
              >
                ✓ 소비자 선택됨
              </div>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setRole('instructor')
              setMessage('')
            }}
            aria-pressed={role === 'instructor'}
            style={roleStyle(role === 'instructor')}
          >
            <div
              style={{
                fontSize: 30,
                marginBottom: 10,
              }}
            >
              🧑‍🏫
            </div>

            <h3
              style={{
                margin: '0 0 8px',
              }}
            >
              교관으로 활동할게요
            </h3>

            <p
              style={{
                margin: 0,
                color: '#666',
                lineHeight: 1.55,
              }}
            >
              자격, 차량, 활동지역을 등록하고
              예약과 수업을 직접 관리합니다.
            </p>

            {role === 'instructor' && (
              <div
                style={{
                  marginTop: 14,
                  fontWeight: 800,
                  color: '#ff4b12',
                }}
              >
                ✓ 교관 선택됨
              </div>
            )}
          </button>
        </div>

        {!role && (
          <div
            style={{
              marginTop: 14,
              padding: 12,
              borderRadius: 12,
              background: '#f7f7f7',
              color: '#666',
              fontSize: 14,
            }}
          >
            회원가입 전에 소비자 또는 교관을 선택해주세요.
          </div>
        )}

        <form
          onSubmit={handleSignup}
          style={{
            marginTop: 28,
          }}
        >
          <div
            style={{
              display: 'grid',
              gap: 14,
            }}
          >
            <label>
              이름

              <input
                type="text"
                value={displayName}
                onChange={(e) =>
                  setDisplayName(e.target.value)
                }
                required
              />
            </label>

            <label style={{display:'flex',alignItems:'flex-start',gap:10,fontWeight:500}}>
              <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} required style={{width:18,marginTop:2}} />
              <span><Link href="/terms" target="_blank">이용약관</Link> 및 <Link href="/privacy" target="_blank">개인정보처리방침</Link>에 동의합니다.</span>
            </label>

            <label>
              이메일

              <input
                type="email"
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
                placeholder="example@email.com"
                required
              />
            </label>

            <label>
              비밀번호

              <input
                type="password"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                placeholder="6자 이상"
                required
                minLength={6}
              />
            </label>

            <button
              type="submit"
              className="primaryBtn full"
              disabled={loading || !role || !agreed}
              style={{
                opacity:
                  loading || !role || !agreed ? 0.55 : 1,
                cursor:
                  loading || !role || !agreed
                    ? 'not-allowed'
                    : 'pointer',
              }}
            >
              {loading
                ? '가입 중...'
                : role === 'instructor'
                  ? '교관으로 가입하기'
                  : role === 'learner'
                    ? '소비자로 가입하기'
                    : '이용 유형을 선택해주세요'}
            </button>
          </div>
        </form>

        {message && (
          <p
            style={{
              marginTop: 16,
              fontWeight: 700,
            }}
          >
            {message}
          </p>
        )}

        <p className="authFoot">
          이미 계정이 있나요?{' '}
          <Link href="/login">
            로그인
          </Link>
        </p>
      </section>
    </main>
  )
}
