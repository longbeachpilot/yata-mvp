'use client'

import Link from 'next/link'
import { BookOpen, Gauge, Home, Search, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Role = 'learner' | 'instructor' | 'admin' | null

export function Header() {
  const [role, setRole] = useState<Role>(null)
  const [loggedIn, setLoggedIn] = useState(false)

  useEffect(() => {
    let mounted = true

    async function syncUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!mounted) return

      if (!user) {
        setLoggedIn(false)
        setRole(null)
        return
      }

      setLoggedIn(true)
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

      if (mounted) setRole((data?.role as Role) ?? 'learner')
    }

    syncUser()
    // Release the Auth callback before making another Auth request.
    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      setTimeout(() => { if (mounted) void syncUser() }, 0)
    })

    return () => {
      mounted = false
      authListener.subscription.unsubscribe()
    }
  }, [])

  async function logout() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <header className="header">
      <div className="container headerInner">
        <Link className="brand" href="/"><span>야</span> 타</Link>

        <nav className="desktopNav">
          <Link href="/instructors">교관 찾기</Link>
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
  const [role, setRole] = useState<Role>(null)
  const [loggedIn, setLoggedIn] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setLoggedIn(true)
      const { data } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      setRole((data?.role as Role) ?? 'learner')
    }
    load()
  }, [])

  return (
    <nav className="bottomNav">
      <Link href="/"><Home size={19}/><span>홈</span></Link>
      <Link href="/instructors"><Search size={19}/><span>교관찾기</span></Link>
      {role === 'instructor' ? (
        <Link href="/dashboard/instructor"><Gauge size={19}/><span>교관센터</span></Link>
      ) : (
        <Link href="/bookings"><BookOpen size={19}/><span>예약</span></Link>
      )}
      <Link href="/logbook"><BookOpen size={19}/><span>기록</span></Link>
      <Link href={loggedIn ? (role === 'instructor' ? '/dashboard/instructor/profile' : '/profile') : '/login'}>
        <UserRound size={19}/><span>MY</span>
      </Link>
    </nav>
  )
}
