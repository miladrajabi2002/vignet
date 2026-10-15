'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, ListChecks, MessageSquareText, Settings2, Store } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { groupDigits, normalizeNumberInput } from '@/components/admin/number-field'
import { cn } from '@/lib/utils'

// ─── Tabs ───────────────────────────────────────────────────────────────

const TABS = [
	{ href: '/admin/payment-gateway', label: 'نمای کلی', icon: LayoutDashboard },
	{ href: '/admin/payment-gateway/businesses', label: 'کسب‌وکارها', icon: Store },
	{ href: '/admin/payment-gateway/payments', label: 'تراکنش‌ها', icon: ListChecks },
	{ href: '/admin/payment-gateway/sms', label: 'پیامک‌ها', icon: MessageSquareText },
	{ href: '/admin/payment-gateway/settings', label: 'تنظیمات', icon: Settings2 },
] as const

/** The five sections of admin «درگاه پرداخت» (a scrolling row on phones). */
export function GatewayAdminTabs({ badges }: { badges?: Partial<Record<string, number>> }) {
	const pathname = usePathname()
	const active = (href: string) => {
		if (href === '/admin/payment-gateway') return pathname === href
		return pathname.startsWith(href)
	}
	// A business detail page lives under «کسب‌وکارها».
	const onDetail = !TABS.some((tab) => tab.href !== '/admin/payment-gateway' && pathname.startsWith(tab.href)) && pathname !== '/admin/payment-gateway'
	return (
		<nav aria-label="بخش‌های درگاه پرداخت" className="ui-ftabs border-b border-[var(--border-subtle)]">
			{TABS.map((tab) => {
				const Icon = tab.icon
				const current = active(tab.href) || (onDetail && tab.href === '/admin/payment-gateway/businesses')
				const badge = badges?.[tab.href]
				return (
					<Link key={tab.href} href={tab.href} aria-current={current ? 'page' : undefined} className="ui-ftab">
						<Icon className="size-4" aria-hidden />
						{tab.label}
						{badge ? <span className="rounded-full bg-red-600 px-1.5 text-[11px] font-bold leading-5 text-white">{badge.toLocaleString('fa-IR')}</span> : null}
					</Link>
				)
			})}
		</nav>
	)
}

// ─── Shared request helper ──────────────────────────────────────────────

async function send(url: string, method: 'PATCH' | 'POST', body: unknown): Promise<{ ok: boolean; error?: string }> {
	try {
		const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
		const data = (await response.json().catch(() => ({}))) as { error?: string; ok?: boolean }
		return response.ok ? { ok: data.ok !== false, error: data.ok === false ? 'FAILED' : undefined } : { ok: false, error: data.error ?? `HTTP ${response.status}` }
	} catch {
		return { ok: false, error: 'NETWORK' }
	}
}

const ERRORS: Record<string, string> = {
	ALREADY_FINAL: 'وضعیت این مورد قبلاً عوض شده است.',
	NO_CALLBACK: 'این پرداخت آدرس بازگشت ندارد.',
	NETWORK: 'ارتباط برقرار نشد.',
	UNAUTHORIZED: 'نشست ادمین منقضی شده است.',
	FAILED: 'ارسال ناموفق بود؛ پاسخ سایت خطا داشت.',
}

function Notice({ notice }: { notice: { ok: boolean; text: string } | null }) {
	if (!notice) return null
	return <p role="status" className={cn('text-[12.5px]', notice.ok ? 'text-emerald-700' : 'text-red-700')}>{notice.text}</p>
}

// ─── One business: suspend, cap, owner switch ───────────────────────────

