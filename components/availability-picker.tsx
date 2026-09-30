'use client'
import { useState } from 'react'
import { isFutureSlot, koreaToday, type LessonSlot } from '@/lib/booking-time'

type Booking = LessonSlot & { status: string; duration_minutes: number }
const times = Array.from({ length: 13 }, (_, i) => `${String(i + 9).padStart(2, '0')}:00`)
function dayAfter(offset: number) { const date = new Date(`${koreaToday()}T12:00:00+09:00`); date.setUTCDate(date.getUTCDate() + offset); return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date) }
function minutes(time: string) { return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5)) }
function endTime(time: string) { return `${String(Number(time.slice(0, 2)) + 2).padStart(2, '0')}:${time.slice(3, 5)}` }
function dateLabel(date: string) { return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', weekday: 'short' }).format(new Date(`${date}T12:00:00+09:00`)) }

export function AvailabilityPicker({ slots, bookings, busy, unavailable, onSave }: { slots: LessonSlot[]; bookings: Booking[]; busy: boolean; unavailable: boolean; onSave: (slots: LessonSlot[]) => Promise<boolean> }) {
  const [dates, setDates] = useState<string[]>(() => [dayAfter(1)])
  const [selectedTimes, setTimes] = useState<string[]>([])
  const [offset, setOffset] = useState(0)
  const [notice, setNotice] = useState('')
  const days = Array.from({ length: 14 }, (_, i) => dayAfter(offset + i))
  const toggleDate = (date: string) => { setNotice(''); setDates(old => old.includes(date) ? old.filter(d => d !== date) : [...old, date].sort()) }
  const choices = dates.flatMap(lesson_date => selectedTimes.map(start_time => ({ lesson_date, start_time }))).sort((a, b) => `${a.lesson_date}${a.start_time}`.localeCompare(`${b.lesson_date}${b.start_time}`))
  const reason = (slot: LessonSlot) => {
    if (!isFutureSlot(slot)) return '지난 시간'
    if (bookings.some(b => ['requested', 'confirmed'].includes(b.status) && b.lesson_date === slot.lesson_date && minutes(b.start_time) < minutes(slot.start_time) + 120 && minutes(b.start_time) + b.duration_minutes > minutes(slot.start_time))) return '예약과 겹침'
    if (slots.some(s => s.lesson_date === slot.lesson_date && s.start_time.slice(0, 5) === slot.start_time)) return '이미 공개 중'
    return ''
  }
  const ready = choices.filter(s => !reason(s))
  async function save() {
    setNotice('')
    if (await onSave(ready)) { setNotice(`${ready.length}개의 가능 시간을 열었습니다.`); setTimes([]) }
  }
  return <div className="slotPicker">
    <p>날짜와 시작 시간을 여러 개 고르면 한 번에 열 수 있어요. 수업은 2시간이며, 모두 한국시간입니다.</p>
    <fieldset disabled={busy}><legend>1. 날짜 선택 <small>{dates.length}일 선택</small></legend>
      <div className="slotToolbar"><button type="button" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 14))}>이전 2주</button><span>{dateLabel(days[0])} ~ {dateLabel(days[13])}</span><button type="button" onClick={() => setOffset(offset + 14)}>다음 2주</button></div>
      <div className="slotDays">{days.map(day => <button key={day} type="button" aria-label={day} aria-pressed={dates.includes(day)} onClick={() => toggleDate(day)}>{dateLabel(day)}</button>)}</div>
      <div className="slotToolbar"><button type="button" onClick={() => setDates(old => Array.from(new Set([...old, ...days.filter(day => ![0, 6].includes(new Date(`${day}T12:00:00+09:00`).getUTCDay()))])).sort())}>보이는 평일 선택</button><button type="button" onClick={() => setDates([])}>날짜 선택 해제</button></div>
      <div className="slotSelected">{dates.map(day => <button type="button" key={day} aria-label={`${day} 선택 해제`} onClick={() => toggleDate(day)}>{dateLabel(day)} ×</button>)}</div>
    </fieldset>
    <fieldset disabled={busy}><legend>2. 시작 시간 선택</legend>
      <p>선택한 모든 날짜에 적용됩니다.</p>
      <div className="slotToolbar">{[['오전', ['09:00', '11:00']], ['오후', ['14:00', '16:00']], ['저녁', ['18:00', '20:00']]].map(([label, values]) => <button type="button" key={String(label)} onClick={() => { setNotice(''); setTimes(old => Array.from(new Set([...old, ...(values as string[])])).sort()) }}>{label} 시간 선택</button>)}<button type="button" onClick={() => setTimes([])}>시간 선택 해제</button></div>
      <div className="slotTimes">{times.map(time => <button type="button" key={time} aria-label={`${time} 시작`} aria-pressed={selectedTimes.includes(time)} onClick={() => { setNotice(''); setTimes(old => old.includes(time) ? old.filter(t => t !== time) : [...old, time].sort()) }}><strong>{time}</strong><small>~ {endTime(time)}</small></button>)}</div>
      <p className="muted">서로 겹치는 시작 시간도 공개할 수 있지만, 예약이 들어오면 겹치는 시간은 예약할 수 없습니다.</p>
    </fieldset>
    <div className="slotPreview"><h4>3. 등록 전 확인 · 새로 열 시간 {ready.length}개</h4>
      {!choices.length ? <p>날짜와 시간을 선택하면 등록할 목록이 여기에 표시됩니다.</p> : <><p>{dates.length}일 × {selectedTimes.length}개 시간대{choices.length !== ready.length && ` · ${choices.length - ready.length}개 제외`}</p><ul>{choices.map(slot => <li key={`${slot.lesson_date}${slot.start_time}`}><span>{dateLabel(slot.lesson_date)} {slot.start_time} ~ {endTime(slot.start_time)}</span><strong>{reason(slot) || '등록 예정'}</strong></li>)}</ul></>}
      {unavailable && <p role="alert">최신 일정을 확인한 후 등록할 수 있습니다. 예약 상태 새로고침을 눌러주세요.</p>}
      <button type="button" className="primaryBtn" disabled={busy || unavailable || !ready.length || ready.length > 100} onClick={() => void save()}>{busy ? '저장 중...' : `${ready.length}개 가능 시간 한 번에 열기`}</button>
      {ready.length > 100 && <p role="alert">한 번에 100개까지 등록할 수 있습니다. 선택한 날짜를 줄여주세요.</p>}
      <p role="status">{notice}</p>
    </div>
  </div>
}
