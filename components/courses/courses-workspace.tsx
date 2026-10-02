'use client'

import { useMemo, useState } from 'react'
import {
  Archive,
  Bot,
  CalendarClock,
  Check,
  GraduationCap,
  ListOrdered,
  MapPin,
  MonitorPlay,
  Pencil,
  Plus,
  Sparkles,
  UserRound,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/dashboard/page-header'
import { StatusChip } from '@/components/ui/status-chip'
import { CourseEditor } from '@/components/courses/course-editor'
import { CourseRoster } from '@/components/courses/course-roster'
import {
  FORMAT_META,
  STATUS_META,
  nextSession,
  num,
  toman,
  type CourseRow,
  type Locale,
} from '@/components/courses/course-model'

type Filter = 'active' | 'draft' | 'archived'

const TEMPLATES: Array<{ key: string; fa: string; en: string; capacity: number; sessions: number; minutes: number; format: CourseRow['format'] }> = [
  { key: 'term', fa: 'دوره ترمی (۸ جلسه)', en: 'Term course (8 sessions)', capacity: 15, sessions: 8, minutes: 90, format: 'IN_PERSON' },
  { key: 'workshop', fa: 'کارگاه یک‌روزه', en: 'One-day workshop', capacity: 25, sessions: 1, minutes: 240, format: 'IN_PERSON' },
  { key: 'online', fa: 'کلاس آنلاین (۴ جلسه)', en: 'Online class (4 sessions)', capacity: 40, sessions: 4, minutes: 60, format: 'ONLINE' },
]
export type CourseTemplate = (typeof TEMPLATES)[number]

/**
 * Courses & enrollment. Each course is a card with its seats, next session
 * and price; the roster opens in a side sheet. The agent signs people up in
 * chat against the same seats, and moves the waitlist up on cancellations.
 */
export function CoursesWorkspace({
  locale,
  initialCourses,
  initialRosterId,
}: {
  locale: Locale
  initialCourses: CourseRow[]
  initialRosterId?: string
}) {
  const fa = locale === 'fa'
  const [courses, setCourses] = useState(initialCourses)
  const [filter, setFilter] = useState<Filter>('active')
  const [editor, setEditor] = useState<{ open: boolean; course?: CourseRow | null; template?: CourseTemplate | null }>({ open: false })
  const [rosterId, setRosterId] = useState<string | null>(initialRosterId && initialCourses.some((course) => course.id === initialRosterId) ? initialRosterId : null)

  const groups = useMemo(() => ({
    active: courses.filter((course) => course.status === 'PUBLISHED' || course.status === 'CLOSED'),
    draft: courses.filter((course) => course.status === 'DRAFT'),
    archived: courses.filter((course) => course.status === 'ARCHIVED'),
  }), [courses])
  const visible = groups[filter]
  const totals = useMemo(() => {
    const live = groups.active
    return {
      open: live.filter((course) => course.status === 'PUBLISHED').length,
      enrolled: live.reduce((sum, course) => sum + course.seats.taken, 0),
      seatsLeft: live.reduce((sum, course) => sum + course.seats.left, 0),
      waitlisted: live.reduce((sum, course) => sum + course.seats.waitlisted, 0),
    }
  }, [groups])

  function upsert(course: CourseRow) {
    setCourses((current) => current.some((item) => item.id === course.id)
      ? current.map((item) => (item.id === course.id ? course : item))
      : [course, ...current])
    setFilter(course.status === 'DRAFT' ? 'draft' : course.status === 'ARCHIVED' ? 'archived' : 'active')
  }

  const rosterCourse = courses.find((course) => course.id === rosterId) ?? null

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        icon={GraduationCap}
        title={fa ? 'دوره‌ها' : 'Courses'}
        subtitle={fa
          ? 'دوره، کلاس یا کارگاه را با ظرفیت و جلسات تعریف کنید؛ ایجنت در گفتگو معرفی و ثبت‌نام می‌کند و با پر شدن ظرفیت، فهرست انتظار می‌سازد.'
          : 'Define courses with capacity and sessions; the agent presents them, enrols people in chat and keeps a waitlist when full.'}
        actions={courses.length ? (
          <button type="button" onClick={() => setEditor({ open: true })} className="spatial-press inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--text-primary)] px-4 text-sm font-bold text-white shadow-[var(--shadow-control)] transition-opacity hover:opacity-90">
            <Plus className="h-4 w-4" />{fa ? 'دوره جدید' : 'New course'}
          </button>
        ) : undefined}
      />

      {courses.length === 0 ? (
        <Onboarding fa={fa} onCreate={(template) => setEditor({ open: true, template })} />
      ) : (
        <>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="ui-seg w-full grid-cols-3 lg:w-[24rem]" role="tablist" aria-label={fa ? 'وضعیت دوره‌ها' : 'Course status'}>
              {([
                ['active', fa ? 'فعال' : 'Active', groups.active.length],
                ['draft', fa ? 'پیش‌نویس' : 'Drafts', groups.draft.length],
                ['archived', fa ? 'بایگانی' : 'Archived', groups.archived.length],
              ] as const).map(([key, label, count]) => (
                <button key={key} type="button" role="tab" aria-selected={filter === key} onClick={() => setFilter(key)} className="ui-seg-tab text-sm">
                  {label}
                  <span className="rounded-full bg-black/[0.07] px-1.5 text-[12px] tabular-nums">{num(count, fa)}</span>
                </button>
              ))}
            </div>
            <dl className="grid grid-cols-4 divide-x divide-[var(--border-subtle)] overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-white/80 rtl:divide-x-reverse lg:min-w-[28rem]">
              <Kpi label={fa ? 'در حال ثبت‌نام' : 'Enrolling'} value={totals.open} fa={fa} />
              <Kpi label={fa ? 'ثبت‌نامی' : 'Enrolled'} value={totals.enrolled} fa={fa} />
              <Kpi label={fa ? 'جای خالی' : 'Seats left'} value={totals.seatsLeft} fa={fa} />
              <Kpi label={fa ? 'در انتظار' : 'Waitlist'} value={totals.waitlisted} fa={fa} tone={totals.waitlisted ? 'signal' : undefined} />
            </dl>
          </div>

          {visible.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {visible.map((course) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  fa={fa}
                  onEdit={() => setEditor({ open: true, course })}
                  onRoster={() => setRosterId(course.id)}
                />
              ))}
            </div>
          ) : (
            <p className="rounded-card border border-dashed border-[var(--border-default)] p-8 text-center text-sm text-[var(--text-muted)]">
              {filter === 'draft'
                ? (fa ? 'پیش‌نویسی ندارید. دوره تا منتشر نشود، ایجنت آن را معرفی نمی‌کند.' : 'No drafts. The agent only offers published courses.')
                : filter === 'archived'
                  ? (fa ? 'دوره بایگانی‌شده‌ای ندارید.' : 'No archived courses.')
                  : (fa ? 'دوره فعالی ندارید؛ یک پیش‌نویس را منتشر کنید یا دوره تازه بسازید.' : 'No active course; publish a draft or create one.')}
            </p>
          )}

          <AgentStrip fa={fa} />
        </>
      )}

      {editor.open && (
        <CourseEditor
          locale={locale}
          course={editor.course ?? null}
          template={editor.template ?? null}
          onClose={() => setEditor({ open: false })}
          onSaved={(course) => { upsert(course); setEditor({ open: false }) }}
          onDeleted={(id) => { setCourses((current) => current.filter((item) => item.id !== id)); setEditor({ open: false }) }}
        />
      )}

      {rosterCourse && (
        <CourseRoster
          locale={locale}
          course={rosterCourse}
          onClose={() => setRosterId(null)}
          onSeatsChanged={(seats) => setCourses((current) => current.map((item) => (item.id === rosterCourse.id ? { ...item, seats } : item)))}
        />
      )}
    </div>
  )
}

