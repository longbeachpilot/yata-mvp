import type { Metadata } from 'next'
import Link from 'next/link'
import { SUPPORT_EMAIL, supportMailto } from '@/lib/support'

export const metadata: Metadata = {
  title: '고객 문의와 이용 안내 | YA TA',
  description: 'YA TA 예약 요청, 학원 직접 결제, 취소·환불 문의 및 계정 관련 이메일 문의 안내',
}

export default function SupportPage() {
  return (
    <section className="container section pageTop narrow supportPage">
      <div className="pageTitle">
        <span>HELP & CONTACT</span>
        <h1>고객 문의와 이용 안내</h1>
        <p>예약부터 계정 문의까지, 이메일로 문의해주세요.</p>
      </div>

      <section className="contentCard supportContact" aria-labelledby="contact-title">
        <h2 id="contact-title">이메일 문의</h2>
        <a className="supportEmail" href={supportMailto()}>{SUPPORT_EMAIL}</a>
        <p>전화 상담은 운영하지 않습니다. 메일 작성 버튼을 누른 뒤, 메일 앱에서 내용을 확인하고 직접 보내주세요.</p>
        <a className="primaryBtn" href={supportMailto()}>문의 메일 작성하기</a>
        <p className="supportHint">메일 앱이 열리지 않으면 위 주소를 복사해 사용 중인 이메일 서비스에서 보내주세요.</p>
      </section>

      <section className="contentCard" aria-labelledby="booking-help-title">
        <h2 id="booking-help-title">예약 요청과 확정</h2>
        <ol>
          <li>교관과 날짜·시간·시작 장소를 선택해 예약을 요청합니다.</li>
          <li>교관이 일정을 확인합니다. ‘예약 요청’ 상태는 아직 확정 전입니다.</li>
          <li><Link href="/bookings">내 예약</Link>에서 ‘예약 확정’ 상태를 확인한 뒤 수업을 준비해주세요.</li>
        </ol>
        <p>예약 상태는 내 예약 화면을 새로고침해 확인할 수 있습니다. 확인이 지연되거나 일정·만남 장소를 문의하려면 해당 예약의 ‘이 예약 문의’ 버튼을 이용해주세요.</p>
        <p>문의 메일에는 예약번호가 포함됩니다. 상대방 연락처를 찾기 어려운 경우에도 같은 창구로 문의할 수 있습니다.</p>
      </section>

      <section className="contentCard" aria-labelledby="payment-help-title">
        <h2 id="payment-help-title">결제·취소·환불</h2>
        <p>YA TA에서는 결제하지 않습니다. 수업이 확정되면 교육 제공 학원에 직접 결제합니다. 결제 전 학원명, 최종 금액, 포함된 수업 범위와 추가 비용, 취소·노쇼·환불 조건을 확인해주세요.</p>
        <p>예약 요청 또는 확정 상태에서는 내 예약에서 취소할 수 있습니다. 일정 변경이 필요하면 새 예약을 요청하기 전에 이메일로 문의해주세요.</p>
        <p><strong>예약을 취소해도 이미 결제한 금액이 자동으로 환불되지는 않습니다.</strong> 환불은 결제한 학원에 요청해야 합니다. 학원과 연락이 어렵거나 처리에 문제가 있다면 예약번호와 함께 YA TA에 알려주세요.</p>
      </section>

      <section className="contentCard" id="account" aria-labelledby="account-help-title">
        <h2 id="account-help-title">계정 복구·탈퇴·개인정보 문의</h2>
        <p>비밀번호를 잊으셨다면 <Link href="/reset-password">비밀번호 재설정</Link>을 이용해주세요.</p>
        <p>회원 탈퇴나 개인정보 열람·수정·삭제를 요청하려면 가입한 이메일로 요청 내용을 보내주세요. 본인 확인과 처리 범위는 회신으로 안내합니다. 메일 작성 버튼을 누르는 것만으로 탈퇴나 삭제가 완료되지는 않습니다.</p>
        <p>비밀번호, 인증번호, 신분증·운전면허증 사진은 문의 메일에 보내지 마세요.</p>
        <a className="ghostBtn" href={supportMailto('account')}>계정 문의 메일 작성하기</a>
      </section>

      <section className="contentCard" aria-labelledby="service-status-title">
        <h2 id="service-status-title">서비스 준비 현황</h2>
        <p>YA TA는 현재 서비스 준비·테스트 단계입니다. 주식회사 위드(WEED)의 법인 설립과 사업자등록을 진행하고 있으며, 실차 연수 제휴 학원은 확보 전입니다.</p>
        <p>실제 수업 접수는 교육 제공자와 교관·차량·보험, 지역·가격·일정을 확인한 뒤 안내합니다.</p>
        <div className="supportLinks"><Link href="/terms">이용약관</Link><Link href="/privacy">개인정보처리방침</Link></div>
      </section>
    </section>
  )
}
