'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useFormStatus } from 'react-dom'
import { Check, ChevronsUpDown, LoaderCircle, Search, ShieldCheck, Undo2 } from 'lucide-react'
import {
  loadSwitchableUsers,
  openAdminPanel,
  startUserImpersonation,
  stopUserImpersonation,
} from '@/app/actions/impersonation'
import type { SwitchableUser } from '@/lib/admin/user-switcher'
import { MobileBottomSheet } from '@/components/ui/mobile-bottom-sheet'
import { PlanRing, PlanRingLegend } from '@/components/ui/plan-ring'
import { relativeTime } from '@/lib/format'
import { displayPhone, toEnglishDigits } from '@/lib/phone'
import { cn } from '@/lib/utils'

/** Sentinel for the "back to my own account" row's pending state. */
const OWN_ACCOUNT = '__own__'

function useIsMobile() {
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(max-width: 639px)')
    const update = () => setMobile(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return mobile
}

function Avatar({ label, active = false, className }: { label: string; active?: boolean; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid shrink-0 place-items-center rounded-full border text-[13px] font-bold',
        active
          ? 'border-amber-300 bg-amber-50 text-amber-800'
          : 'border-black/[0.07] bg-[var(--bg-surface)] text-[var(--text-primary)]',
        className,
      )}
    >
      {label.trim().charAt(0) || '؟'}
    </span>
  )
}

/**
 * Platform-owner account switcher. Takes the plan card's slot in the dashboard
 * header: a popover on desktop, a bottom sheet on phones. Accounts arrive from
 * the server already ordered by most recent activity.
 */