function Kpi({ label, value, fa, tone }: { label: string; value: number; fa: boolean; tone?: 'signal' }) {
  return (
    <div className="px-3 py-2.5 text-center">
      <dt className="text-[12px] text-[var(--text-muted)]">{label}</dt>
      <dd className={cn('mt-0.5 text-lg font-bold tabular-nums', tone === 'signal' ? 'text-[var(--signal-strong)]' : 'text-[var(--text-primary)]')}>{num(value, fa)}</dd>
    </div>
  )
}

function CourseCard({ course, fa, onEdit, onRoster }: { course: CourseRow; fa: boolean; onEdit: () => void; onRoster: () => void }) {
  const meta = STATUS_META[course.status]
  const upcoming = nextSession(course)
  const fill = course.capacity ? Math.min(100, Math.round((course.seats.taken / course.capacity) * 100)) : 0
  const full = course.seats.left === 0
  const when = upcoming
    ? new Intl.DateTimeFormat(fa ? 'fa-IR-u-ca-persian' : 'en-US', { timeZone: course.timezone, weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(upcoming.session.startsAt))
    : null
  const FormatIcon = course.format === 'ONLINE' ? MonitorPlay : MapPin

  return (
    <article className={cn('spatial-surface flex flex-col gap-3 rounded-card p-4 sm:p-5', course.status === 'ARCHIVED' && 'opacity-75')}>
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[var(--text-primary)] text-white shadow-[var(--shadow-control)]"><GraduationCap className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="truncate text-[15px] font-bold text-[var(--text-primary)]">{course.title}</h3>
            <StatusChip tone={meta.tone} dot>{fa ? meta.fa : meta.en}</StatusChip>
            {course.status === 'PUBLISHED' && full && <StatusChip tone={course.waitlistEnabled ? 'signal' : 'warn'}>{course.waitlistEnabled ? (fa ? 'پر · فهرست انتظار باز' : 'Full · waitlist open') : (fa ? 'تکمیل' : 'Full')}</StatusChip>}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[var(--text-muted)]">
            <span className="font-semibold text-[var(--text-secondary)]">{toman(course.price, fa)}</span>
            <span className="inline-flex items-center gap-1"><FormatIcon className="h-3.5 w-3.5" />{course.format === 'ONLINE' ? (fa ? FORMAT_META.ONLINE.fa : FORMAT_META.ONLINE.en) : course.location || (fa ? FORMAT_META[course.format].fa : FORMAT_META[course.format].en)}</span>
            {course.instructor && <span className="inline-flex items-center gap-1"><UserRound className="h-3.5 w-3.5" />{course.instructor}</span>}
          </p>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between text-[12px]">
          <span className="inline-flex items-center gap-1 text-[var(--text-secondary)]"><Users className="h-3.5 w-3.5" />{fa ? `${num(course.seats.taken, true)} از ${num(course.capacity, true)} نفر` : `${course.seats.taken} of ${course.capacity}`}</span>
          <span className={cn('font-semibold tabular-nums', full ? 'text-amber-700' : 'text-emerald-700')}>
            {full ? (fa ? 'ظرفیت تکمیل' : 'Full') : (fa ? `${num(course.seats.left, true)} جای خالی` : `${course.seats.left} left`)}
            {course.seats.waitlisted > 0 && <span className="ms-1.5 text-[var(--signal-strong)]">{fa ? `· ${num(course.seats.waitlisted, true)} در انتظار` : `· ${course.seats.waitlisted} waiting`}</span>}
          </span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-black/[0.06]" role="progressbar" aria-valuemin={0} aria-valuemax={course.capacity} aria-valuenow={course.seats.taken} aria-label={fa ? 'ظرفیت پرشده' : 'Seats taken'}>
          <div className={cn('h-full rounded-full transition-[width] duration-500', full ? 'bg-amber-500' : 'bg-[var(--text-primary)]')} style={{ width: `${fill}%` }} />
        </div>
      </div>

      <p className="flex items-center gap-1.5 rounded-xl bg-[var(--bg-subtle)] px-3 py-2 text-[13px] text-[var(--text-secondary)]">
        <CalendarClock className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
        {course.sessions.length === 0
          ? (fa ? 'هنوز جلسه‌ای زمان‌بندی نشده' : 'No sessions scheduled yet')
          : upcoming
            ? (fa ? `جلسه ${num(upcoming.index + 1, true)} از ${num(course.sessions.length, true)}: ${when}` : `Session ${upcoming.index + 1} of ${course.sessions.length}: ${when}`)
            : (fa ? `${num(course.sessions.length, true)} جلسه برگزار شد` : `All ${course.sessions.length} sessions held`)}
      </p>

      <div className="mt-auto flex gap-2">
        <button type="button" onClick={onRoster} className="spatial-press inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--text-primary)] px-3 text-xs font-bold text-white">
          <ListOrdered className="h-3.5 w-3.5" />{fa ? 'ثبت‌نام‌شدگان' : 'Roster'}
        </button>
        <button type="button" onClick={onEdit} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-[var(--border-default)] bg-white px-3 text-xs font-bold text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]">
          {course.status === 'ARCHIVED' ? <Archive className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}{fa ? 'ویرایش' : 'Edit'}
        </button>
      </div>
    </article>
  )
}

