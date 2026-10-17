'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { AlertTriangle, Code2, Globe, KeyRound, Plus, ShieldCheck, Trash2, Webhook } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { CopyButton } from '@/components/ui/copy-button'
import { SideSheet } from '@/components/ui/side-sheet'
import { StatusChip } from '@/components/ui/status-chip'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

export interface SiteRow {
	id: string
	name: string
	domain: string | null
	keyHint: string
	active: boolean
	lastUsedAt: string | null
	payments: number
}

const BASE = 'https://vigent.ir/api/pay/v1'

const CREATE_SAMPLE = `curl -X POST ${BASE}/create \\
  -H "Authorization: Bearer YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 12500000,
    "order_id": "ORD123",
    "callback_url": "https://your-site.ir/pay/callback",
    "return_url": "https://your-site.ir/thanks",
    "description": "سفارش ۱۲۳",
    "customer_phone": "09121234567"
  }'`

const CREATE_ANSWER = `{
  "success": true,
  "payment_link": "https://vigent.ir/pay/P6-Q3_9gXG7…",
  "authority": "P6-Q3_9gXG7…",
  "amount": 12500000,
  "pay_amount": 12504820,
  "expires_at": "2026-10-17T10:30:00.000Z",
  "card": { "bank": "بانک ملت", "holder": "…", "number": "610433******1234" }
}`

const VERIFY_SAMPLE = `curl -X POST ${BASE}/verify \\
  -H "Authorization: Bearer YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "authority": "P6-Q3_9gXG7…" }'`

const VERIFY_ANSWER = `{
  "success": true,
  "data": {
    "code": 100,
    "transaction": {
      "order_id": "ORD123",
      "authority": "P6-Q3_9gXG7…",
      "amount": 12500000,
      "pay_amount": 12504820,
      "confirmed_by": "auto",
      "paid_at": "2026-10-17T10:12:41.000Z"
    }
  }
}`

const CALLBACK_BODY = `POST https://your-site.ir/pay/callback
X-Vigent-Timestamp: 1760695961
X-Vigent-Signature: sha256=9f2c…

{
  "event": "payment.paid",
  "authority": "P6-Q3_9gXG7…",
  "order_id": "ORD123",
  "status": "paid",
  "amount": 12500000,
  "pay_amount": 12504820
}`

const CALLBACK_PHP = `$body = file_get_contents('php://input');
$ts  = $_SERVER['HTTP_X_VIGENT_TIMESTAMP'] ?? '';
$sig = $_SERVER['HTTP_X_VIGENT_SIGNATURE'] ?? '';
$ok  = hash_equals('sha256=' . hash_hmac('sha256', "$ts.$body", VIGENT_SECRET), $sig);
if (!$ok || abs(time() - (int) $ts) > 300) { http_response_code(401); exit; }
// Then ask /verify with the authority before marking the order paid.`

const CODES: Array<[string, string, string]> = [
	['100', 'پرداخت شده؛ اولین بار است که تأیید را می‌پرسید', 'Paid; the first time you ask'],
	['101', 'پرداخت شده؛ قبلاً تأییدش را گرفته‌اید', 'Paid; already verified before'],
	['-55', 'هنوز منتظر واریز مشتری است', 'Still waiting for the transfer'],
	['-1', 'پرداخت نشد (مهلت تمام شد، لغو یا رد شد)', 'Not paid (expired, withdrawn or rejected)'],
	['-54', 'تراکنشی با این authority پیدا نشد', 'No transaction with this authority'],
	['-53', 'این تراکنش مال کلید دیگری است', 'The transaction belongs to another key'],
]

type DocTab = 'create' | 'verify' | 'callback'

function Code({ value, label, copiedLabel }: { value: string; label: string; copiedLabel: string }) {
	return (
		<div className="relative">
			<pre dir="ltr" className="overflow-x-auto rounded-control bg-[#16161a] p-3.5 pe-16 text-left font-mono text-[12px] leading-6 text-[#e9e7e2]">{value}</pre>
			<CopyButton value={value} label={label} copiedLabel={copiedLabel} className="absolute end-2 top-2 !min-h-8 border-white/15 bg-white/10 !text-white hover:bg-white/20" />
		</div>
	)
}

