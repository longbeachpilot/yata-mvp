import './globals.css'
import type { Metadata } from 'next'
import Link from 'next/link'
import { BottomNav, Header } from '@/components/navigation'

export const metadata: Metadata = {
  title: '야 타 | 내 주변 운전 교관 찾기',
  description: '면허 취득부터 장롱면허 연수까지, 나에게 맞는 운전 교관을 찾는 플랫폼',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <Header />
        <main>{children}</main>
        <div className="legalLinks"><Link href="/terms">이용약관</Link><Link href="/privacy">개인정보처리방침</Link></div>
        <BottomNav />
      </body>
    </html>
  )
}
