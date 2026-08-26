'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type ProfileData = {
  id: string
  role: 'learner' | 'instructor' | 'admin'
  display_name: string
  phone: string | null
  avatar_url: string | null
  home_area: string | null
}

export default function Profile() {
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [phone, setPhone] = useState('')
  const [homeArea, setHomeArea] = useState('')

  const loadProfile = async () => {
    setLoading(true)
    setError('')

    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      setError('로그인이 필요합니다.')
      setLoading(false)
      return
    }

    const { data, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, display_name, phone, avatar_url, home_area')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      setError(`프로필을 불러오지 못했습니다: ${profileError.message}`)
      setLoading(false)
      return
    }

    if (!data) {
      setError('현재 로그인 계정의 프로필을 찾을 수 없습니다.')
      setLoading(false)
      return
    }

    const p = data as ProfileData
    setProfile(p)
    setDisplayName(p.display_name || '')
    setPhone(p.phone || '')
    setHomeArea(p.home_area || '')
    setLoading(false)
  }

  useEffect(() => { loadProfile() }, [])

  const handleSave = async () => {
    if (!profile) return
    if (!displayName.trim()) {
      setMessage('이름을 입력해주세요.')
      return
    }

    setSaving(true)
    setMessage('')

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        display_name: displayName.trim(),
        phone: phone.trim() || null,
        home_area: homeArea.trim() || null,
      })
      .eq('id', profile.id)

    if (updateError) {
      setMessage(`저장 실패: ${updateError.message}`)
      setSaving(false)
      return
    }

    await loadProfile()
    setEditing(false)
    setSaving(false)
    setMessage('프로필이 저장되었습니다.')
  }

  const handleCancel = () => {
    if (!profile) return
    setDisplayName(profile.display_name || '')
    setPhone(profile.phone || '')
    setHomeArea(profile.home_area || '')
    setEditing(false)
    setMessage('')
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  if (loading) return <main className="container section"><p>프로필을 불러오는 중...</p></main>
  if (error) return <main className="container section"><p>{error}</p></main>
  if (!profile) return null

  const roleLabel = profile.role === 'instructor' ? '운전 교관' : profile.role === 'admin' ? '관리자' : '운전연수 학습자'
  const initial = profile.display_name?.charAt(0) || '?'

  return (
    <main className="container section">
      <div className="pageHead">
        <div><span>MY YA TA</span><h1>내 프로필</h1></div>
        <div style={{ display: 'flex', gap: 10 }}>
          {!editing ? (
            <button className="ghostBtn" onClick={() => { setEditing(true); setMessage('') }}>수정</button>
          ) : (
            <>
              <button className="ghostBtn" onClick={handleCancel}>취소</button>
              <button className="primaryBtn" onClick={handleSave} disabled={saving}>{saving ? '저장 중...' : '저장'}</button>
            </>
          )}
          <button className="ghostBtn" onClick={handleLogout}>로그아웃</button>
        </div>
      </div>

      <div className="profileGrid">
        <section className="panel">
          <div className="profileHero">
            <div className="avatarBig">{initial}</div>
            <div style={{ flex: 1 }}>
              {!editing ? (
                <>
                  <h2>{profile.display_name}</h2>
                  <p>{roleLabel} · {profile.home_area || '지역 미설정'}</p>
                  {profile.phone && <p style={{ marginTop: 6 }}>{profile.phone}</p>}
                </>
              ) : (
                <div style={{ display: 'grid', gap: 14, width: '100%', maxWidth: 480 }}>
                  <label><div style={{ fontWeight: 700, marginBottom: 6 }}>이름</div><input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="이름" style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #ddd', fontSize: 15 }} /></label>
                  <label><div style={{ fontWeight: 700, marginBottom: 6 }}>전화번호</div><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="010-1234-5678" style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #ddd', fontSize: 15 }} /></label>
                  <label><div style={{ fontWeight: 700, marginBottom: 6 }}>지역</div><input type="text" value={homeArea} onChange={(e) => setHomeArea(e.target.value)} placeholder="예: 서울 강남구" style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #ddd', fontSize: 15 }} /></label>
                </div>
              )}
            </div>
          </div>

          <div className="statGrid">
            <div><b>0h</b><span>누적 연수</span></div>
            <div><b>0</b><span>완료 수업</span></div>
            <div><b>-</b><span>주차 숙련도</span></div>
          </div>
          {message && <p style={{ marginTop: 18, fontWeight: 700 }}>{message}</p>}
        </section>

        <section className="panel">
          <h3>다음 예약</h3>
          <div className="bookingLine"><div><b>예약 없음</b><span>아직 예정된 수업이 없습니다.</span></div></div>
        </section>
      </div>
    </main>
  )
}
