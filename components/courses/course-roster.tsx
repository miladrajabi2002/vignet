'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Bot, CheckCircle2, Loader2, MessagesSquare, Phone, Trash2, UserPlus, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { displayPhone } from '@/lib/phone'
import { SideSheet } from '@/components/ui/side-sheet'
import { StatusChip } from '@/components/ui/status-chip'
import {
  ENROLLMENT_META,
  courseErrorMessage,
  enrollmentFromApi,
  num,
  type CourseRow,
  type EnrollmentRow,
  type EnrollmentStatus,
  type Locale,
  type SeatRow,
} from '@/components/courses/course-model'

/**
 * The roster of one course: who holds a seat (pending or confirmed), who is
 * waiting, and who withdrew. Confirming, cancelling and adding people by
 * hand all go through the same seat rules the agent uses.
 */
export function CourseRoster({
  locale,
  course,
  onClose,
  onSeatsChanged,
}: {
  locale: Locale
  course: CourseRow
  onClose: () => void
  onSeatsChanged: (seats: SeatRow) => void
}) {
  const fa = locale === 'fa'
  const [rows, setRows] = useState<EnrollmentRow[] | null>(null)
  const [seats, setSeats] = useState<SeatRow>(course.seats)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  // The parent passes a fresh callback each render; keep loads stable.
  const seatsChanged = useRef(onSeatsChanged)
  seatsChanged.current = onSeatsChanged

  const load = useCallback(async () => {
    const response = await fetch(`/api/courses/${course.id}`).catch(() => null)
    const data = await response?.json().catch(() => ({})) as { course?: { enrollments?: Array<Record<string, unknown>>; seats?: SeatRow } } | undefined
    if (!response?.ok || !data?.course) { setError(courseErrorMessage(undefined, fa)); setRows([]); return }
    setRows((data.course.enrollments ?? []).map(enrollmentFromApi))
    if (data.course.seats) { setSeats(data.course.seats); seatsChanged.current(data.course.seats) }
  }, [course.id, fa])

  useEffect(() => { void load() }, [load])

  const grouped = useMemo(() => {
    const map: Record<EnrollmentStatus, EnrollmentRow[]> = { PENDING: [], CONFIRMED: [], WAITLISTED: [], CANCELLED: [] }
    for (const row of rows ?? []) map[row.status].push(row)
    return map
  }, [rows])

  async function setStatus(row: EnrollmentRow, status: EnrollmentStatus) {
    setBusy(row.id)
    setError('')
    const response = await fetch(`/api/courses/enrollments/${row.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }).catch(() => null)
    const data = await response?.json().catch(() => ({})) as { error?: string } | undefined
    setBusy(null)
    if (!response?.ok) { setError(courseErrorMessage(data?.error, fa)); return }
    await load()
  }

  async function remove(row: EnrollmentRow) {
    setBusy(row.id)
    const response = await fetch(`/api/courses/enrollments/${row.id}`, { method: 'DELETE' }).catch(() => null)
    setBusy(null)
    if (!response?.ok) { setError(courseErrorMessage(undefined, fa)); return }
    await load()
  }

  async function add() {
    if (name.trim().length < 2) { setError(fa ? 'نام را بنویسید.' : 'Enter a name.'); return }
    setBusy('add')
    setError('')
    const response = await fetch(`/api/courses/${course.id}/enrollments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), phone: phone.trim() || null, status: 'CONFIRMED' }),
    }).catch(() => null)
    const data = await response?.json().catch(() => ({})) as { error?: string } | undefined
    setBusy(null)
    if (!response?.ok) { setError(courseErrorMessage(data?.error, fa)); return }
    setName('')
    setPhone('')
    setAdding(false)
    await load()
  }

  const full = seats.left === 0
  const sections: Array<{ status: EnrollmentStatus; title: string; hint?: string }> = [
    { status: 'PENDING', title: fa ? 'در انتظار تأیید شما' : 'Awaiting your confirmation', hint: fa ? 'جا برایشان نگه داشته شده؛ بعد از هماهنگی (مثلاً پرداخت) قطعی کنید.' : 'Seat held; confirm once arranged (e.g. paid).' },
    { status: 'CONFIRMED', title: fa ? 'قطعی' : 'Confirmed' },
    { status: 'WAITLISTED', title: fa ? 'فهرست انتظار' : 'Waitlist', hint: fa ? 'به ترتیب ثبت؛ با هر انصراف، نفر اول خودکار جا می‌گیرد و در گفتگویش خبر می‌گیرد.' : 'In order; each withdrawal moves the first one up and tells them in their chat.' },
    { status: 'CANCELLED', title: fa ? 'انصراف' : 'Withdrawn' },
  ]

  return (
    <SideSheet
      title={course.title}
      subtitle={fa ? `${num(seats.taken, true)} از ${num(seats.capacity, true)} نفر · ${full ? 'ظرفیت تکمیل' : `${num(seats.left, true)} جای خالی`}` : `${seats.taken} of ${seats.capacity} · ${full ? 'full' : `${seats.left} left`}`}
      closeLabel={fa ? 'بستن' : 'Close'}
      onClose={onClose}
      footer={adding ? (
        <div className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder={fa ? 'نام و نام خانوادگی' : 'Full name'} className="input min-h-11 w-full rounded-xl text-sm" autoFocus />
            <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder={fa ? 'موبایل (اختیاری)' : 'Mobile (optional)'} inputMode="tel" dir="ltr" className="input min-h-11 w-full rounded-xl text-sm" />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setAdding(false)} className="min-h-11 flex-1 rounded-xl border border-[var(--border-default)] bg-white text-sm text-[var(--text-secondary)]">{fa ? 'انصراف' : 'Cancel'}</button>
            <button type="button" disabled={busy === 'add'} onClick={() => void add()} className="spatial-press inline-flex min-h-11 flex-[2] items-center justify-center gap-1.5 rounded-xl bg-[var(--text-primary)] text-sm font-bold text-white disabled:opacity-60">
              {busy === 'add' ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              {full && course.waitlistEnabled ? (fa ? 'افزودن به فهرست انتظار' : 'Add to waitlist') : (fa ? 'افزودن و قطعی کردن' : 'Add as confirmed')}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => { setAdding(true); setError('') }} className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-[var(--text-primary)] text-sm font-bold text-white">
          <UserPlus className="h-4 w-4" />{fa ? 'افزودن دستی' : 'Add someone'}
        </button>
      )}
    >
      <div className="space-y-5">
        <div className="h-2 overflow-hidden rounded-full bg-black/[0.06]">
          <div className={cn('h-full rounded-full', full ? 'bg-amber-500' : 'bg-[var(--text-primary)]')} style={{ width: `${seats.capacity ? Math.min(100, Math.round((seats.taken / seats.capacity) * 100)) : 0}%` }} />
        </div>

        {error && <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2.5 text-xs font-medium text-red-700">{error}</p>}

        {rows === null ? (
          <p className="flex items-center gap-2 text-sm text-[var(--text-muted)]"><Loader2 className="h-4 w-4 animate-spin" />{fa ? 'در حال بارگذاری…' : 'Loading…'}</p>
        ) : rows.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[var(--border-default)] p-6 text-center text-sm leading-7 text-[var(--text-muted)]">
            {fa ? 'هنوز کسی ثبت‌نام نکرده. وقتی مشتری در گفتگو ثبت‌نام کند، اینجا و در ربات تلگرام مدیریت خبردار می‌شوید.' : 'No sign-ups yet. When someone enrols in chat, you hear here and in the manager bot.'}
          </p>
        ) : sections.filter((section) => grouped[section.status].length).map((section) => (
          <section key={section.status}>
            <div className="mb-2 flex items-center gap-2">
              <h3 className="text-[13px] font-bold text-[var(--text-primary)]">{section.title}</h3>
              <span className="rounded-full bg-black/[0.06] px-1.5 text-[12px] font-bold tabular-nums text-[var(--text-secondary)]">{num(grouped[section.status].length, fa)}</span>
            </div>
            {section.hint && <p className="-mt-1 mb-2 text-[12px] leading-5 text-[var(--text-muted)]">{section.hint}</p>}
            <ul className="space-y-2">
              {grouped[section.status].map((row, index) => {
                const meta = ENROLLMENT_META[row.status]
                return (
                  <li key={row.id} className={cn('rounded-2xl border border-[var(--border-default)] bg-white p-3', row.status === 'CANCELLED' && 'bg-[var(--bg-base)]')}>
                    <div className="flex items-start gap-2.5">
                      {row.status === 'WAITLISTED' && <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--signal-soft)] text-[12px] font-bold tabular-nums text-[var(--signal-strong)]">{num(index + 1, fa)}</span>}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {row.contactId
                            ? <Link href={`/contacts/${row.contactId}`} className="truncate text-sm font-bold text-[var(--text-primary)] hover:underline">{row.name}</Link>
                            : <span className="truncate text-sm font-bold text-[var(--text-primary)]">{row.name}</span>}
                          <StatusChip tone={meta.tone} dot>{fa ? meta.fa : meta.en}</StatusChip>
                          {row.source === 'agent' && <StatusChip tone="signal"><Bot className="h-3 w-3" />{fa ? 'ایجنت' : 'Agent'}</StatusChip>}
                        </div>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[var(--text-muted)]">
                          {row.phone && <a href={`tel:${row.phone}`} dir="ltr" className="inline-flex items-center gap-1 tabular-nums hover:text-[var(--text-primary)]"><Phone className="h-3.5 w-3.5" />{displayPhone(row.phone)}</a>}
                          {row.conversationId && <Link href={`/conversations/${row.conversationId}`} className="inline-flex items-center gap-1 hover:text-[var(--text-primary)]"><MessagesSquare className="h-3.5 w-3.5" />{fa ? 'گفتگو' : 'Chat'}</Link>}
                          <span>{new Intl.DateTimeFormat(fa ? 'fa-IR-u-ca-persian' : 'en-US', { dateStyle: 'medium' }).format(new Date(row.createdAt))}</span>
                        </p>
                        {row.note && <p className="mt-1 text-[12px] leading-5 text-[var(--text-secondary)]">{row.note}</p>}
                      </div>
                    </div>
                    <div className="mt-2.5 flex flex-wrap justify-end gap-1.5">
                      {row.status === 'PENDING' && (
                        <RowButton busy={busy === row.id} onClick={() => void setStatus(row, 'CONFIRMED')} primary Icon={CheckCircle2}>{fa ? 'قطعی کن' : 'Confirm'}</RowButton>
                      )}
                      {row.status === 'WAITLISTED' && !full && (
                        <RowButton busy={busy === row.id} onClick={() => void setStatus(row, 'CONFIRMED')} primary Icon={CheckCircle2}>{fa ? 'جا بده' : 'Give a seat'}</RowButton>
                      )}
                      {row.status !== 'CANCELLED' ? (
                        <RowButton busy={busy === row.id} onClick={() => void setStatus(row, 'CANCELLED')} Icon={XCircle}>{fa ? 'انصراف' : 'Withdraw'}</RowButton>
                      ) : (
                        <RowButton busy={busy === row.id} onClick={() => void remove(row)} Icon={Trash2} danger>{fa ? 'حذف از سابقه' : 'Delete'}</RowButton>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
    </SideSheet>
  )
}

function RowButton({ children, onClick, busy, primary, danger, Icon }: {
  children: React.ReactNode
  onClick: () => void
  busy: boolean
  primary?: boolean
  danger?: boolean
  Icon: typeof CheckCircle2
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-bold transition-colors disabled:opacity-50',
        primary ? 'bg-[var(--text-primary)] text-white' : danger ? 'text-red-600 hover:bg-red-50' : 'border border-[var(--border-default)] bg-white text-[var(--text-secondary)] hover:border-[var(--border-strong)]',
      )}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}{children}
    </button>
  )
}
