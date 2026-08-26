import Link from 'next/link'
import { BadgeCheck, Car, MapPin, Star } from 'lucide-react'

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
    <Link href={`/instructors/${instructor.id}`} className="instructorCard">
      <div className="avatar">{instructor.name?.charAt(0) || '야'}</div>
      <div className="cardGrow">
        <div className="nameRow"><strong>{instructor.name} 교관</strong><span className="verified"><BadgeCheck size={14}/> 등록 교관</span></div>
        <div className="rating"><Star size={15} fill="currentColor" /> {Number(instructor.rating).toFixed(2)} <span>({instructor.reviews}) · 교육 {instructor.lessons.toLocaleString()}회</span></div>
        <div className="muted"><MapPin size={14}/> {instructor.area}</div>
        <div className="chips">{instructor.specialties?.map((item) => <span key={item}>{item}</span>)}</div>
        <div className="vehicleLine"><span><Car size={14}/> {instructor.vehicle}</span><small>{instructor.licenses?.join(' · ')}</small></div>
      </div>
    </Link>
  )
}
