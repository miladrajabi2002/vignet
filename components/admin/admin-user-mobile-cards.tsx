'use client'

import Link from 'next/link'
import { useRef, useState, type MouseEvent } from 'react'
import {
  ArrowLeft,
  Bot,
  Building2,
  CalendarDays,
  CreditCard,
  MessageSquareText,
  Package,
  Phone,
  UserRound,
} from 'lucide-react'
import { MobileBottomSheet } from '@/components/ui/mobile-bottom-sheet'
import { CopyButton } from '@/components/ui/copy-button'
import { cn } from '@/lib/utils'

type Tone = 'default' | 'info' | 'muted' | 'success' | 'warning' | 'danger'

export interface AdminMobileUser {
  id: string
  name: string
  phone: string
  joinedAt: string
  workspace: null | {
    id: string
    name: string
    planLabel: string
    planTone: Tone
    statusLabel: string
    statusTone: Tone
    counts: {
      agents: string
      conversations: string
      payments: string
      products: string
    }
  }
}

const TONE_CLASSES: Record<Tone, { badge: string; dot: string }> = {
  default: { badge: 'bg-zinc-900 text-white', dot: 'bg-white' },
  info: { badge: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200', dot: 'bg-blue-500' },
  muted: { badge: 'bg-zinc-100 text-zinc-600', dot: 'bg-zinc-400' },
  success: { badge: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200', dot: 'bg-emerald-500' },
  warning: { badge: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200', dot: 'bg-amber-500' },
  danger: { badge: 'bg-red-50 text-red-700 ring-1 ring-red-200', dot: 'bg-red-500' },
}

function StatusBadge({ label, tone }: { label: string; tone: Tone }) {
  const styles = TONE_CLASSES[tone]
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-semibold', styles.badge)}>
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', styles.dot)} aria-hidden="true" />
      {label}
    </span>
  )
}

export function AdminUserMobileCards({ users }: { users: AdminMobileUser[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'relations'>('overview')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const selected = users.find((user) => user.id === selectedId) ?? null

  function openDetails(event: MouseEvent<HTMLButtonElement>, userId: string) {
    triggerRef.current = event.currentTarget
    setActiveTab('overview')
    setSelectedId(userId)
  }

  return (
    <>
      <div className="grid gap-3 md:hidden">
        {users.map((user) => (
          <button
            key={user.id}
            type="button"
            onClick={(event) => openDetails(event, user.id)}
            aria-haspopup="dialog"
            className="spatial-press w-full rounded-2xl border border-black/[0.07] bg-white p-4 text-start shadow-[var(--shadow-soft)] outline-none transition-[border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-black/50"
          >
            <span className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-zinc-100 text-zinc-600">
                <UserRound className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-zinc-950">{user.name}</span>
                <span dir="ltr" className="mt-1 block truncate text-start text-xs text-zinc-500">{user.phone}</span>
              </span>
              {user.workspace && <StatusBadge label={user.workspace.planLabel} tone={user.workspace.planTone} />}
            </span>

            {user.workspace && (
              <span className="mt-4 block rounded-xl bg-zinc-50 p-3">
                <span className="flex items-start justify-between gap-2">
                  <span className="min-w-0 truncate text-xs font-semibold text-zinc-800">{user.workspace.name}</span>
                  <StatusBadge label={user.workspace.statusLabel} tone={user.workspace.statusTone} />
                </span>
                <span className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <span><span className="block text-[11px] text-zinc-500">ایجنت</span><strong className="mt-1 block text-sm tabular-nums text-zinc-900">{user.workspace.counts.agents}</strong></span>
                  <span><span className="block text-[11px] text-zinc-500">گفتگو</span><strong className="mt-1 block text-sm tabular-nums text-zinc-900">{user.workspace.counts.conversations}</strong></span>
                  <span><span className="block text-[11px] text-zinc-500">پرداخت</span><strong className="mt-1 block text-sm tabular-nums text-zinc-900">{user.workspace.counts.payments}</strong></span>
                </span>
              </span>
            )}

            <span className="mt-3 flex min-h-11 items-center justify-between border-t border-zinc-100 pt-3">
              <span className="text-[11px] text-zinc-500">عضویت: {user.joinedAt}</span>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-900">
                جزئیات سریع
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              </span>
            </span>
          </button>
        ))}
      </div>

      <MobileBottomSheet
        open={selected !== null}
        title={selected?.name ?? 'جزئیات کاربر'}
        description={selected?.workspace?.name ?? 'بدون کسب‌وکار'}
        closeLabel="بستن جزئیات کاربر"
        size="large"
        motionPreset="detail"
        triggerRef={triggerRef}
        onClose={() => setSelectedId(null)}
        footer={selected ? (
          <Link
            href={`/admin/users/${selected.id}`}
            className="spatial-press inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-black px-4 text-sm font-bold text-white shadow-[var(--shadow-control)]"
          >
            مشاهده پرونده کامل
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
        ) : undefined}
      >
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-zinc-100 p-1" role="tablist" aria-label="بخش‌های جزئیات کاربر">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'overview'}
                onClick={() => setActiveTab('overview')}
                className={cn('min-h-11 rounded-lg px-3 text-xs font-bold transition-colors', activeTab === 'overview' ? 'bg-white text-black shadow-sm' : 'text-zinc-500')}
              >
                اطلاعات کلی
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'relations'}
                onClick={() => setActiveTab('relations')}
                className={cn('min-h-11 rounded-lg px-3 text-xs font-bold transition-colors', activeTab === 'relations' ? 'bg-white text-black shadow-sm' : 'text-zinc-500')}
              >
                زیرمجموعه‌ها
              </button>
            </div>

            {activeTab === 'overview' ? (
              <div role="tabpanel" className="space-y-3">
                <section className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-zinc-100 text-zinc-600"><Phone className="h-4 w-4" aria-hidden="true" /></span>
                      <div className="min-w-0"><p className="text-[11px] text-zinc-500">شماره تلفن</p><p dir="ltr" className="mt-1 truncate text-start text-sm font-bold text-zinc-900">{selected.phone}</p></div>
                    </div>
                    <CopyButton value={selected.phone} label="کپی شماره تلفن" copiedLabel="شماره کپی شد" />
                  </div>
                </section>

                <section className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-zinc-200 p-4"><CalendarDays className="h-4 w-4 text-zinc-500" aria-hidden="true" /><p className="mt-3 text-[11px] text-zinc-500">تاریخ عضویت</p><p className="mt-1 text-xs font-bold text-zinc-900">{selected.joinedAt}</p></div>
                  <div className="rounded-2xl border border-zinc-200 p-4"><Building2 className="h-4 w-4 text-zinc-500" aria-hidden="true" /><p className="mt-3 text-[11px] text-zinc-500">کسب‌وکار</p><p className="mt-1 truncate text-xs font-bold text-zinc-900">{selected.workspace?.name ?? 'ثبت نشده'}</p></div>
                </section>

                {selected.workspace && (
                  <section className="rounded-2xl border border-zinc-200 p-4">
                    <p className="text-xs font-bold text-zinc-900">وضعیت حساب</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <StatusBadge label={selected.workspace.statusLabel} tone={selected.workspace.statusTone} />
                      <StatusBadge label={selected.workspace.planLabel} tone={selected.workspace.planTone} />
                    </div>
                  </section>
                )}
              </div>
            ) : (
              <div role="tabpanel" className="grid grid-cols-2 gap-3">
                {selected.workspace ? (
                  <>
                    <RelationCard icon={Bot} label="ایجنت‌ها" value={selected.workspace.counts.agents} />
                    <RelationCard icon={MessageSquareText} label="گفتگوها" value={selected.workspace.counts.conversations} />
                    <RelationCard icon={CreditCard} label="پرداخت‌ها" value={selected.workspace.counts.payments} />
                    <RelationCard icon={Package} label="محصولات" value={selected.workspace.counts.products} />
                    <Link href={`/admin/workspaces/${selected.workspace.id}`} className="col-span-2 inline-flex min-h-11 items-center justify-center rounded-xl border border-zinc-200 text-xs font-bold text-zinc-800">
                      مشاهده کسب‌وکار
                    </Link>
                  </>
                ) : (
                  <p className="col-span-2 rounded-2xl border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-500">زیرمجموعه‌ای برای این کاربر ثبت نشده است.</p>
                )}
              </div>
            )}
          </div>
        )}
      </MobileBottomSheet>
    </>
  )
}

function RelationCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Bot
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
      <Icon className="h-5 w-5 text-zinc-500" aria-hidden="true" />
      <p className="mt-4 text-[11px] text-zinc-500">{label}</p>
      <strong className="mt-1 block text-xl tabular-nums text-zinc-950">{value}</strong>
    </div>
  )
}
