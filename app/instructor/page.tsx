import Link from 'next/link'
import {
  BadgeCheck,
  Car,
  Megaphone,
  WalletCards,
} from 'lucide-react'

export default function InstructorPage() {
  const benefits = [
    {
      Icon: BadgeCheck,
      title: '자격 인증',
      description:
        '자격·경력 정보를 기반으로 신뢰도 높은 프로필',
    },
    {
      Icon: Car,
      title: '차량 홍보',
      description:
        '1종 보통부터 대형·특수까지 교육 가능 차량 등록',
    },
    {
      Icon: Megaphone,
      title: '개인 브랜딩',
      description:
        '후기와 교육 실적이 교관 개인의 자산으로 축적',
    },
    {
      Icon: WalletCards,
      title: '예약·정산',
      description:
        '일정 관리부터 예약, 결제, 정산까지 한 곳에서',
    },
  ]

  return (
    <section className="section container pageTop">
      <div className="instructorLanding">
        <div>
          <span className="eyebrow">
            FOR INSTRUCTORS
          </span>

          <h1>
            학원 이름이 아니라
            <br />
            <em>내 이름으로</em> 학생을 만나세요.
          </h1>

          <p>
            자격, 전문 분야, 교육 차량, 가능한 시간을
            등록하고 나만의 교관 프로필을 만들어 보세요.
          </p>

          <Link
            href="/instructor/register"
            className="primaryBtn"
          >
            교관 사전등록
          </Link>
        </div>

        <div className="benefitGrid">
          {benefits.map(
            ({
              Icon,
              title,
              description,
            }) => (
              <div
                className="benefit"
                key={title}
              >
                <Icon />

                <strong>
                  {title}
                </strong>

                <span>
                  {description}
                </span>
              </div>
            )
          )}
        </div>
      </div>
    </section>
  )
}