export function UserSwitcher({
  currentUserId,
  currentName,
  impersonating,
  fa,
  compact = false,
  badge,
  detail,
}: {
  currentUserId: string
  currentName: string
  impersonating: boolean
  fa: boolean
  compact?: boolean
  /** Shown in place of the initial avatar, e.g. the plan ring. */
  badge?: ReactNode
  /** Shown in place of the status line, e.g. the account's reply credit. */
  detail?: ReactNode
}) {
  const isMobile = useIsMobile()
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [users, setUsers] = useState<SwitchableUser[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [query, setQuery] = useState('')
  const [pendingId, setPendingId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setFailed(false)
    loadSwitchableUsers()
      .then((rows) => { if (!cancelled) setUsers(rows) })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [open])

  // Desktop popover: dismiss on outside press or Escape. The phone sheet
  // handles both itself.
  useEffect(() => {
    if (!open || isMobile) return
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setOpen(false)
      triggerRef.current?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, isMobile])

  const visible = useMemo(() => {
    const needle = toEnglishDigits(query).trim().toLowerCase()
    if (!users || !needle) return users ?? []
    return users.filter((user) =>
      [user.name ?? '', user.workspaceName, user.phone, displayPhone(user.phone) ?? '']
        .some((value) => value.toLowerCase().includes(needle)),
    )
  }, [users, query])

  const title = fa ? 'تعویض کاربر' : 'Switch user'
  const subtitle = impersonating
    ? (fa ? 'در حال مشاهده پنل این کاربر' : 'Viewing this user’s panel')
    : (fa ? 'حساب خودم · تعویض کاربر' : 'My account · switch user')

  const list = (
    <div className="flex min-h-0 flex-1 flex-col">
      <label className="relative block shrink-0">
        <span className="sr-only">{fa ? 'جستجوی کاربر' : 'Search users'}</span>
        <Search aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={fa ? 'نام، کسب‌وکار یا شماره…' : 'Name, business or phone…'}
          autoFocus={!isMobile}
          className="h-11 w-full rounded-control border border-black/[0.08] bg-white ps-9 pe-3 text-base text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] sm:text-[13px]"
        />
      </label>

      {impersonating && (
        <form action={stopUserImpersonation} onSubmit={() => setPendingId(OWN_ACCOUNT)} className="mt-2 shrink-0">
        <button
          type="submit"
          disabled={pendingId !== null}
          className="spatial-press flex min-h-12 w-full items-center gap-2.5 rounded-control border border-amber-300/70 bg-amber-50 px-3 text-start text-[13px] font-bold text-amber-950 outline-none focus-visible:ring-2 focus-visible:ring-amber-950 disabled:cursor-wait disabled:opacity-60"
        >
          {pendingId === OWN_ACCOUNT
            ? <LoaderCircle aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none" />
            : <Undo2 aria-hidden="true" className="h-4 w-4 shrink-0 rtl:-scale-x-100" />}
          {fa ? 'بازگشت به حساب خودم' : 'Back to my account'}
        </button>
        </form>
      )}

      <div className="-mx-1 mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain px-1">
        {failed ? (
          <p role="alert" className="px-2 py-6 text-center text-[13px] text-red-600">
            {fa ? 'انجام نشد. دوباره تلاش کنید.' : 'Something went wrong. Try again.'}
          </p>
        ) : users === null ? (
          <div className="grid place-items-center py-8 text-[var(--text-muted)]" role="status">
            <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />
            <span className="sr-only">{fa ? 'در حال بارگذاری' : 'Loading'}</span>
          </div>
        ) : visible.length === 0 ? (
          <p className="px-2 py-6 text-center text-[13px] text-[var(--text-muted)]">
            {fa ? 'کاربری پیدا نشد.' : 'No users found.'}
          </p>
        ) : (
          <ul className="space-y-0.5">
            {visible.map((user) => {
              const isCurrent = user.id === currentUserId
              const phone = displayPhone(user.phone) ?? user.phone
              return (
                <li key={user.id}>
                  <form action={startUserImpersonation} onSubmit={() => setPendingId(user.id)}>
                  <input type="hidden" name="userId" value={user.id} />
                  <button
                    type="submit"
                    disabled={isCurrent || pendingId !== null}
                    aria-current={isCurrent ? 'true' : undefined}
                    className={cn(
                      'flex min-h-14 w-full items-center gap-2.5 rounded-control px-2 py-1.5 text-start outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:cursor-default',
                      isCurrent ? 'bg-amber-50' : 'hover:bg-black/[0.04]',
                      pendingId !== null && pendingId !== user.id && 'opacity-50',
                    )}
                  >
                    <PlanRing
                      standing={{ plan: user.plan, active: user.planActive }}
                      fa={fa}
                      className="h-10 w-10"
                      innerClassName={cn(
                        'text-[13px] font-bold',
                        isCurrent ? 'bg-amber-100 text-amber-800' : 'bg-[var(--bg-surface)] text-[var(--text-primary)]',
                      )}
                    >
                      {(user.name ?? user.workspaceName).trim().charAt(0) || '؟'}
                    </PlanRing>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-bold leading-5 text-[var(--text-primary)]">
                        {user.name ?? user.workspaceName}
                      </span>
                      <span className="flex min-w-0 items-center gap-1.5 text-[12px] leading-4 text-[var(--text-muted)]">
                        {user.name && user.workspaceName !== user.name && (
                          <span className="truncate">{user.workspaceName}</span>
                        )}
                        <span dir="ltr" className="shrink-0 tabular-nums">{phone}</span>
                      </span>
                    </span>
                    <span className="shrink-0 text-[12px] leading-4 text-[var(--text-muted)]">
                      {pendingId === user.id
                        ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                        : isCurrent
                          ? <Check aria-hidden="true" className="h-4 w-4 text-amber-700" />
                          : relativeTime(user.lastActivityAt, fa ? 'fa' : 'en')}
                    </span>
                  </button>
                  </form>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* What the ring around each avatar means. */}
      <PlanRingLegend fa={fa} className="mt-2 shrink-0 border-t border-black/[0.06] px-1 pt-2" />
    </div>
  )

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        ref={triggerRef}
        type="button"
        dir={fa ? 'rtl' : 'ltr'}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${title}؛ ${currentName}؛ ${subtitle}`}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'spatial-press flex min-w-0 items-center border bg-white/90 text-start text-[var(--text-primary)] shadow-[var(--elev-1)] outline-none transition-[border-color,box-shadow,transform] duration-200 focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 motion-reduce:transition-none',
          impersonating
            ? 'border-amber-300/80 hover:border-amber-400'
            : 'border-black/[0.08] hover:border-black/[0.15]',
          compact
            ? 'h-12 w-full max-w-[16rem] gap-2 rounded-control px-1.5 pe-2.5'
            : 'h-14 w-[14rem] gap-2.5 rounded-card px-3 lg:w-[14.5rem] xl:h-[4.25rem] xl:w-[16rem] xl:px-3.5',
        )}
      >
        {badge ?? (
          <Avatar
            label={currentName}
            active={impersonating}
            className={compact ? 'h-9 w-9' : 'h-10 w-10 xl:h-12 xl:w-12 xl:text-[15px]'}
          />
        )}
        <span className="min-w-0 flex-1">
          <span className={cn(
            'block truncate font-bold',
            compact ? 'text-[12px] leading-4' : 'text-[13px] leading-4 xl:text-[15px] xl:leading-5',
          )}>
            {currentName}
          </span>
          {detail ?? (
            <span className={cn(
              'block truncate text-[12px] leading-4',
              compact ? 'mt-0.5' : 'mt-1',
              impersonating ? 'text-amber-700' : 'text-[var(--text-muted)]',
            )}>
              {subtitle}
            </span>
          )}
        </span>
        <ChevronsUpDown aria-hidden="true" className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" />
      </button>

      {isMobile ? (
        <MobileBottomSheet
          open={open}
          title={title}
          description={fa ? 'به ترتیب آخرین فعالیت' : 'Most recently active first'}
          closeLabel={fa ? 'بستن' : 'Close'}
          size="large"
          contentClassName="flex flex-col"
          triggerRef={triggerRef}
          onClose={() => setOpen(false)}
        >
          {list}
        </MobileBottomSheet>
      ) : open && (
        <div
          role="dialog"
          aria-label={title}
          dir={fa ? 'rtl' : 'ltr'}
          className="absolute end-0 top-full z-50 mt-2 flex max-h-[min(32rem,calc(100dvh-7rem))] w-[22rem] flex-col rounded-card border border-black/[0.08] bg-white p-2.5 shadow-[var(--elev-2)]"
        >
          {list}
        </div>
      )}
    </div>
  )
}

function AdminPanelSubmit({ fa }: { fa: boolean }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={fa ? 'ورود به پنل ادمین' : 'Open admin panel'}
      title={fa ? 'پنل ادمین' : 'Admin panel'}
      className="spatial-press inline-flex h-12 w-12 items-center justify-center rounded-card border border-black/[0.07] bg-white/80 text-[var(--text-muted)] shadow-[var(--elev-1)] transition-colors hover:border-black/[0.12] hover:bg-white hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 xl:h-14 xl:w-14 xl:rounded-card"
    >
      {pending
        ? <LoaderCircle aria-hidden="true" className="h-[1.05rem] w-[1.05rem] animate-spin motion-reduce:animate-none xl:h-[1.15rem] xl:w-[1.15rem]" />
        : <ShieldCheck aria-hidden="true" className="h-[1.05rem] w-[1.05rem] xl:h-[1.15rem] xl:w-[1.15rem]" />}
    </button>
  )
}

/** Owner-only header shortcut into /admin, reusing the dashboard sign-in. */
export function AdminPanelButton({ fa }: { fa: boolean }) {
  return (
    <form action={openAdminPanel}>
      <AdminPanelSubmit fa={fa} />
    </form>
  )
}