export function GatewayBusinessControls({
	workspaceId,
	enabled,
	suspended,
	suspendReason,
	capOverride,
	planCap,
}: {
	workspaceId: string
	enabled: boolean
	suspended: boolean
	suspendReason: string | null
	capOverride: number | null
	/** The plan's own cap (null = unlimited). */
	planCap: number | null
}) {
	const router = useRouter()
	const [reason, setReason] = useState(suspendReason ?? '')
	const [capMode, setCapMode] = useState<'plan' | 'custom' | 'unlimited'>(capOverride == null ? 'plan' : capOverride < 0 ? 'unlimited' : 'custom')
	const [capValue, setCapValue] = useState(capOverride != null && capOverride >= 0 ? String(capOverride) : '')
	const [busy, setBusy] = useState<string | null>(null)
	const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)
	const [confirmSuspend, setConfirmSuspend] = useState(false)

	async function patch(key: string, body: unknown, done: string) {
		setBusy(key)
		setNotice(null)
		const result = await send(`/api/admin/payment-gateway/workspaces/${workspaceId}`, 'PATCH', body)
		setBusy(null)
		setNotice(result.ok ? { ok: true, text: done } : { ok: false, text: ERRORS[result.error ?? ''] ?? 'ذخیره نشد.' })
		if (result.ok) {
			setConfirmSuspend(false)
			router.refresh()
		}
	}

	return (
		<div className="grid gap-4 lg:grid-cols-3">
			<div className="space-y-2.5 rounded-2xl border border-[var(--border-subtle)] p-3.5">
				<p className="text-[13px] font-bold text-[var(--text-primary)]">کلید درگاه (صاحب کسب‌وکار)</p>
				<div className="flex items-center justify-between gap-3">
					<span className="text-[12.5px] leading-6 text-[var(--text-secondary)]">{enabled ? 'روشن — ایجنت کارت را می‌فرستد' : 'خاموش'}</span>
					<Switch checked={enabled} disabled={busy !== null} onChange={(next: boolean) => patch('enabled', { enabled: next }, next ? 'درگاه روشن شد.' : 'درگاه خاموش شد.')} aria-label="کلید درگاه این کسب‌وکار" />
				</div>
				<p className="text-[11.5px] leading-5 text-[var(--text-muted)]">برای پشتیبانی؛ صاحب کسب‌وکار خودش هم می‌تواند عوضش کند.</p>
			</div>

			<div className="space-y-2.5 rounded-2xl border border-[var(--border-subtle)] p-3.5">
				<p className="text-[13px] font-bold text-[var(--text-primary)]">سقف ماهانهٔ پرداخت</p>
				<div className="ui-seg inline-grid grid-flow-col text-[12px]">
					{([['plan', 'مطابق پلن'], ['custom', 'عدد دلخواه'], ['unlimited', 'نامحدود']] as const).map(([key, label]) => (
						<button key={key} type="button" aria-pressed={capMode === key} onClick={() => setCapMode(key)} className="ui-seg-tab min-h-9 px-3" aria-current={capMode === key ? 'true' : undefined}>{label}</button>
					))}
				</div>
				{capMode === 'custom' ? (
					<input inputMode="numeric" value={groupDigits(capValue)} onChange={(event) => setCapValue(normalizeNumberInput(event.target.value))} placeholder="مثلاً ۲٬۰۰۰" className="input min-h-10 w-full tabular-nums" aria-label="سقف دلخواه" />
				) : (
					<p className="text-[12.5px] text-[var(--text-secondary)]">{capMode === 'plan' ? `سقف پلن: ${planCap == null ? 'نامحدود' : planCap.toLocaleString('fa-IR')}` : 'بدون سقف برای این کسب‌وکار'}</p>
				)}
				<Button
					size="sm"
					variant="secondary"
					loading={busy === 'cap'}
					disabled={busy !== null || (capMode === 'custom' && !capValue)}
					onClick={() => patch('cap', { capOverride: capMode === 'plan' ? null : capMode === 'unlimited' ? -1 : Number(capValue) }, 'سقف ذخیره شد.')}
				>
					ذخیرهٔ سقف
				</Button>
			</div>

			<div className={cn('space-y-2.5 rounded-2xl border p-3.5', suspended ? 'border-red-200 bg-red-50/60 dark:border-red-900/60 dark:bg-red-950/30' : 'border-[var(--border-subtle)]')}>
				<p className="text-[13px] font-bold text-[var(--text-primary)]">{suspended ? 'درگاه این کسب‌وکار متوقف است' : 'توقف درگاه (ادمین)'}</p>
				{suspended ? (
					<>
						<p className="text-[12.5px] leading-6 text-red-800 dark:text-red-200">{suspendReason ? `دلیل: ${suspendReason}` : 'بدون دلیل ثبت‌شده'}</p>
						<Button size="sm" loading={busy === 'suspend'} disabled={busy !== null} onClick={() => patch('suspend', { suspend: false }, 'درگاه دوباره فعال شد و به صاحب کسب‌وکار خبر داده شد.')}>رفع توقف</Button>
					</>
				) : (
					<>
						<input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={300} placeholder="دلیل (به صاحب کسب‌وکار نشان داده می‌شود)" className="input min-h-10 w-full" aria-label="دلیل توقف" />
						{confirmSuspend ? (
							<div className="flex flex-wrap items-center gap-2">
								<Button size="sm" variant="danger" loading={busy === 'suspend'} disabled={busy !== null} onClick={() => patch('suspend', { suspend: { reason: reason.trim() || undefined } }, 'درگاه متوقف شد و به صاحب کسب‌وکار خبر داده شد.')}>بله، متوقف کن</Button>
								<Button size="sm" variant="ghost" onClick={() => setConfirmSuspend(false)}>انصراف</Button>
							</div>
						) : (
							<Button size="sm" variant="outline" disabled={busy !== null} onClick={() => setConfirmSuspend(true)}>متوقف کردن درگاه</Button>
						)}
						<p className="text-[11.5px] leading-5 text-[var(--text-muted)]">کارت جدیدی فرستاده نمی‌شود؛ پرداخت‌های باز همچنان با پیامک تأیید می‌شوند.</p>
					</>
				)}
			</div>
			<div className="lg:col-span-3"><Notice notice={notice} /></div>
		</div>
	)
}

// ─── One payment ────────────────────────────────────────────────────────

type PaymentAction = 'confirm' | 'reject' | 'cancel' | 'callback'

