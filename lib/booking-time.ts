export type LessonSlot = { lesson_date: string; start_time: string }
export type ScheduledLesson = LessonSlot & { duration_minutes: number }

export function koreaToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now)
}

export function isFutureSlot(slot: LessonSlot, now = Date.now()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(slot.lesson_date) ||
      !/^(?:[01]\d|2[0-3]):[0-5]\d(?::00)?$/.test(slot.start_time)) return false
  const date = Date.parse(`${slot.lesson_date}T00:00:00Z`)
  if (!Number.isFinite(date) || new Date(date).toISOString().slice(0, 10) !== slot.lesson_date) return false
  const start = Date.parse(`${slot.lesson_date}T${slot.start_time.slice(0, 5)}:00+09:00`)
  return Number.isFinite(start) && start > now
}

export function hasLessonEnded(lesson: ScheduledLesson, now = Date.now()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(lesson.lesson_date) ||
      !/^(?:[01]\d|2[0-3]):[0-5]\d(?::00)?$/.test(lesson.start_time) ||
      !Number.isInteger(lesson.duration_minutes) || lesson.duration_minutes <= 0) return false
  const date = Date.parse(`${lesson.lesson_date}T00:00:00Z`)
  if (!Number.isFinite(date) || new Date(date).toISOString().slice(0, 10) !== lesson.lesson_date) return false
  const start = Date.parse(`${lesson.lesson_date}T${lesson.start_time.slice(0, 5)}:00+09:00`)
  const end = start + lesson.duration_minutes * 60_000
  return Number.isFinite(end) && end <= now
}