function AgentStrip({ fa }: { fa: boolean }) {
  const steps = fa
    ? ['مشتری درباره دوره می‌پرسد', 'ایجنت قیمت، جلسات و جای خالی واقعی را می‌گوید', 'بعد از تأیید، ثبت‌نام یا فهرست انتظار', 'شما در پنل و ربات تلگرام خبردار می‌شوید']
    : ['A customer asks about a course', 'The agent quotes real price, sessions and seats', 'After a yes: enrolled or waitlisted', 'You get a panel and Telegram alert']
  return (
    <section className="spatial-surface rounded-card p-4 sm:p-5">
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--text-primary)] text-white"><Bot className="h-4 w-4" /></span>
        <p className="ui-h3">{fa ? 'ثبت‌نام در گفتگو' : 'Enrollment in chat'}</p>
      </div>
      <ol className="mt-3 grid gap-2 sm:grid-cols-4">
        {steps.map((step, index) => (
          <li key={step} className="flex items-start gap-2 rounded-xl bg-[var(--bg-subtle)] px-3 py-2 text-[13px] leading-6 text-[var(--text-secondary)]">
            <span className={cn('mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[12px] font-bold', index === steps.length - 1 ? 'bg-[var(--ok)] text-white' : 'bg-[var(--signal-soft)] text-[var(--signal-strong)]')}>
              {index === steps.length - 1 ? <Check className="h-3 w-3" strokeWidth={3} /> : num(index + 1, fa)}
            </span>
            {step}
          </li>
        ))}
      </ol>
    </section>
  )
}

