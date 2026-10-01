'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, CalendarPlus, Loader2, Repeat, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toEnglishDigits } from '@/lib/phone'
import { dateKeyInTimeZone, localDateTimeToUtc } from '@/lib/bookings/time'
import { shiftDateKey } from '@/components/bookings/booking-model'
import { DialogShell } from '@/components/ui/dialog-shell'
import { MaterialSelect } from '@/components/ui/material-select'
import { LocalizedDatePicker } from '@/components/ui/localized-date-picker'
import { TimeRangeField } from '@/components/ui/time-picker'
import type { CourseTemplate } from '@/components/courses/courses-workspace'
import {
  FORMAT_META,
  STATUS_META,
  courseErrorMessage,
  courseFromApi,
  num,
  sessionToDraft,
  type CourseFormat,
  type CourseRow,
  type CourseStatus,
  type Locale,
  type SessionDraft,
} from '@/components/courses/course-model'

const TZ = 'Asia/Tehran'
let draftKey = 0
const nextKey = () => `n${++draftKey}`

function parseNumber(value: string): number | null {
  const clean = toEnglishDigits(value).replace(/[^\d.]/g, '')
  if (!clean) return null
  const parsed = Number(clean)
  return Number.isFinite(parsed) ? parsed : null
}

function groupDigits(value: string, fa: boolean) {
  const parsed = parseNumber(value)
  return parsed === null ? '' : parsed.toLocaleString(fa ? 'fa-IR' : 'en-US')
}

/**
 * Create or edit a course: the basics, seats and waitlist, where sign-ups
 * stand (draft → enrolling → closed → archived), and its session schedule.
 * «تکرار هفتگی» fills a term in one step from the first session.
 */
