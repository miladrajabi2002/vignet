'use client'

import Link from 'next/link'
import { useRef, useState, type MouseEvent } from 'react'
import {
  ArrowLeft,
  Cable,
  CalendarDays,
  CreditCard,
  MessageSquareText,
  Package,
  Phone,
  UserRound,
} from 'lucide-react'
import { MobileBottomSheet } from '@/components/ui/mobile-bottom-sheet'
import { CopyButton } from '@/components/ui/copy-button'
import { LEGACY_TONE, StatusChip } from '@/components/ui/status-chip'

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
      connections: string
      conversations: string
      payments: string
      products: string
    }
  }
}

function StatusBadge({ label, tone }: { label: string; tone: Tone }) {
  return <StatusChip tone={LEGACY_TONE[tone] ?? 'neutral'} dot>{label}</StatusChip>
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
            className="admin-record spatial-press w-full text-start outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            <span className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-control bg-[var(--bg-muted)] text-[var(--text-secondary)]">
                <UserRound className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-[var(--text-primary)]">{user.name}</span>
                <span dir="ltr" className="mt-1 block truncate text-start text-xs text-[var(--text-muted)]">{user.phone}</span>
              </span>
              {user.workspace && <StatusBadge label={user.workspace.planLabel} tone={user.workspace.planTone} />}
            </span>

            {user.workspace && (
              <span className="mt-3.5 block rounded-control bg-[var(--bg-surface)] p-3">
                <span className="flex items-center justify-end">
                  <StatusBadge label={user.workspace.statusLabel} tone={user.workspace.statusTone} />
                </span>
                <span className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <span><span className="block text-[12px] text-[var(--text-muted)]">اتصال</span><strong className="mt-1 block text-sm tabular-nums text-[var(--text-primary)]">{user.workspace.counts.connections}</strong></span>
                  <span><span className="block text-[12px] text-[var(--text-muted)]">گفتگو</span><strong className="mt-1 block text-sm tabular-nums text-[var(--text-primary)]">{user.workspace.counts.conversations}</strong></span>
                  <span><span className="block text-[12px] text-[var(--text-muted)]">محصول</span><strong className="mt-1 block text-sm tabular-nums text-[var(--text-primary)]">{user.workspace.counts.products}</strong></span>
                </span>
              </span>
            )}

            <span className="mt-3 flex items-center justify-between gap-3">
              <span className="text-[12px] text-[var(--text-muted)]">عضویت: {user.joinedAt}</span>
              <span className="inline-flex items-center gap-1 text-[13px] font-medium text-[var(--signal)]">
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
        description={selected?.phone ?? '—'}
        closeLabel="بستن جزئیات کاربر"
        size="large"
        motionPreset="detail"
        triggerRef={triggerRef}
        onClose={() => setSelectedId(null)}
        footer={selected ? (
          <Link
            href={`/admin/users/${selected.id}`}
            className="admin-primary-button min-h-12 w-full"
          >
            مشاهده پرونده کامل
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
        ) : undefined}
      >
        {selected && (
          <div className="space-y-4">
            <div className="ui-seg grid-cols-2" role="tablist" aria-label="بخش‌های جزئیات کاربر">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'overview'}
                onClick={() => setActiveTab('overview')}
                className="ui-seg-tab px-3 text-xs"
              >
                اطلاعات کلی
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'relations'}
                onClick={() => setActiveTab('relations')}
                className="ui-seg-tab px-3 text-xs"
              >
                زیرمجموعه‌ها
              </button>
            </div>

            {activeTab === 'overview' ? (
              <div role="tabpanel" className="space-y-3">
                <section className="rounded-2xl border border-[var(--border-default)] bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--bg-muted)] text-[var(--text-secondary)]"><Phone className="h-4 w-4" aria-hidden="true" /></span>
                      <div className="min-w-0"><p className="text-[12px] text-[var(--text-muted)]">شماره تلفن</p><p dir="ltr" className="mt-1 truncate text-start text-sm font-bold text-[var(--text-primary)]">{selected.phone}</p></div>
                    </div>
                    <CopyButton value={selected.phone} label="کپی شماره تلفن" copiedLabel="شماره کپی شد" />
                  </div>
                </section>

                <section className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-[var(--border-default)] p-4"><CalendarDays className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" /><p className="mt-3 text-[12px] text-[var(--text-muted)]">تاریخ عضویت</p><p className="mt-1 text-xs font-bold text-[var(--text-primary)]">{selected.joinedAt}</p></div>
                  <div className="rounded-2xl border border-[var(--border-default)] p-4"><Package className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" /><p className="mt-3 text-[12px] text-[var(--text-muted)]">محصولات</p><p className="mt-1 text-xs font-bold text-[var(--text-primary)]">{selected.workspace?.counts.products ?? '—'}</p></div>
                </section>

                {selected.workspace && (
                  <section className="rounded-2xl border border-[var(--border-default)] p-4">
                    <p className="text-xs font-bold text-[var(--text-primary)]">وضعیت حساب</p>
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
                    <RelationCard icon={Cable} label="اتصالات" value={selected.workspace.counts.connections} />
                    <RelationCard icon={MessageSquareText} label="گفتگوها" value={selected.workspace.counts.conversations} />
                    <RelationCard icon={CreditCard} label="پرداخت‌ها" value={selected.workspace.counts.payments} />
                    <RelationCard icon={Package} label="محصولات" value={selected.workspace.counts.products} />
                  </>
                ) : (
                  <p className="col-span-2 rounded-2xl border border-dashed border-[var(--border-hover)] px-4 py-10 text-center text-sm text-[var(--text-muted)]">زیرمجموعه‌ای برای این کاربر ثبت نشده است.</p>
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
  icon: typeof Cable
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
      <Icon className="h-5 w-5 text-[var(--text-muted)]" aria-hidden="true" />
      <p className="mt-4 text-[12px] text-[var(--text-muted)]">{label}</p>
      <strong className="mt-1 block text-xl tabular-nums text-[var(--text-primary)]">{value}</strong>
    </div>
  )
}
