export type LessonSlot = { lesson_date: string; start_time: string }

export function koreaToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now)
}

export function isFutureSlot(slot: LessonSlot, now = Date.now()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(slot.lesson_date) ||
      !/^(?:[01]\d|2[0-3]):[0-5]\d(?::00)?$/.test(slot.start_time)) return false
  const start = Date.parse(`${slot.lesson_date}T${slot.start_time.slice(0, 5)}:00+09:00`)
  return Number.isFinite(start) && start > now
}
