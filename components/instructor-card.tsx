import Link from 'next/link'
import { ArrowRight, CalendarClock, Car, MapPin, ShieldCheck, Star } from 'lucide-react'

type InstructorCardData = {
  id: string
  name: string
  area: string
  specialties: string[]
  licenses: string[]
  vehicle: string
  rating: number | string
  reviews: number
  lessons: number
  next_slot?: string | null
}

export function InstructorCard({ instructor }: { instructor: InstructorCardData }) {
  return (
    <Link href={`/instructors/${instructor.id}`} className="instructorCard marketplaceCard">
      <div className="avatar">{instructor.name?.charAt(0) || '야'}</div>
      <div className="cardGrow">
        <div className="nameRow">
          <div><strong>{instructor.name} 교관</strong><span className="verifiedLabel"><ShieldCheck size={14}/> 등록 교관</span></div>
          <span className="cardArrow">프로필 보기 <ArrowRight size={15}/></span>
        </div>
        <div className="rating"><Star size={15} fill="currentColor"/> {instructor.reviews > 0 ? Number(instructor.rating).toFixed(2) : "신규"} <span>{instructor.reviews > 0 ? `후기 ${instructor.reviews} · ` : "후기 없음 · "}교육 {instructor.lessons.toLocaleString()}회</span></div>
        <div className="marketFacts">
          <span><MapPin size={14}/> {instructor.area}</span>
          <span><Car size={14}/> {instructor.vehicle}</span>
          {instructor.next_slot && <span><CalendarClock size={14}/> 다음 가능 {instructor.next_slot}</span>}
        </div>
        <div className="chips">{instructor.specialties?.map((item) => <span key={item}>{item}</span>)}</div>
        {instructor.licenses?.length > 0 && <div className="credentialLine">자격 · {instructor.licenses.join(' · ')}</div>}
      </div>
    </Link>
  )
}