/** API keys for the owner's own sites, bots and apps (one key per site), and how to call the API. */
export function SitesManager({ sites }: { sites: SiteRow[] }) {
	const fa = useLocale() !== 'en'
	const numbers = fa ? 'fa-IR' : 'en-US'
	const router = useRouter()
	const [name, setName] = useState('')
	const [domain, setDomain] = useState('')
	const [busy, setBusy] = useState<string | null>(null)
	const [created, setCreated] = useState<{ key: string; secret: string } | null>(null)
	const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
	const [error, setError] = useState(false)
	const [open, setOpen] = useState(false)
	const [doc, setDoc] = useState<DocTab>('create')
	const deleting = sites.find((site) => site.id === confirmDelete) ?? null
	const copy = fa ? 'کپی' : 'Copy'
	const copied = fa ? 'کپی شد' : 'Copied'

	async function create(event: React.FormEvent) {
		event.preventDefault()
		setBusy('create')
		setError(false)
		try {
			const response = await fetch('/api/payments/sites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim(), domain: domain.trim() || undefined }) })
			const data = (await response.json().catch(() => null)) as { key?: string; secret?: string } | null
			if (!response.ok || !data?.key || !data.secret) {
				setError(true)
				return
			}
			setCreated({ key: data.key, secret: data.secret })
			setName('')
			setDomain('')
			setOpen(false)
			router.refresh()
		} catch {
			setError(true)
		} finally {
			setBusy(null)
		}
	}
	async function update(id: string, method: 'PATCH' | 'DELETE', body?: Record<string, unknown>) {
		setBusy(id)
		try {
			await fetch(`/api/payments/sites/${id}`, { method, headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) })
			router.refresh()
		} finally {
			setBusy(null)
			setConfirmDelete(null)
		}
	}

	const docTabs: Array<{ key: DocTab; icon: typeof Code2; label: string }> = [
		{ key: 'create', icon: Plus, label: fa ? '۱. ساخت پرداخت' : '1. Create' },
		{ key: 'verify', icon: ShieldCheck, label: fa ? '۲. تأیید' : '2. Verify' },
		{ key: 'callback', icon: Webhook, label: fa ? 'کالبک' : 'Callback' },
	]

	return (
		<div className="space-y-4">
			<section className="spatial-surface rounded-card p-4 sm:p-5">
				<div className="flex flex-wrap items-start gap-3">
					<span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f1eeff] text-[#5b3de8] dark:bg-[#5b3de8]/20 dark:text-[#b9adff]"><Code2 className="size-5" /></span>
					<div className="min-w-0 flex-1 basis-64">
						<h2 className="text-[15.5px] font-bold text-[var(--text-primary)]">{fa ? 'پرداخت از سایت، ربات یا اپ خودتان' : 'Payments from your own site, bot or app'}</h2>
						<p className="mt-0.5 max-w-3xl text-[13px] leading-7 text-[var(--text-secondary)]">
							{fa
								? 'با یک کلید API، سایت شما از همین درگاه کارت‌به‌کارت پرداخت می‌گیرد؛ درخواست‌ها با زرین‌پی سازگارند، پس اغلب فقط نشانی و کلید عوض می‌شود. اگر فقط در گفتگو می‌فروشید یا لینک پرداخت دستی می‌سازید، به این بخش نیازی ندارید.'
								: 'With an API key your site takes card-to-card payments through this gateway; the requests are ZarinPay-compatible, so usually only the address and the key change. If you only sell in chats or make links by hand, you do not need this.'}
						</p>
					</div>
					<Button onClick={() => { setError(false); setOpen(true) }} className="w-full sm:w-auto"><Plus className="size-4" aria-hidden />{fa ? 'کلید تازه' : 'New key'}</Button>
				</div>
			</section>

			{created && (
				<section role="status" className="rounded-card border border-emerald-200 bg-emerald-50 p-4 sm:p-5 dark:border-emerald-900/60 dark:bg-emerald-950/40">
					<h2 className="text-[15px] font-bold text-emerald-900 dark:text-emerald-100">{fa ? 'کلید ساخته شد؛ همین حالا کپی کنید' : 'Key created; copy it now'}</h2>
					<p className="mt-1 flex items-start gap-1.5 text-[13px] leading-6 text-emerald-900 dark:text-emerald-100"><AlertTriangle className="mt-1 size-4 shrink-0" aria-hidden />{fa ? 'این دو مقدار فقط همین یک بار نشان داده می‌شوند. کلید را در سرور سایت نگه دارید، نه در کد صفحه.' : 'These two values are shown only this once. Keep the key on your server, never in page code.'}</p>
					<div className="mt-3 grid gap-2">
						{([['key', fa ? 'کلید API (هدر Authorization: Bearer)' : 'API key (Authorization: Bearer)'], ['secret', fa ? 'راز امضای کالبک' : 'Callback signing secret']] as const).map(([field, label]) => (
							<div key={field} className="flex items-center gap-2 rounded-control bg-white p-2 ps-3 dark:bg-neutral-900">
								<span className="min-w-0 flex-1"><span className="block text-[11.5px] text-[var(--text-muted)]">{label}</span><span dir="ltr" className="block truncate font-mono text-[12.5px]">{created[field]}</span></span>
								<CopyButton value={created[field]} label={copy} copiedLabel={fa ? 'کپی شد' : 'Copied'} showLabel />
							</div>
						))}
					</div>
					<Button size="sm" variant="ghost" className="mt-3" onClick={() => setCreated(null)}>{fa ? 'کپی کردم' : 'I have copied them'}</Button>
				</section>
			)}

			{sites.length > 0 ? (
				<ul className="grid gap-3 md:grid-cols-2">
					{sites.map((site) => (
						<li key={site.id} className={cn('spatial-surface grid gap-3 rounded-card p-4', !site.active && 'opacity-75')}>
							<div className="flex items-start gap-3">
								<span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--bg-muted)]"><Globe className="size-5" aria-hidden /></span>
								<div className="min-w-0 flex-1">
									<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
										<p className="truncate text-[14.5px] font-bold text-[var(--text-primary)]">{site.name}</p>
										<StatusChip tone={site.active ? 'ok' : 'neutral'} dot>{site.active ? (fa ? 'فعال' : 'Active') : (fa ? 'غیرفعال' : 'Off')}</StatusChip>
									</div>
									{site.domain ? <p dir="ltr" className="truncate text-start font-mono text-[12.5px] text-[var(--text-secondary)]">{site.domain}</p> : null}
								</div>
								<Switch checked={site.active} pending={busy === site.id} disabled={busy !== null} onChange={(active) => update(site.id, 'PATCH', { active })} aria-label={fa ? 'فعال بودن کلید' : 'Key active'} />
							</div>
							<dl className="grid grid-cols-3 gap-2 text-[12px]">
								<div className="rounded-xl bg-[var(--bg-surface)] px-2.5 py-2"><dt className="text-[var(--text-muted)]">{fa ? 'کلید' : 'Key'}</dt><dd dir="ltr" className="mt-0.5 truncate text-start font-mono font-semibold text-[var(--text-primary)]">{site.keyHint}</dd></div>
								<div className="rounded-xl bg-[var(--bg-surface)] px-2.5 py-2"><dt className="text-[var(--text-muted)]">{fa ? 'پرداخت‌ها' : 'Payments'}</dt><dd className="mt-0.5 font-semibold tabular-nums text-[var(--text-primary)]">{site.payments.toLocaleString(numbers)}</dd></div>
								<div className="rounded-xl bg-[var(--bg-surface)] px-2.5 py-2"><dt className="text-[var(--text-muted)]">{fa ? 'آخرین استفاده' : 'Last used'}</dt><dd className="mt-0.5 truncate font-semibold text-[var(--text-primary)]">{site.lastUsedAt ? new Intl.DateTimeFormat(fa ? 'fa-IR' : 'en-US', { dateStyle: 'short' }).format(new Date(site.lastUsedAt)) : (fa ? 'هنوز نه' : 'Not yet')}</dd></div>
							</dl>
							<button
								type="button"
								onClick={() => setConfirmDelete(site.id)}
								className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[var(--border-default)] px-4 text-[13px] font-medium text-[var(--text-muted)] transition-colors hover:border-danger hover:bg-red-50 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/50"
							>
								<Trash2 className="size-4" aria-hidden />{fa ? 'حذف کلید' : 'Delete key'}
							</button>
						</li>
					))}
				</ul>
			) : (
				<section className="grid gap-3 rounded-card border border-dashed border-[var(--border-default)] p-5 text-center">
					<KeyRound className="mx-auto size-7 text-[var(--text-hint)]" aria-hidden />
					<p className="text-[14px] font-bold text-[var(--text-primary)]">{fa ? 'هنوز کلیدی نساخته‌اید' : 'No keys yet'}</p>
					<ol className="mx-auto grid max-w-md gap-1.5 text-start text-[13px] leading-6 text-[var(--text-secondary)]">
						{(fa
							? ['برای هر سایت یا ربات یک کلید بسازید.', 'با «ساخت پرداخت» لینک پرداخت بگیرید و مشتری را به آن بفرستید.', 'بعد از کالبک، با «تأیید» مطمئن شوید و سفارش را پرداخت‌شده کنید.']
							: ['Create a key for each site or bot.', 'Call “create” for a payment link and send the customer there.', 'After the callback, call “verify” before marking the order paid.']
						).map((row, index) => (
							<li key={row} className="flex items-start gap-2"><span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-[var(--bg-muted)] text-[11px] font-bold">{(index + 1).toLocaleString(numbers)}</span>{row}</li>
						))}
					</ol>
				</section>
			)}

			<section className="spatial-surface overflow-hidden rounded-card">
				<div className="p-4 sm:p-5">
					<h2 className="text-[15.5px] font-bold text-[var(--text-primary)]">{fa ? 'راهنمای API' : 'API reference'}</h2>
					<p className="mt-1 max-w-3xl text-[13px] leading-7 text-[var(--text-secondary)]">
						{fa
							? <>نشانی پایه <span dir="ltr" className="font-mono text-[12.5px]">{BASE}</span> · مبلغ‌ها به <b>ریال</b> و باید به صفر ختم شوند · هر درخواست با هدر <span dir="ltr" className="font-mono text-[12.5px]">Authorization: Bearer کلید</span>.</>
							: <>Base address <span dir="ltr" className="font-mono text-[12.5px]">{BASE}</span> · amounts in <b>rials</b>, ending in 0 · every request carries <span dir="ltr" className="font-mono text-[12.5px]">Authorization: Bearer KEY</span>.</>}
					</p>
				</div>
				<div role="tablist" aria-label={fa ? 'بخش‌های راهنما' : 'Reference sections'} className="ui-seg ui-seg-solid mx-4 grid-cols-3 sm:mx-5 sm:max-w-md">
					{docTabs.map((item) => (
						<button key={item.key} type="button" role="tab" aria-selected={doc === item.key} onClick={() => setDoc(item.key)} className="ui-seg-tab inline-flex items-center justify-center gap-1.5 px-2 text-[12.5px]">
							<item.icon className="size-3.5" aria-hidden />{item.label}
						</button>
					))}
				</div>
				<div role="tabpanel" className="grid gap-3 p-4 sm:p-5">
					{doc === 'create' && (
						<>
							<p className="text-[13px] leading-7 text-[var(--text-secondary)]">{fa ? 'پاسخ، payment_link می‌دهد؛ مشتری را به آن بفرستید. pay_amount همان مبلغ به‌اضافهٔ چند رقم شناسه است که مشتری دقیقاً واریز می‌کند. order_id تکراری، همان پرداخت باز را برمی‌گرداند.' : 'The answer carries payment_link; send the customer there. pay_amount is the amount plus a few identifying digits the customer transfers exactly. A repeated order_id returns the same open payment.'}</p>
							<Code value={CREATE_SAMPLE} label={copy} copiedLabel={copied} />
							<p className="text-[12.5px] font-semibold text-[var(--text-muted)]">{fa ? 'پاسخ' : 'Answer'}</p>
							<Code value={CREATE_ANSWER} label={copy} copiedLabel={copied} />
						</>
					)}
					{doc === 'verify' && (
						<>
							<p className="text-[13px] leading-7 text-[var(--text-secondary)]">{fa ? 'قبل از پرداخت‌شده کردن سفارش، همیشه وضعیت را با authority بپرسید.' : 'Always ask with the authority before marking an order paid.'}</p>
							<Code value={VERIFY_SAMPLE} label={copy} copiedLabel={copied} />
							<p className="text-[12.5px] font-semibold text-[var(--text-muted)]">{fa ? 'پاسخ' : 'Answer'}</p>
							<Code value={VERIFY_ANSWER} label={copy} copiedLabel={copied} />
							<div className="overflow-hidden rounded-control border border-[var(--border-subtle)]">
								<table className="w-full text-[12.5px]">
									<tbody className="divide-y divide-[var(--border-subtle)]">
										{CODES.map(([code, faText, enText]) => (
											<tr key={code}>
												<td dir="ltr" className={cn('w-16 px-3 py-2 text-center font-mono font-bold', code.startsWith('-') ? 'text-[var(--text-secondary)]' : 'text-emerald-700')}>{code}</td>
												<td className="px-3 py-2 text-[var(--text-secondary)]">{fa ? faText : enText}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</>
					)}
					{doc === 'callback' && (
						<>
							<p className="text-[13px] leading-7 text-[var(--text-secondary)]">{fa ? 'با هر تغییر وضعیت، ویجنت به callback_url خبر می‌دهد و اگر پاسخ ۲xx نگیرد تا ۵ بار (از ۱ دقیقه تا ۱۲ ساعت بعد) تکرار می‌کند. امضا: sha256=HMAC(راز، «timestamp.body»).' : 'On every state change Vigent calls callback_url and retries up to 5 times (1 minute to 12 hours apart) until it gets a 2xx. Signature: sha256=HMAC(secret, “timestamp.body”).'}</p>
							<Code value={CALLBACK_BODY} label={copy} copiedLabel={copied} />
							<p className="text-[12.5px] font-semibold text-[var(--text-muted)]">{fa ? 'بررسی امضا (PHP)' : 'Checking the signature (PHP)'}</p>
							<Code value={CALLBACK_PHP} label={copy} copiedLabel={copied} />
						</>
					)}
				</div>
			</section>

			<ConfirmDialog
				open={deleting != null}
				title={fa ? 'این کلید حذف شود؟' : 'Delete this key?'}
				description={deleting ? (fa ? `«${deleting.name}» دیگر نمی‌تواند پرداخت بسازد یا تأیید بگیرد. پرداخت‌های قبلی‌اش در فهرست می‌مانند.` : `“${deleting.name}” can no longer create or verify payments. Its past payments stay in the list.`) : undefined}
				confirmLabel={busy ? (fa ? 'در حال حذف…' : 'Deleting…') : (fa ? 'حذف کلید' : 'Delete key')}
				cancelLabel={fa ? 'انصراف' : 'Keep it'}
				tone="danger"
				busy={busy != null}
				onConfirm={() => { if (deleting) void update(deleting.id, 'DELETE') }}
				onClose={() => { if (!busy) setConfirmDelete(null) }}
			/>

			{open && (
				<SideSheet
					title={fa ? 'کلید تازه' : 'New key'}
					subtitle={fa ? 'یک کلید برای هر سایت، ربات یا اپ' : 'One key per site, bot or app'}
					onClose={() => setOpen(false)}
					closeLabel={fa ? 'بستن' : 'Close'}
					className="md:w-[min(30rem,calc(100vw-1.5rem))]"
					icon={<span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f1eeff] text-[#5b3de8] dark:bg-[#5b3de8]/20 dark:text-[#b9adff]"><KeyRound className="size-5" /></span>}
					footer={(
						<div className="flex flex-wrap items-center gap-2">
							<Button type="submit" form="pay-site-new" loading={busy === 'create'} disabled={!name.trim()}><KeyRound className="size-4" aria-hidden />{fa ? 'ساخت کلید' : 'Create key'}</Button>
							<Button variant="ghost" onClick={() => setOpen(false)}>{fa ? 'انصراف' : 'Cancel'}</Button>
						</div>
					)}
				>
					<form id="pay-site-new" onSubmit={create} className="grid gap-4">
						<label className="block"><span className="ui-field-label">{fa ? 'نام سایت یا ربات' : 'Site or bot name'}</span><input id="pay-site-name" data-sheet-initial-focus className="input mt-1.5" value={name} onChange={(event) => setName(event.target.value)} maxLength={60} required placeholder={fa ? 'مثلاً فروشگاه اصلی' : 'e.g. Main shop'} /></label>
						<label className="block">
							<span className="ui-field-label">{fa ? 'دامنه (اختیاری)' : 'Domain (optional)'}</span>
							<input id="pay-site-domain" dir="ltr" className="input mt-1.5 font-mono" value={domain} onChange={(event) => setDomain(event.target.value)} maxLength={120} placeholder="shop.example.ir" />
							<span className="ui-field-hint">{fa ? 'فقط برای این‌که در فهرست بشناسیدش.' : 'Only so you recognise it in the list.'}</span>
						</label>
						<p className="flex items-start gap-2 rounded-2xl bg-[var(--bg-surface)] p-3.5 text-[12.5px] leading-6 text-[var(--text-secondary)]"><ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />{fa ? 'کلید و راز امضا بعد از ساخت فقط یک بار نشان داده می‌شوند.' : 'The key and the signing secret are shown only once, right after creation.'}</p>
						{error && <p role="alert" className="text-sm text-red-600">{fa ? 'کلید ساخته نشد؛ دوباره تلاش کنید.' : 'The key was not created; try again.'}</p>}
					</form>
				</SideSheet>
			)}
		</div>
	)
}
