import './globals.css'
import './marketplace.css'
import './ux.css'
import type { Metadata } from 'next'
import Link from 'next/link'
import { BottomNav, Header } from '@/components/navigation'
import { SUPPORT_EMAIL, supportMailto } from '@/lib/support'

export const metadata: Metadata = {
  title: '야 타 | 내 주변 운전 교관 찾기',
  description: '면허 취득부터 장롱면허 연수까지, 나에게 맞는 운전 교관을 찾는 플랫폼',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <a className="skipLink" href="#main-content">본문으로 바로가기</a>
        <Header />
        <div id="main-content" tabIndex={-1}>{children}</div>
        <footer className="siteFooter">
          <div className="container">
            <nav className="legalLinks" aria-label="이용 안내">
              <Link href="/support">고객 문의</Link>
              <Link href="/terms">이용약관</Link>
              <Link href="/privacy">개인정보처리방침</Link>
            </nav>
            <p>이메일 문의 · <a href={supportMailto()}>{SUPPORT_EMAIL}</a></p>
            <p>YA TA · WEED 설립 준비</p>
          </div>
        </footer>
        <BottomNav />
      </body>
    </html>
  )
}
