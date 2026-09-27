'use client'

import { useEffect, useRef } from 'react'

// Visible pages recheck periodically and when the user returns to the tab.
// This is in-page refresh, not email, background push or guaranteed delivery.
export function usePageRefresh(refresh: () => Promise<void>, paused = false) {
  const refreshRef = useRef(refresh)
  const pausedRef = useRef(paused)
  useEffect(() => { refreshRef.current = refresh; pausedRef.current = paused }, [refresh, paused])
  useEffect(() => {
    let busy = false
    let disposed = false
    async function run() {
      if (disposed || busy || pausedRef.current || document.visibilityState !== 'visible') return
      busy = true
      try { await refreshRef.current() } finally { busy = false }
    }
    const onReturn = () => { void run() }
    const timer = window.setInterval(onReturn, 30_000)
    window.addEventListener('focus', onReturn)
    document.addEventListener('visibilitychange', onReturn)
    return () => {
      disposed = true
      window.clearInterval(timer)
      window.removeEventListener('focus', onReturn)
      document.removeEventListener('visibilitychange', onReturn)
    }
  }, [])
}