export function CourseEditor({
  locale,
  course,
  template,
  onClose,
  onSaved,
  onDeleted,
}: {
  locale: Locale
  course: CourseRow | null
  template: CourseTemplate | null
  onClose: () => void
  onSaved: (course: CourseRow) => void
  onDeleted: (courseId: string) => void
}) {
  const fa = locale === 'fa'
  const today = useMemo(() => dateKeyInTimeZone(new Date(), TZ), [])
  const [title, setTitle] = useState(course?.title ?? (template ? (fa ? template.fa.replace(/\s*\(.*\)$/, '') : template.en.replace(/\s*\(.*\)$/, '')) : ''))
  const [description, setDescription] = useState(course?.description ?? '')
  const [instructor, setInstructor] = useState(course?.instructor ?? '')
  const [format, setFormat] = useState<CourseFormat>(course?.format ?? template?.format ?? 'IN_PERSON')
  const [location, setLocation] = useState(course?.location ?? '')
  const [price, setPrice] = useState(course?.price !== null && course?.price !== undefined ? String(course.price) : '')
  const [capacity, setCapacity] = useState(String(course?.capacity ?? template?.capacity ?? 20))
  const [waitlist, setWaitlist] = useState(course?.waitlistEnabled ?? true)
  const [status, setStatus] = useState<CourseStatus>(course?.status ?? 'PUBLISHED')
  const [deadline, setDeadline] = useState(course?.enrollmentDeadline ? dateKeyInTimeZone(new Date(course.enrollmentDeadline), course.timezone) : '')
  const [sessions, setSessions] = useState<SessionDraft[]>(() => {
    if (course) return course.sessions.map((session, index) => sessionToDraft(session, course.timezone, index))
    const count = template?.sessions ?? 1
    const minutes = template?.minutes ?? 90
    const start = shiftDateKey(today, 7)
    return Array.from({ length: count }, (_, index) => ({ key: nextKey(), localDate: shiftDateKey(start, index * 7), startMinute: 17 * 60, endMinute: 17 * 60 + minutes, title: '' }))
  })
  const [repeat, setRepeat] = useState('8')
  const [busy, setBusy] = useState<'save' | 'delete' | null>(null)
  const [error, setError] = useState('')
  const [deleteState, setDeleteState] = useState<'idle' | 'confirm' | { active: number }>('idle')

  const capacityNum = parseNumber(capacity) ?? 0
  const takenSeats = course?.seats.taken ?? 0
  const invalidSession = sessions.some((session) => session.endMinute <= session.startMinute)

  function updateSession(key: string, patch: Partial<SessionDraft>) {
    setSessions((current) => current.map((session) => (session.key === key ? { ...session, ...patch } : session)))
  }

  function addSession() {
    setSessions((current) => {
      const last = current[current.length - 1]
      return [...current, last
        ? { ...last, key: nextKey(), localDate: shiftDateKey(last.localDate, 7), title: '' }
        : { key: nextKey(), localDate: shiftDateKey(today, 7), startMinute: 17 * 60, endMinute: 18 * 60 + 30, title: '' }]
    })
  }

  function repeatWeekly() {
    const count = Math.max(1, Math.min(52, Math.round(parseNumber(repeat) ?? 1)))
    setSessions((current) => {
      const first = current[0] ?? { key: nextKey(), localDate: shiftDateKey(today, 7), startMinute: 17 * 60, endMinute: 18 * 60 + 30, title: '' }
      return Array.from({ length: count }, (_, index) => ({ ...first, key: nextKey(), localDate: shiftDateKey(first.localDate, index * 7), title: '' }))
    })
  }

  async function save() {
    if (title.trim().length < 2) { setError(fa ? 'نام دوره را بنویسید.' : 'Enter a course name.'); return }
    if (capacityNum < 1) { setError(fa ? 'ظرفیت باید حداقل ۱ نفر باشد.' : 'Capacity must be at least 1.'); return }
    if (invalidSession) { setError(fa ? 'پایان هر جلسه باید بعد از شروعش باشد.' : 'Each session must end after it starts.'); return }
    setBusy('save')
    setError('')
    const body = {
      title: title.trim(),
      description: description.trim() || null,
      instructor: instructor.trim() || null,
      format,
      location: location.trim() || null,
      price: parseNumber(price),
      capacity: Math.round(capacityNum),
      status,
      waitlistEnabled: waitlist,
      enrollmentDeadline: deadline ? localDateTimeToUtc(deadline, 1439, TZ).toISOString() : null,
      timezone: course?.timezone ?? TZ,
      sessions: sessions.map((session) => ({ localDate: session.localDate, startMinute: session.startMinute, endMinute: session.endMinute, title: session.title.trim() || null })),
    }
    const response = await fetch(course ? `/api/courses/${course.id}` : '/api/courses', {
      method: course ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => null)
    const data = await response?.json().catch(() => ({})) as { course?: Record<string, unknown>; error?: string } | undefined
    setBusy(null)
    if (!response?.ok || !data?.course) { setError(courseErrorMessage(data?.error, fa)); return }
    // Seats come from the roster; keep the known counts after an edit.
    const saved = courseFromApi(data.course)
    onSaved({ ...saved, seats: course ? { ...course.seats, capacity: saved.capacity, left: Math.max(0, saved.capacity - course.seats.taken) } : { capacity: saved.capacity, taken: 0, waitlisted: 0, left: saved.capacity } })
  }

  async function remove() {
    if (!course) return
    if (deleteState === 'idle') {
      const response = await fetch(`/api/courses/${course.id}?impact=1`).catch(() => null)
      const data = await response?.json().catch(() => ({})) as { impact?: { active: number } } | undefined
      setDeleteState(data?.impact?.active ? { active: data.impact.active } : 'confirm')
      return
    }
    setBusy('delete')
    const response = await fetch(`/api/courses/${course.id}`, { method: 'DELETE' }).catch(() => null)
    setBusy(null)
    if (response?.ok) { onDeleted(course.id); return }
    const data = await response?.json().catch(() => ({})) as { error?: string; active?: number } | undefined
    if (data?.error === 'HAS_ACTIVE_ENROLLMENTS') { setDeleteState({ active: data.active ?? 1 }); return }
    setError(courseErrorMessage(data?.error, fa))
  }

  const inputClass = 'input min-h-11 w-full rounded-xl text-sm'

  return (
    <DialogShell wide title={course ? (fa ? 'ویرایش دوره' : 'Edit course') : (fa ? 'دوره جدید' : 'New course')} subtitle={fa ? 'ایجنت فقط دوره‌های «در حال ثبت‌نام» را معرفی و ثبت‌نام می‌کند.' : 'The agent only offers and enrols in courses that are enrolling.'} onClose={() => !busy && onClose()}>
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">{fa ? 'نام دوره' : 'Course name'}</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={fa ? 'مثلاً آموزش پایتون مقدماتی' : 'e.g. Intro to Python'} className={inputClass} autoFocus />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">{fa ? 'توضیح برای مشتری' : 'Description for customers'}</span>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} placeholder={fa ? 'سرفصل‌ها، پیش‌نیاز و اینکه برای چه کسی مناسب است' : 'Syllabus, prerequisites and who it is for'} className="input w-full resize-none rounded-xl text-sm" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">{fa ? 'مدرس' : 'Instructor'}</span>
            <input value={instructor} onChange={(event) => setInstructor(event.target.value)} className={inputClass} />
          </label>
          <div>
            <span className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">{fa ? 'نحوه برگزاری' : 'Format'}</span>
            <MaterialSelect
              value={format}
              onValueChange={(value) => setFormat(value as CourseFormat)}
              ariaLabel={fa ? 'نحوه برگزاری' : 'Format'}
              options={(Object.keys(FORMAT_META) as CourseFormat[]).map((key) => ({ value: key, label: fa ? FORMAT_META[key].fa : FORMAT_META[key].en }))}
            />
          </div>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">{format === 'ONLINE' ? (fa ? 'بستر آنلاین' : 'Online platform') : (fa ? 'محل برگزاری' : 'Location')}</span>
            <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder={format === 'ONLINE' ? (fa ? 'مثلاً گوگل میت' : 'e.g. Google Meet') : (fa ? 'آدرس یا نام سالن' : 'Address or room')} className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">{fa ? 'قیمت (تومان)' : 'Price (Toman)'}</span>
            <input inputMode="numeric" value={groupDigits(price, fa)} onChange={(event) => setPrice(toEnglishDigits(event.target.value).replace(/[^\d]/g, ''))} placeholder={fa ? 'خالی = ایجنت قیمت نمی‌گوید · ۰ = رایگان' : 'Blank = not quoted · 0 = free'} className={cn(inputClass, 'tabular-nums')} />
          </label>
        </div>

        <div className="grid gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">{fa ? 'ظرفیت (نفر)' : 'Capacity'}</span>
            <input inputMode="numeric" value={groupDigits(capacity, fa)} onChange={(event) => setCapacity(toEnglishDigits(event.target.value).replace(/[^\d]/g, ''))} className={cn(inputClass, 'bg-white tabular-nums')} />
            {course && capacityNum > 0 && capacityNum < takenSeats && (
              <span className="mt-1 block text-[12px] text-amber-700">{fa ? `${num(takenSeats, true)} نفر ثبت‌نام کرده‌اند؛ کسی حذف نمی‌شود ولی ثبت‌نام تازه‌ای هم پذیرفته نمی‌شود.` : `${takenSeats} already enrolled; nobody is removed, but no new seats open.`}</span>
            )}
          </label>
          <div>
            <span className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">{fa ? 'مهلت ثبت‌نام (اختیاری)' : 'Enrollment deadline (optional)'}</span>
            <LocalizedDatePicker value={deadline} onValueChange={setDeadline} locale={locale} min={today} ariaLabel={fa ? 'مهلت ثبت‌نام' : 'Enrollment deadline'} placeholder={fa ? 'تا شروع جلسه اول' : 'Until the first session'} />
            {deadline && <button type="button" onClick={() => setDeadline('')} className="mt-1 text-[12px] text-[var(--text-muted)] underline">{fa ? 'حذف مهلت' : 'Clear'}</button>}
          </div>
          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl bg-white p-3">
            <input type="checkbox" checked={waitlist} onChange={(event) => setWaitlist(event.target.checked)} className="mt-1 h-4 w-4 accent-black" />
            <span>
              <span className="block text-[13px] font-bold text-[var(--text-primary)]">{fa ? 'فهرست انتظار' : 'Waitlist'}</span>
              <span className="block text-[12px] leading-5 text-[var(--text-muted)]">{fa ? 'با پر شدن ظرفیت، ثبت‌نام‌های تازه منتظر می‌مانند و با هر انصراف، نفر اول خبر می‌گیرد.' : 'When full, new sign-ups wait; each withdrawal moves the first one up and tells them.'}</span>
            </span>
          </label>
        </div>

        <div>
          <span className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">{fa ? 'وضعیت ثبت‌نام' : 'Enrollment status'}</span>
          <div className="ui-seg grid-cols-2 sm:grid-cols-4" role="radiogroup" aria-label={fa ? 'وضعیت ثبت‌نام' : 'Enrollment status'}>
            {(['DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED'] as const).map((key) => (
              <button key={key} type="button" role="radio" aria-checked={status === key} onClick={() => setStatus(key)} className="ui-seg-tab text-sm">
                {fa ? STATUS_META[key].fa : STATUS_META[key].en}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[var(--text-secondary)]">{fa ? `جلسات (${num(sessions.length, true)})` : `Sessions (${sessions.length})`}</span>
            <div className="flex items-center gap-1.5">
              <input inputMode="numeric" aria-label={fa ? 'تعداد جلسات هفتگی' : 'Weekly sessions'} value={repeat} onChange={(event) => setRepeat(toEnglishDigits(event.target.value).replace(/[^\d]/g, ''))} className="input h-9 min-h-9 w-14 rounded-lg text-center text-sm tabular-nums" />
              <button type="button" onClick={repeatWeekly} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-[var(--border-default)] bg-white px-2.5 text-[12px] font-bold text-[var(--text-secondary)] hover:border-[var(--border-strong)]">
                <Repeat className="h-3.5 w-3.5" />{fa ? 'جلسه هفتگی از جلسه اول' : 'weekly from the first'}
              </button>
            </div>
          </div>
          <ul className="space-y-2">
            {sessions.map((session, index) => (
              <li key={session.key} className="grid gap-2 rounded-2xl border border-[var(--border-subtle)] bg-white p-2.5 sm:grid-cols-[2rem_minmax(0,11rem)_minmax(0,1fr)] sm:items-center">
                <span className="hidden text-center text-[12px] font-bold tabular-nums text-[var(--text-muted)] sm:block">{num(index + 1, fa)}</span>
                <LocalizedDatePicker value={session.localDate} onValueChange={(value) => updateSession(session.key, { localDate: value })} locale={locale} ariaLabel={fa ? `تاریخ جلسه ${index + 1}` : `Session ${index + 1} date`} />
                <TimeRangeField
                  start={session.startMinute}
                  end={session.endMinute}
                  fa={fa}
                  invalid={session.endMinute <= session.startMinute}
                  onChange={({ start, end }) => updateSession(session.key, { startMinute: start, endMinute: Math.min(end, 1439) })}
                  onRemove={() => setSessions((current) => current.filter((item) => item.key !== session.key))}
                />
              </li>
            ))}
          </ul>
          <button type="button" onClick={addSession} className="mt-2 inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--border-default)] text-xs font-bold text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]">
            <CalendarPlus className="h-4 w-4" />{fa ? 'افزودن جلسه (یک هفته بعد)' : 'Add a session (a week later)'}
          </button>
        </div>

        {deleteState !== 'idle' && (
          <div role="alert" className={cn('flex items-start gap-2.5 rounded-2xl px-3.5 py-3 text-[12.5px] leading-6', typeof deleteState === 'object' ? 'border border-amber-500/25 bg-amber-500/[0.08] text-amber-900' : 'border border-red-500/20 bg-red-50/70 text-red-800')}>
            <AlertTriangle className="mt-1 h-4 w-4 shrink-0" />
            <p>
              {typeof deleteState === 'object'
                ? (fa ? `${num(deleteState.active, true)} نفر هنوز ثبت‌نام یا در انتظارند. به‌جای حذف، دوره را «بایگانی» کنید تا سابقه بماند.` : `${deleteState.active} people are still enrolled or waiting. Archive the course instead to keep the record.`)
                : (fa ? 'دوره و سابقه ثبت‌نام‌های لغوشده‌اش برای همیشه حذف می‌شود. دوباره «حذف» را بزنید.' : 'The course and its cancelled sign-ups are deleted for good. Press Delete again.')}
            </p>
          </div>
        )}

        {error && <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2.5 text-xs font-medium text-red-700">{error}</p>}

        <div className="flex flex-col-reverse gap-2 border-t border-[var(--border-subtle)] pt-4 sm:flex-row sm:items-center">
          {course && (
            typeof deleteState === 'object' ? (
              <button type="button" onClick={() => { setStatus('ARCHIVED'); setDeleteState('idle') }} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-[var(--border-default)] bg-white px-4 text-sm font-bold text-[var(--text-primary)]">
                {fa ? 'بایگانی به‌جای حذف' : 'Archive instead'}
              </button>
            ) : (
              <button type="button" disabled={busy !== null} onClick={() => void remove()} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-bold text-red-600 hover:bg-red-50 disabled:opacity-50">
                {busy === 'delete' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}{fa ? 'حذف' : 'Delete'}
              </button>
            )
          )}
          <span className="hidden flex-1 sm:block" aria-hidden />
          <button type="button" onClick={onClose} disabled={busy !== null} className="min-h-11 rounded-xl border border-[var(--border-default)] bg-white px-4 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] disabled:opacity-50">{fa ? 'انصراف' : 'Cancel'}</button>
          <button type="button" onClick={() => void save()} disabled={busy !== null} className="spatial-press inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--text-primary)] px-5 text-sm font-bold text-white shadow-[var(--shadow-control)] disabled:opacity-60">
            {busy === 'save' && <Loader2 className="h-4 w-4 animate-spin" />}
            {course ? (fa ? 'ذخیره تغییرات' : 'Save changes') : status === 'PUBLISHED' ? (fa ? 'ساخت و شروع ثبت‌نام' : 'Create and open') : (fa ? 'ساخت دوره' : 'Create course')}
          </button>
        </div>
      </div>
    </DialogShell>
  )
}
