'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { Globe, KeyRound, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/ui/copy-button'
import { Switch } from '@/components/ui/switch'

export interface SiteRow {
	id: string
	name: string
	domain: string | null
	keyHint: string
	active: boolean
	lastUsedAt: string | null
	payments: number
}

const CREATE_SAMPLE = `curl -X POST https://vigent.ir/api/pay/v1/create \\
  -H "Authorization: Bearer YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 12500000,
    "order_id": "ORD123",
    "callback_url": "https://your-site.ir/pay/callback",
    "return_url": "https://your-site.ir/thanks"
  }'`

const VERIFY_SAMPLE = `curl -X POST https://vigent.ir/api/pay/v1/verify \\
  -H "Authorization: Bearer YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "authority": "P…" }'
# 100 = paid · 101 = paid, already verified · -55 = still waiting · -1 = failed`

/** API keys for the owner's own sites, bots and apps (one key per site). */
export function SitesManager({ sites }: { sites: SiteRow[] }) {
	const fa = useLocale() !== 'en'
	const router = useRouter()
	const [name, setName] = useState('')
	const [domain, setDomain] = useState('')
	const [busy, setBusy] = useState<string | null>(null)
	const [created, setCreated] = useState<{ key: string; secret: string } | null>(null)
	const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
	const [error, setError] = useState(false)

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
			router.refresh()
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

	return (
		<div className="space-y-4">
			<section className="rounded-card border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 text-sm leading-7 text-[var(--text-secondary)] sm:p-5">
				<h2 className="text-[15px] font-bold text-[var(--text-primary)]">{fa ? 'این تب برای چه کسی است؟' : 'Who is this tab for?'}</h2>
				<p className="mt-1 max-w-3xl">{fa ? 'اگر فقط در گفتگو می‌فروشید یا لینک پرداخت دستی می‌سازید، به این تب نیازی ندارید. این‌جا برای سایت، ربات یا اپ خودتان است که می‌خواهد با کدنویسی از همین درگاه پرداخت بگیرد. هر سایت کلید جدا می‌گیرد.' : 'If you only sell in conversations or create payment links by hand, you do not need this tab. It is for your own site, bot or app that takes payments through this gateway in code. Each site gets its own key.'}</p>
			</section>

			{created && (
				<section role="status" className="rounded-card border border-emerald-200 bg-emerald-50 p-4 sm:p-5">
					<h2 className="text-[15px] font-bold text-emerald-900">{fa ? 'کلید ساخته شد — همین حالا کپی کنید' : 'Key created — copy it now'}</h2>
					<p className="mt-1 text-[13.5px] leading-7 text-emerald-900">{fa ? 'این دو مقدار فقط همین یک بار نشان داده می‌شوند.' : 'These two values are shown only this once.'}</p>
					{([['key', fa ? 'کلید API' : 'API key'], ['secret', fa ? 'راز امضای کالبک' : 'Callback signing secret']] as const).map(([field, label]) => (
						<div key={field} className="mt-2.5 flex items-center gap-2 rounded-control bg-white p-2 ps-3">
							<span className="min-w-0 flex-1"><span className="block text-[11.5px] text-[var(--text-muted)]">{label}</span><span dir="ltr" className="block truncate font-mono text-[12.5px]">{created[field]}</span></span>
							<CopyButton value={created[field]} label={fa ? 'کپی' : 'Copy'} copiedLabel={fa ? 'کپی شد' : 'Copied'} showLabel />
						</div>
					))}
					<Button size="sm" variant="ghost" className="mt-3" onClick={() => setCreated(null)}>{fa ? 'کپی کردم' : 'I have copied them'}</Button>
				</section>
			)}

			{sites.length > 0 && (
				<ul className="grid gap-3">
					{sites.map((site) => (
						<li key={site.id} className="spatial-surface flex flex-wrap items-center gap-3 rounded-card p-4">
							<span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--bg-muted)]"><Globe className="size-5" aria-hidden /></span>
							<div className="min-w-0 flex-1">
								<p className="text-sm font-bold text-[var(--text-primary)]">{site.name}{site.domain ? <span dir="ltr" className="ms-2 font-mono text-[12.5px] font-normal text-[var(--text-secondary)]">{site.domain}</span> : null}</p>
								<p className="mt-0.5 text-xs text-[var(--text-muted)]"><span dir="ltr" className="font-mono">{site.keyHint}</span> · {site.payments.toLocaleString(fa ? 'fa-IR' : 'en-US')} {fa ? 'پرداخت' : 'payments'}{site.lastUsedAt ? ` · ${fa ? 'آخرین استفاده' : 'last used'} ${new Intl.DateTimeFormat(fa ? 'fa-IR' : 'en-US', { dateStyle: 'short' }).format(new Date(site.lastUsedAt))}` : ''}</p>
							</div>
							<Switch checked={site.active} pending={busy === site.id} disabled={busy !== null} onChange={(active) => update(site.id, 'PATCH', { active })} aria-label={fa ? 'فعال بودن کلید' : 'Key active'} />
							{confirmDelete === site.id ? (
								<span className="flex items-center gap-2">
									<Button size="sm" variant="danger" loading={busy === site.id} onClick={() => update(site.id, 'DELETE')}>{fa ? 'حذف' : 'Delete'}</Button>
									<Button size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>{fa ? 'انصراف' : 'Keep'}</Button>
								</span>
							) : (
								<button type="button" onClick={() => setConfirmDelete(site.id)} aria-label={fa ? 'حذف کلید' : 'Delete key'} className="grid size-9 place-items-center rounded-full text-[var(--text-muted)] hover:bg-red-50 hover:text-red-600"><Trash2 className="size-4" aria-hidden /></button>
							)}
						</li>
					))}
				</ul>
			)}

			<form onSubmit={create} className="spatial-surface rounded-card p-4 sm:p-5">
				<h2 className="flex items-center gap-2 text-[15px] font-bold text-[var(--text-primary)]"><KeyRound className="size-4" aria-hidden />{fa ? 'کلید تازه' : 'New key'}</h2>
				<div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
					<label className="block"><span className="ui-field-label">{fa ? 'نام سایت یا ربات' : 'Site or bot name'}</span><input id="pay-site-name" className="input mt-1.5" value={name} onChange={(event) => setName(event.target.value)} maxLength={60} required /></label>
					<label className="block"><span className="ui-field-label">{fa ? 'دامنه (اختیاری)' : 'Domain (optional)'}</span><input id="pay-site-domain" dir="ltr" className="input mt-1.5 font-mono" value={domain} onChange={(event) => setDomain(event.target.value)} maxLength={120} placeholder="shop.example.ir" /></label>
					<Button type="submit" loading={busy === 'create'} disabled={!name.trim()} className="w-full sm:w-auto">{fa ? 'ساخت کلید' : 'Create key'}</Button>
				</div>
				{error && <p role="alert" className="mt-3 text-sm text-red-600">{fa ? 'کلید ساخته نشد؛ دوباره تلاش کنید.' : 'The key was not created; try again.'}</p>}
			</form>

			<section className="spatial-surface rounded-card p-4 sm:p-5">
				<h2 className="text-[15px] font-bold text-[var(--text-primary)]">{fa ? 'دو درخواست، سازگار با زرین‌پی' : 'Two requests, ZarinPay-compatible'}</h2>
				<p className="mt-1 max-w-3xl text-sm leading-7 text-[var(--text-secondary)]">{fa ? 'مبلغ به ریال است. پاسخ «ساخت» یک payment_link می‌دهد که مشتری را به صفحهٔ پرداخت می‌برد. بعد از واریز، ویجنت به callback_url شما خبر می‌دهد و مشتری به return_url برمی‌گردد؛ سایت شما با «تأیید» وضعیت را دوباره می‌پرسد.' : 'Amounts are in rials. “Create” answers with a payment_link that takes the customer to the payment page. After the transfer Vigent calls your callback_url and the customer returns to return_url; your site asks again with “verify”.'}</p>
				<pre dir="ltr" className="mt-3 overflow-x-auto rounded-control bg-[#16161a] p-3.5 text-left font-mono text-[12px] leading-6 text-[#e9e7e2]">{CREATE_SAMPLE}</pre>
				<pre dir="ltr" className="mt-2.5 overflow-x-auto rounded-control bg-[#16161a] p-3.5 text-left font-mono text-[12px] leading-6 text-[#e9e7e2]">{VERIFY_SAMPLE}</pre>
				<p className="mt-3 text-[13px] leading-7 text-[var(--text-muted)]">{fa ? 'کالبک با هدر X-Vigent-Signature امضا می‌شود: sha256=HMAC(راز، «timestamp.body»). تا ۵ بار با فاصلهٔ ۱ دقیقه تا ۱۲ ساعت تکرار می‌شود.' : 'The callback is signed with X-Vigent-Signature: sha256=HMAC(secret, “timestamp.body”). It is retried up to 5 times, from 1 minute to 12 hours apart.'}</p>
			</section>
		</div>
	)
}