function Onboarding({ fa, onCreate }: { fa: boolean; onCreate: (template?: CourseTemplate | null) => void }) {
  return (
    <section className="spatial-surface rounded-card p-6 text-center sm:p-8">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[var(--text-primary)] text-white shadow-[var(--shadow-control)]"><GraduationCap className="h-6 w-6" /></span>
      <h2 className="ui-h2 mt-4">{fa ? 'اولین دوره را بسازید' : 'Create your first course'}</h2>
      <p className="mx-auto mt-1.5 max-w-lg text-sm leading-7 text-[var(--text-muted)]">
        {fa ? 'ظرفیت، جلسات و قیمت را یک بار تعریف کنید. ایجنت از همان لحظه دوره را معرفی می‌کند و در گفتگو ثبت‌نام می‌گیرد.' : 'Set capacity, sessions and price once; the agent starts presenting it and enrolling people right away.'}
      </p>
      <div className="mx-auto mt-5 grid max-w-2xl gap-2 sm:grid-cols-3">
        {TEMPLATES.map((template) => (
          <button key={template.key} type="button" onClick={() => onCreate(template)} className="spatial-press flex flex-col items-start gap-1 rounded-2xl border border-[var(--border-default)] bg-white p-3.5 text-start transition-colors hover:border-[var(--border-strong)]">
            <Sparkles className="h-4 w-4 text-[var(--text-secondary)]" />
            <span className="text-[13px] font-bold text-[var(--text-primary)]">{fa ? template.fa : template.en}</span>
            <span className="text-[12px] text-[var(--text-muted)]">{fa ? `${num(template.capacity, true)} نفر · ${FORMAT_META[template.format].fa}` : `${template.capacity} seats · ${FORMAT_META[template.format].en}`}</span>
          </button>
        ))}
      </div>
      <button type="button" onClick={() => onCreate(null)} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--text-primary)] px-5 text-sm font-bold text-white">
        <Plus className="h-4 w-4" />{fa ? 'دوره خالی' : 'Blank course'}
      </button>
    </section>
  )
}
