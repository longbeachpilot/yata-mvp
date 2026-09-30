'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ComponentProps } from 'react'
import { BookOpen, Gauge, Home, Search, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

function NavLink(props: ComponentProps<typeof Link>) {
  const pathname = usePathname()
  const href = typeof props.href === 'string' ? props.href.split('?')[0] : props.href.pathname
  const active = typeof props.href === 'string' && props.href.includes('?') ? false : href === '/' ? pathname === '/' : href === '/map' ? ['/map', '/instructors', '/book'].some(path => pathname === path || pathname.startsWith(path + '/')) : href === '/dashboard/instructor' ? pathname === href || pathname.startsWith(href + '/logbook') : !!href && (pathname === href || pathname.startsWith(href + '/'))
  return <Link {...props} aria-current={active ? 'page' : undefined} />
}

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
  const [logoutError, setLogoutError] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)

  async function logout() {
    if (loggingOut) return
    setLoggingOut(true); setLogoutError('')
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      window.location.href = '/'
    } catch { setLogoutError('로그아웃하지 못했습니다. 연결을 확인하고 다시 시도해주세요.') }
    finally { setLoggingOut(false) }
  }

  return (
    <header className="header">
      <div className="container headerInner">
        <Link className="brand" href="/"><span>야</span> 타</Link>

        <nav className="desktopNav" aria-label="주 메뉴">
          {isAdmin && <NavLink href="/admin/bookings">관리자</NavLink>}
          <NavLink href="/map">교관 찾기</NavLink>
          {loggedIn && <NavLink href="/bookings">내 예약</NavLink>}
          {loggedIn && <NavLink href="/logbook">Logbook</NavLink>}
          {role === 'instructor' && <NavLink href="/dashboard/instructor">교관센터</NavLink>}
          {!loggedIn && <NavLink href="/instructor">교관으로 활동하기</NavLink>}
        </nav>

        <div className="navActions">
          {!loggedIn ? (
            <>
              <Link className="ghostBtn mobileLogin" href="/login">로그인</Link>
              <Link className="primarySmall" href="/signup">시작하기</Link>
            </>
          ) : (
            <>
              <Link className="ghostBtn" href={role === 'instructor' ? '/dashboard/instructor/profile' : '/profile'}>
                내 프로필
              </Link>
              <button className="ghostBtn logoutBtn" type="button" disabled={loggingOut} onClick={logout}>{loggingOut ? '로그아웃 중...' : '로그아웃'}</button>
            </>
          )}
        </div>
      </div>
      {logoutError && <p role="alert" className="container bookingError">{logoutError}</p>}
    </header>
  )
}

export function BottomNav() {
  const { role, loggedIn, isAdmin } = useAccount()

  return (
    <nav className="bottomNav" aria-label="모바일 메뉴">
      <NavLink href="/"><Home size={19}/><span>홈</span></NavLink>
      <NavLink href="/map"><Search size={19}/><span>교관찾기</span></NavLink>
      {isAdmin ? (<NavLink href="/admin/bookings"><Gauge size={19}/><span>관리자</span></NavLink>) : role === 'instructor' ? (
        <NavLink href="/dashboard/instructor"><Gauge size={19}/><span>교관센터</span></NavLink>
      ) : (
        <NavLink href={loggedIn ? "/bookings" : "/login?next=%2Fbookings"}><BookOpen size={19}/><span>예약</span></NavLink>
      )}
      <NavLink href={loggedIn ? "/logbook" : "/login?next=%2Flogbook"}><BookOpen size={19}/><span>기록</span></NavLink>
      <NavLink href={loggedIn ? (role === 'instructor' ? '/dashboard/instructor/profile' : '/profile') : '/login'}>
        <UserRound size={19}/><span>MY</span>
      </NavLink>
    </nav>
  )
}
