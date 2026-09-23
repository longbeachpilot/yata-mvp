'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { safeNext } from '@/lib/navigation'


function CallbackContent() {
  const router = useRouter()
  const sp = useSearchParams()
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function finish() {
      const code = sp.get('code')
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
        if (exchangeError) {
          if (active) setError('이메일 인증 정보를 확인하지 못했습니다. 인증 링크를 다시 확인해주세요.')
          return
        }
      }
      const { data, error } = await supabase.auth.getSession()
      if (!active) return
      if (error || !data.session) {
        setError('이메일 인증 정보를 확인하지 못했습니다. 인증을 완료한 뒤 로그인해주세요.')
        return
      }
      const metaNext = safeNext(data.session.user.user_metadata?.post_auth_next ?? null)
      const queryNext = safeNext(sp.get('next'))
      router.replace(queryNext ?? metaNext ?? '/map')
      router.refresh()
    }
    void finish().catch(() => { if (active) setError('인증 상태를 확인하지 못했습니다. 연결을 확인한 뒤 다시 로그인해주세요.') })
    return () => { active = false }
  }, [router, sp])

  if (error) return <main className="authShell"><section className="authCard"><h1>인증 확인이 필요합니다</h1><p>{error}</p><Link href="/login" className="primaryBtn full">로그인으로 이동</Link></section></main>
  return <main className="authShell"><section className="authCard"><h1>이메일 인증 확인 중</h1><p>선택한 예약 화면으로 안전하게 돌아가고 있습니다.</p></section></main>
}

export default function AuthCallbackPage() {
  return <Suspense fallback={<main className="authShell"><section className="authCard">인증 정보를 확인하는 중...</section></main>}><CallbackContent /></Suspense>
}

