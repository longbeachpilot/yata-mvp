'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

export default function ResetPasswordPage() {
  const [loading, setLoading] = useState(true)
  const [accountEmail, setAccountEmail] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    let mounted = true
    const fragment = new URLSearchParams(window.location.hash.slice(1))
    const query = new URLSearchParams(window.location.search)
    if (fragment.has('error') || query.has('error')) {
      setError('복구 링크가 만료되었거나 유효하지 않습니다. 메일을 다시 요청해주세요.')
      // Discard rejected links; never display or retain their token values.
      window.history.replaceState(null, '', window.location.pathname)
    }
    async function refreshAccount() {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) throw sessionError
        if (!session) { if (mounted) setAccountEmail(null); return }
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError) throw userError
        if (mounted) setAccountEmail(user?.email || null)
      } catch {
        if (mounted) {
          setAccountEmail(null)
          setError('인증 상태를 확인하지 못했습니다. 연결을 확인하거나 복구 메일을 다시 요청해주세요.')
        }
      } finally { if (mounted) setLoading(false) }
    }
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      setTimeout(() => { if (mounted) void refreshAccount() }, 0)
    })
    void refreshAccount()
    return () => { mounted = false; listener.subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown(n => Math.max(0, n - 1)), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  async function sendEmail(e: React.FormEvent) {
    e.preventDefault()
    if (busy || cooldown > 0) return
    setBusy(true); setError(''); setMessage('')
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
      setMessage('가입된 이메일이면 복구 메일이 발송됩니다. 스팸함도 확인하고, 메일의 링크를 이 컴퓨터에서 열어주세요.')
      setCooldown(60)
    } catch (err) {
      setError(err instanceof Error ? err.message : '복구 메일을 보내지 못했습니다.')
    } finally { setBusy(false) }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    if (busy || !accountEmail) return
    setError(''); setMessage('')
    if (password.length < 12) { setError('새 비밀번호는 12자 이상 입력해주세요.'); return }
    if (password !== confirmation) { setError('두 비밀번호가 일치하지 않습니다.'); return }
    setBusy(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setPassword(''); setConfirmation(''); setSaved(true)
      setMessage('비밀번호가 변경되었습니다. 새 비밀번호로 로그인해주세요.')
      const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' })
      if (signOutError) setMessage('비밀번호는 변경되었습니다. 상단 로그아웃을 누른 뒤 새 비밀번호로 로그인해주세요.')
    } catch (err) {
      setError(err instanceof Error ? err.message : '비밀번호를 변경하지 못했습니다.')
    } finally { setBusy(false) }
  }

  async function useAnotherAccount() {
    setBusy(true); setError(''); setMessage('')
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' })
      if (error) throw error
      setAccountEmail(null); setPassword(''); setConfirmation('')
    } catch { setError('로그아웃하지 못했습니다. 잠시 후 다시 시도해주세요.') }
    finally { setBusy(false) }
  }

  return <main className="authShell"><section className="authCard">
    <div className="eyebrow">YA TA ACCOUNT</div>
    <h1 style={{fontSize:30}}>비밀번호 재설정</h1>
    {!isSupabaseConfigured ? <p role="alert">Supabase 연결 설정이 필요합니다.</p>
      : loading ? <p role="status">인증 상태를 확인하는 중...</p>
      : saved ? <Link className="primaryBtn full" href="/login">로그인으로 이동</Link>
      : accountEmail ? <>
        <p>변경할 계정: <strong style={{overflowWrap:'anywhere'}}>{accountEmail}</strong></p>
        <button type="button" className="ghostBtn" disabled={busy} onClick={useAnotherAccount}>다른 계정의 비밀번호 찾기</button>
        <form onSubmit={changePassword}>
          <label htmlFor="new-password">새 비밀번호</label>
          <input id="new-password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} placeholder="12자 이상" />
          <label htmlFor="confirm-password">새 비밀번호 확인</label>
          <input id="confirm-password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={confirmation} onChange={e => setConfirmation(e.target.value)} />
          <button className="primaryBtn full" style={{marginTop:24}} disabled={busy}>{busy ? '변경 중...' : '비밀번호 변경'}</button>
        </form>
      </> : <>
        <p>가입한 이메일로 복구 링크를 보내드립니다.</p>
        <form onSubmit={sendEmail}>
          <label htmlFor="recovery-email">가입 이메일</label>
          <input id="recovery-email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
          <button className="primaryBtn full" style={{marginTop:24}} disabled={busy || cooldown > 0}>{busy ? '전송 중...' : cooldown > 0 ? `${cooldown}초 후 재전송 가능` : '복구 메일 보내기'}</button>
        </form>
      </>}
    {error && <p role="alert" style={{color:'#b42318',overflowWrap:'anywhere'}}>{error}</p>}
    {message && <p role="status" style={{lineHeight:1.6}}>{message}</p>}
    <p className="authFoot"><Link href="/login">로그인 화면으로</Link></p>
  </section></main>
}