const ACTION_LABEL: Record<PaymentAction, { label: string; ask: string; done: string; variant: 'primary' | 'danger' | 'outline' | 'secondary' }> = {
	confirm: { label: 'تأیید', ask: 'تأیید پرداخت؟ به مشتری و صاحب کسب‌وکار خبر داده می‌شود.', done: 'تأیید شد.', variant: 'primary' },
	reject: { label: 'رد', ask: 'رد پرداخت؟ به مشتری گفته می‌شود رسید بفرستد.', done: 'رد شد.', variant: 'danger' },
	cancel: { label: 'لغو', ask: 'لغو این پرداخت باز؟', done: 'لغو شد.', variant: 'outline' },
	callback: { label: 'ارسال دوبارهٔ کالبک', ask: 'وضعیت دوباره به سایت فرستاده شود؟', done: 'به سایت فرستاده شد.', variant: 'secondary' },
}

export function GatewayPaymentActions({ paymentId, actions }: { paymentId: string; actions: PaymentAction[] }) {
	const router = useRouter()
	const [asking, setAsking] = useState<PaymentAction | null>(null)
	const [busy, setBusy] = useState(false)
	const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)
	if (!actions.length) return null

	async function run(action: PaymentAction) {
		setBusy(true)
		const result = await send(`/api/admin/payment-gateway/payments/${paymentId}`, 'POST', { action })
		setBusy(false)
		setAsking(null)
		setNotice(result.ok ? { ok: true, text: ACTION_LABEL[action].done } : { ok: false, text: ERRORS[result.error ?? ''] ?? 'انجام نشد.' })
		if (result.ok) router.refresh()
	}

	if (asking) {
		return (
			<div className="flex max-w-[16rem] flex-col gap-1.5">
				<span className="text-[12px] leading-5 text-[var(--text-secondary)]">{ACTION_LABEL[asking].ask}</span>
				<div className="flex gap-1.5">
					<Button size="sm" variant={ACTION_LABEL[asking].variant === 'danger' ? 'danger' : 'primary'} loading={busy} onClick={() => run(asking)}>بله</Button>
					<Button size="sm" variant="ghost" disabled={busy} onClick={() => setAsking(null)}>نه</Button>
				</div>
			</div>
		)
	}
	return (
		<div className="flex flex-wrap items-center gap-1.5">
			{actions.map((action) => (
				<Button key={action} size="sm" variant={ACTION_LABEL[action].variant} onClick={() => setAsking(action)}>{ACTION_LABEL[action].label}</Button>
			))}
			<Notice notice={notice} />
		</div>
	)
}

// ─── Card / phone in or out of rotation ─────────────────────────────────

export function GatewayActiveToggle({ kind, id, active, label }: { kind: 'cards' | 'devices'; id: string; active: boolean; label: string }) {
	const router = useRouter()
	const [busy, setBusy] = useState(false)
	return (
		<Switch
			checked={active}
			disabled={busy}
			pending={busy}
			aria-label={label}
			onChange={async (next: boolean) => {
				setBusy(true)
				const result = await send(`/api/admin/payment-gateway/${kind}/${id}`, 'PATCH', { active: next })
				setBusy(false)
				if (result.ok) router.refresh()
			}}
		/>
	)
}

// ─── An unmatched deposit ───────────────────────────────────────────────

export function GatewaySmsResolve({ smsId, suggestions }: { smsId: string; suggestions: Array<{ id: string; label: string }> }) {
	const router = useRouter()
	const [choice, setChoice] = useState(suggestions[0]?.id ?? '')
	const [busy, setBusy] = useState<'attach' | 'dismiss' | null>(null)
	const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)

	async function resolve(paymentId: string | null) {
		setBusy(paymentId ? 'attach' : 'dismiss')
		const result = await send(`/api/admin/payment-gateway/sms/${smsId}`, 'POST', { paymentId })
		setBusy(null)
		setNotice(result.ok ? { ok: true, text: paymentId ? 'وصل و تأیید شد.' : 'کنار گذاشته شد.' } : { ok: false, text: ERRORS[result.error ?? ''] ?? 'انجام نشد.' })
		if (result.ok) router.refresh()
	}

	return (
		<div className="flex flex-wrap items-center gap-2">
			{suggestions.length ? (
				<>
					<select value={choice} onChange={(event) => setChoice(event.target.value)} className="input min-h-9 max-w-full text-[12.5px]" aria-label="پرداخت باز برای وصل کردن">
						{suggestions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
					</select>
					<Button size="sm" loading={busy === 'attach'} disabled={busy !== null || !choice} onClick={() => resolve(choice)}>وصل و تأیید</Button>
				</>
			) : (
				<span className="text-[12px] text-[var(--text-muted)]">پرداخت بازی نیست</span>
			)}
			<Button size="sm" variant="ghost" loading={busy === 'dismiss'} disabled={busy !== null} onClick={() => resolve(null)}>کنار گذاشتن</Button>
			<Notice notice={notice} />
		</div>
	)
}

/** A row of small figures, two per line on phones. */
export function GatewayFigureRow({ children }: { children: ReactNode }) {
	return <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">{children}</div>
}
