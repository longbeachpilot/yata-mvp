'use client'

import Link from 'next/link'
import { BookOpen, Gauge, Home, Search, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Role = 'learner' | 'instructor' | 'admin' | null

function useAccount() {
  const [role, setRole] = useState<Role>(null)
  const [loggedIn, setLoggedIn] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  useEffect(() => {
    let mounted = true
    let generation = 0
    async function syncUser() {
      const request = ++generation
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!mounted || request !== generation) return
        if (!user) { setLoggedIn(false); setRole(null); setIsAdmin(false); return }
        const [{ data }, { data: admin }] = await Promise.all([
          supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
          supabase.rpc('is_admin'),
        ])
        if (mounted && request === generation) {
          setLoggedIn(true); setRole((data?.role as Role) ?? 'learner'); setIsAdmin(admin === true)
        }
      } catch {
        if (mounted && request === generation) { setLoggedIn(false); setRole(null); setIsAdmin(false) }
      }
    }
    void syncUser()
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      setTimeout(() => { if (mounted) void syncUser() }, 0)
    })
    return () => { mounted = false; listener.subscription.unsubscribe() }
  }, [])
  return { role, loggedIn, isAdmin }
}

export function Header() {
  const { role, loggedIn, isAdmin } = useAccount()

  async function logout() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <header className="header">
      <div className="container headerInner">
        <Link className="brand" href="/"><span>야</span> 타</Link>

        <nav className="desktopNav" aria-label="주 메뉴">
          {isAdmin && <Link href="/admin/instructors">관리자</Link>}
          <Link href="/map">교관 찾기</Link>
          {loggedIn && <Link href="/bookings">내 예약</Link>}
          {loggedIn && <Link href="/logbook">Logbook</Link>}
          {role === 'instructor' && <Link href="/dashboard/instructor">교관센터</Link>}
          {!loggedIn && <Link href="/instructor">교관으로 활동하기</Link>}
        </nav>

        <div className="navActions">
          {!loggedIn ? (
            <>
              <Link className="ghostBtn" href="/login">로그인</Link>
              <Link className="primarySmall" href="/signup">시작하기</Link>
            </>
          ) : (
            <>
              <Link className="ghostBtn" href={role === 'instructor' ? '/dashboard/instructor/profile' : '/profile'}>
                내 프로필
              </Link>
              <button className="primarySmall" type="button" onClick={logout}>로그아웃</button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

export function BottomNav() {
  const { role, loggedIn, isAdmin } = useAccount()

  return (
    <nav className="bottomNav" aria-label="모바일 메뉴">
      <Link href="/"><Home size={19}/><span>홈</span></Link>
      <Link href="/map"><Search size={19}/><span>교관찾기</span></Link>
      {isAdmin ? (<Link href="/admin/instructors"><Gauge size={19}/><span>관리자</span></Link>) : role === 'instructor' ? (
        <Link href="/dashboard/instructor"><Gauge size={19}/><span>교관센터</span></Link>
      ) : (
        <Link href={loggedIn ? "/bookings" : "/login?next=%2Fbookings"}><BookOpen size={19}/><span>예약</span></Link>
      )}
      <Link href={loggedIn ? "/logbook" : "/login?next=%2Flogbook"}><BookOpen size={19}/><span>기록</span></Link>
      <Link href={loggedIn ? (role === 'instructor' ? '/dashboard/instructor/profile' : '/profile') : '/login'}>
        <UserRound size={19}/><span>MY</span>
      </Link>
    </nav>
  )
}

