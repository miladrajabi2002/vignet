'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { Apple, CheckCircle2, ChevronDown, Globe, MessageSquareText, Radio, RefreshCw, ShieldCheck, Smartphone, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/ui/copy-button'
import { StatusChip } from '@/components/ui/status-chip'
import { CardPayCardView } from '@/components/commerce/card-pay-view'
import { SetupPlayer } from '@/components/payments/setup-player'
import { cn } from '@/lib/utils'
import { displayPhone, normalizeIranianMobile } from '@/lib/phone'
import { DEPOSIT_KEYWORDS, depositKeywordOf, parseBankSms } from '@/lib/payments/card/sms-parse'
import type { CardPayView } from '@/lib/payments/card/pay-card'
import type { GatewayDeviceRow } from '@/lib/payments/card/dashboard'

type Platform = 'ANDROID' | 'IOS'
type Method = 'SMS' | 'URL'

const ERRORS: Record<string, [string, string]> = {
	INVALID_PHONE: ['شمارهٔ موبایل درست نیست؛ مثل 09121234567 وارد کنید.', 'That mobile number is not valid; enter it like 09121234567.'],
	PHONE_IN_USE: ['این شماره قبلاً برای یک گوشی دیگر ثبت شده است.', 'This number is already registered for another phone.'],
	TOO_MANY_DEVICES: ['حداکثر ۵ گوشی می‌توانید ثبت کنید.', 'You can register up to 5 phones.'],
	NO_CARD: ['اول از تب «کارت‌ها» یک کارت فعال اضافه کنید.', 'Add an active card in the Cards tab first.'],
}

function Choice<T extends string>({ value, onChange, options, label }: { value: T | null; onChange: (next: T) => void; options: Array<{ value: T; icon: typeof Smartphone; title: string; body: string; recommended?: boolean; disabled?: boolean }>; label: string }) {
	const fa = useLocale() !== 'en'
	return (
		<div role="radiogroup" aria-label={label} className="grid gap-2.5 sm:grid-cols-2">
			{options.map((option) => {
				const Icon = option.icon
				const selected = value === option.value
				return (
					<button
						key={option.value}
						type="button"
						role="radio"
						aria-checked={selected}
						disabled={option.disabled}
						onClick={() => onChange(option.value)}
						className={cn(
							'relative grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-0.5 rounded-2xl border-[1.5px] bg-white p-3.5 text-start transition-[border-color,box-shadow,transform] duration-150 disabled:cursor-not-allowed disabled:opacity-50 sm:grid-cols-1 sm:gap-y-2 sm:p-4 dark:bg-neutral-900',
							selected ? 'border-[#5b3de8] shadow-[0_0_0_4px_#f1eeff] dark:shadow-[0_0_0_4px_rgba(91,61,232,.25)]' : 'border-[var(--border-default)] enabled:hover:-translate-y-px enabled:hover:border-[var(--border-hover)] enabled:hover:shadow-[var(--elev-2)]',
						)}
					>
						{option.recommended && !option.disabled ? <span className="absolute end-3 top-3 rounded-full bg-[#f1eeff] px-2 text-[11px] font-bold leading-5 text-[#5b3de8]">{fa ? 'پیشنهادی' : 'Recommended'}</span> : null}
						<span className="row-span-2 grid size-11 place-items-center rounded-xl bg-[var(--bg-surface)] sm:row-span-1"><Icon className="size-5" aria-hidden /></span>
						<span className="text-[14.5px] font-bold text-[var(--text-primary)]">{option.title}</span>
						<span className="text-[12.5px] leading-6 text-[var(--text-secondary)]">{option.body}</span>
					</button>
				)
			})}
		</div>
	)
}

function Question({ title, body, children }: { title: string; body: string; children: React.ReactNode }) {
	return (
		<div className="grid gap-3">
			<div>
				<h2 className="text-[19px] font-extrabold leading-8 text-[var(--text-primary)]">{title}</h2>
				<p className="text-[13px] leading-6 text-[var(--text-secondary)]">{body}</p>
			</div>
			{children}
		</div>
	)
}

/**
 * «دریافت پیامک»: which phone gets the bank's deposit SMS, how it reaches
 * Vigent, and the guide that ends in one real test transfer.
 */
export function DeviceSetup({ devices, inboundLines, hasCard, cardBanks }: { devices: GatewayDeviceRow[]; inboundLines: string[]; hasCard: boolean; cardBanks: string[] }) {
	const fa = useLocale() !== 'en'
	const router = useRouter()
	const lineReady = inboundLines.length > 0
	const [adding, setAdding] = useState(devices.length === 0)
	const [phone, setPhone] = useState('')
	const [platform, setPlatform] = useState<Platform | null>(null)
	const [method, setMethod] = useState<Method | null>(null)
	// One question at a time: phone type, delivery, the SIM's number, then a summary.
	const [question, setQuestion] = useState(0)
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [openGuide, setOpenGuide] = useState<string | null>(devices.find((device) => !device.verifiedAt)?.id ?? null)
	// Bank Melli's deposit SMS says «انتقال», the others «واریز».
	const [keyword, setKeyword] = useState<string>(cardBanks.length === 1 && cardBanks[0] === 'melli' ? 'انتقال' : 'واریز')

	async function create(event: React.FormEvent) {
		event.preventDefault()
		if (!platform || !method || !normalizeIranianMobile(phone)) return
		setBusy(true)
		setError(null)
		try {
			const response = await fetch('/api/payments/devices', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: platform === 'IOS' ? (fa ? 'آیفون فروشگاه' : 'Store iPhone') : (fa ? 'گوشی فروشگاه' : 'Store phone'), platform, method, phone }),
			})
			const data = (await response.json().catch(() => null)) as { id?: string; error?: string } | null
			if (!response.ok || !data?.id) {
				const copy = ERRORS[data?.error ?? '']
				setError(copy ? copy[fa ? 0 : 1] : (fa ? 'ثبت نشد؛ دوباره تلاش کنید.' : 'Not saved; try again.'))
				return
			}
			setAdding(false)
			setPhone('')
			setPlatform(null)
			setMethod(null)
			setQuestion(0)
			setOpenGuide(data.id)
			router.refresh()
		} finally {
			setBusy(false)
		}
	}

	return (
		<div className="space-y-4">
			<details className="group rounded-card border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3 text-sm leading-7 text-[var(--text-secondary)] sm:px-5">
				<summary className="flex cursor-pointer list-none items-center gap-2 font-bold text-[var(--text-primary)] [&::-webkit-details-marker]:hidden">
					<ShieldCheck className="size-4 text-emerald-600" aria-hidden />
					{fa ? 'چرا پیامک بانک لازم است و چه چیزی خوانده می‌شود؟' : 'Why the bank SMS is needed, and what is read'}
					<ChevronDown className="ms-auto size-4 transition-transform group-open:rotate-180" aria-hidden />
				</summary>
				<p className="mt-2 max-w-3xl">
					{fa
						? 'ویجنت به عکس رسید مشتری اعتماد نمی‌کند. یک پرداخت فقط وقتی خودکار تأیید می‌شود که پیامک واریز بانک، از گوشی خود شما، به ویجنت برسد. فقط پیامک‌هایی خوانده می‌شوند که از شماره‌ای که این‌جا ثبت می‌کنید آمده باشند؛ پیامک از هر شمارهٔ دیگری نادیده گرفته می‌شود.'
						: 'Vigent does not trust a receipt photo. A payment is confirmed automatically only when your bank’s deposit SMS reaches Vigent from your own phone. Only messages coming from the number you register here are read; a message from any other number is ignored.'}
				</p>
			</details>

			{devices.map((device) => (
				<DeviceCard key={device.id} device={device} fa={fa} line={inboundLines[0] ?? null} keyword={keyword} setKeyword={setKeyword} open={openGuide === device.id} onToggle={() => setOpenGuide(openGuide === device.id ? null : device.id)} hasCard={hasCard} />
			))}

			{adding ? (
				<form onSubmit={create} className="spatial-surface rounded-card p-4 sm:p-6">
					<div className="mx-auto grid max-w-xl gap-4">
						<div className="flex items-center justify-between text-[12.5px] text-[var(--text-muted)]">
							<span>{question < 3 ? (fa ? `سؤال ${(question + 1).toLocaleString('fa-IR')} از ۳` : `Question ${question + 1} of 3`) : (fa ? 'آماده برای ثبت' : 'Ready to register')}</span>
							<span aria-hidden className="flex gap-1.5">{[0, 1, 2].map((index) => <span key={index} className={cn('h-1 w-6 rounded-full transition-colors', index <= question ? 'bg-[#5b3de8]' : 'bg-[var(--bg-muted)]')} />)}</span>
						</div>
						{question === 0 && (
							<Question title={fa ? 'پیامک واریز بانک روی کدام گوشی می‌آید؟' : 'Which phone gets the bank’s deposit SMS?'} body={fa ? 'همان گوشی‌ای که سیم‌کارتِ ثبت‌شده در بانک داخلش است.' : 'The one with the SIM registered at your bank.'}>
								<Choice<Platform> label={fa ? 'نوع گوشی' : 'Phone type'} value={platform} onChange={(next) => { setPlatform(next); setQuestion(1) }} options={[
									{ value: 'ANDROID', icon: Smartphone, title: fa ? 'اندروید' : 'Android', body: fa ? 'با یک اپ فوروارد پیامک' : 'With an SMS forwarder app' },
									{ value: 'IOS', icon: Apple, title: fa ? 'آیفون' : 'iPhone', body: fa ? 'با اپ Shortcuts خود اپل' : 'With Apple’s Shortcuts app' },
								]} />
							</Question>
						)}
						{question === 1 && (
							<Question title={fa ? 'پیامک چطور به ویجنت برسد؟' : 'How should the SMS reach Vigent?'} body={fa ? 'اگر مطمئن نیستید، گزینهٔ پیشنهادی را بزنید.' : 'Not sure? Take the recommended one.'}>
								<Choice<Method> label={fa ? 'روش ارسال' : 'Delivery'} value={method} onChange={(next) => { setMethod(next); setQuestion(2) }} options={[
									{ value: 'SMS', icon: MessageSquareText, recommended: lineReady, disabled: !lineReady, title: fa ? 'فوروارد پیامکی' : 'Forward as SMS', body: lineReady ? (fa ? 'اینترنت لازم ندارد · هزینهٔ یک پیامک' : 'No internet needed · costs one SMS') : (fa ? 'سامانهٔ پیامکی هنوز فعال نشده' : 'The SMS line is not active yet') },
									{ value: 'URL', icon: Globe, recommended: !lineReady, title: fa ? 'با اینترنت' : 'Over the internet', body: fa ? 'رایگان · گوشی باید آنلاین بماند' : 'Free · the phone must stay online' },
								]} />
							</Question>
						)}
						{question === 2 && (
							<Question title={fa ? 'شمارهٔ همان سیم‌کارت' : 'That SIM’s number'} body={fa ? 'فقط پیامک‌هایی که از این شماره بیایند خوانده می‌شوند.' : 'Only messages from this number are read.'}>
								<label className="block">
									<span className="sr-only">{fa ? 'شمارهٔ موبایل' : 'Mobile number'}</span>
									<input id="pay-device-phone" dir="ltr" inputMode="tel" autoComplete="tel" autoFocus className="input font-mono text-[17px] tracking-wider" placeholder="0912 123 4567" value={phone} onChange={(event) => setPhone(event.target.value)} />
								</label>
								{phone ? (normalizeIranianMobile(phone)
									? <p className="flex items-center gap-1.5 text-[12.5px] text-emerald-700"><CheckCircle2 className="size-4" aria-hidden />{fa ? 'شمارهٔ موبایل درست است' : 'A valid mobile number'}</p>
									: <p className="text-[12.5px] text-[var(--text-muted)]">{fa ? 'مثل 09121234567' : 'Like 09121234567'}</p>) : null}
								<div><Button type="button" disabled={!normalizeIranianMobile(phone)} onClick={() => setQuestion(3)}>{fa ? 'ادامه' : 'Continue'}</Button></div>
							</Question>
						)}
						{question === 3 && (
							<Question title={fa ? 'همین؟ ثبت کنیم' : 'All set? Register it'} body={fa ? 'بعد از ثبت، راهنمای همین گوشی قدم‌به‌قدم باز می‌شود.' : 'Once registered, the step-by-step guide for this phone opens.'}>
								<div className="flex flex-wrap gap-1.5 text-[12.5px]">
									{[platform === 'IOS' ? (fa ? 'آیفون' : 'iPhone') : (fa ? 'اندروید' : 'Android'), method === 'SMS' ? (fa ? 'فوروارد پیامکی' : 'Forward as SMS') : (fa ? 'با اینترنت' : 'Over the internet')].map((item) => <span key={item} className="rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 leading-7">{item}</span>)}
									<span dir="ltr" className="rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 font-mono leading-7">{displayPhone(normalizeIranianMobile(phone) ?? phone)}</span>
								</div>
								{error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
								<div><Button type="submit" loading={busy}>{fa ? 'ثبت گوشی و رفتن به راهنما' : 'Register phone and open the guide'}</Button></div>
							</Question>
						)}
						{question > 0 || devices.length > 0 ? (
							<div className="flex flex-wrap gap-2 border-t border-[var(--border-subtle)] pt-3">
								{question > 0 && <Button type="button" variant="ghost" onClick={() => setQuestion(question - 1)}>{fa ? 'قبلی' : 'Back'}</Button>}
								{devices.length > 0 && <Button type="button" variant="ghost" onClick={() => setAdding(false)}>{fa ? 'انصراف' : 'Cancel'}</Button>}
							</div>
						) : null}
					</div>
				</form>
			) : (
				<Button variant="outline" onClick={() => setAdding(true)}><Smartphone className="size-4" aria-hidden />{fa ? 'افزودن گوشی دیگر' : 'Add another phone'}</Button>
			)}
		</div>
	)
}

function DeviceCard({ device, fa, line, keyword, setKeyword, open, onToggle, hasCard }: { device: GatewayDeviceRow; fa: boolean; line: string | null; keyword: string; setKeyword: (value: string) => void; open: boolean; onToggle: () => void; hasCard: boolean }) {
	const router = useRouter()
	const [live, setLive] = useState({ connectedAt: device.connectedAt, verifiedAt: device.verifiedAt, lastSmsAt: device.lastSmsAt })
	const [url, setUrl] = useState(device.url)
	const [busy, setBusy] = useState<string | null>(null)
	const [confirmDelete, setConfirmDelete] = useState(false)
	const [sample, setSample] = useState('')

	// While the guide is open, watch for the first forwarded message and the first matched deposit.
	useEffect(() => {
		if (!open || live.verifiedAt) return
		let stopped = false
		const timer = window.setInterval(async () => {
			try {
				const response = await fetch(`/api/payments/devices/${device.id}`, { cache: 'no-store' })
				if (!response.ok || stopped) return
				const data = (await response.json()) as typeof live
				setLive(data)
				if (data.verifiedAt) router.refresh()
			} catch { /* keep waiting */ }
		}, 4000)
		return () => { stopped = true; window.clearInterval(timer) }
	}, [open, live.verifiedAt, device.id, router])

	const parsed = useMemo(() => (sample.trim() ? parseBankSms(sample) : null), [sample])
	const found = sample.trim() ? depositKeywordOf(sample) : null

	async function patch(body: Record<string, unknown>, tag: string) {
		setBusy(tag)
		try {
			const response = await fetch(`/api/payments/devices/${device.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
			const data = (await response.json().catch(() => null)) as { url?: string } | null
			if (data?.url) setUrl(data.url)
			router.refresh()
		} finally {
			setBusy(null)
		}
	}
	async function remove() {
		setBusy('delete')
		try {
			await fetch(`/api/payments/devices/${device.id}`, { method: 'DELETE' })
			router.refresh()
		} finally {
			setBusy(null)
		}
	}
	const state = live.verifiedAt
		? { tone: 'ok' as const, text: fa ? 'فعال · واریز واقعی تطبیق خورده' : 'Active · a real deposit has matched' }
		: live.connectedAt
			? { tone: 'signal' as const, text: fa ? 'وصل شد · منتظر واریز آزمایشی' : 'Connected · waiting for the test transfer' }
			: { tone: 'warn' as const, text: fa ? 'منتظر اولین پیامک از این گوشی' : 'Waiting for the first message from this phone' }

	return (
		<section className="spatial-surface rounded-card p-4 sm:p-5">
			<div className="flex flex-wrap items-start gap-3">
				<span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--bg-muted)]"><Smartphone className="size-5" aria-hidden /></span>
				<div className="min-w-0 flex-1">
					<h2 className="text-[15px] font-bold text-[var(--text-primary)]">{device.name} <span dir="ltr" className="font-mono text-[13px] font-medium text-[var(--text-secondary)]">{displayPhone(device.phone)}</span></h2>
					<p className="mt-0.5 text-[13px] text-[var(--text-muted)]">
						{device.platform === 'IOS' ? (fa ? 'آیفون' : 'iPhone') : (fa ? 'اندروید' : 'Android')} · {device.method === 'SMS' ? (fa ? 'فوروارد پیامکی' : 'forwards as SMS') : (fa ? 'ارسال با اینترنت' : 'sends over the internet')}
						{live.lastSmsAt ? ` · ${fa ? 'آخرین پیامک' : 'last message'} ${new Intl.DateTimeFormat(fa ? 'fa-IR' : 'en-US', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(live.lastSmsAt))}` : ''}
					</p>
				</div>
				<StatusChip tone={state.tone} dot pulse={!live.connectedAt}>{state.text}</StatusChip>
			</div>

			<button type="button" onClick={onToggle} aria-expanded={open} className="mt-3 inline-flex min-h-9 items-center gap-1.5 text-[13.5px] font-medium text-[var(--text-primary)]">
				<ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} aria-hidden />
				{open ? (fa ? 'بستن راهنما' : 'Close the guide') : (fa ? 'راهنمای اتصال و تنظیمات این گوشی' : 'Setup guide and settings of this phone')}
			</button>

			{open && (
				<div className="mt-4 grid gap-6 border-t border-[var(--border-subtle)] pt-5">
					{/* 1 · the fixed word */}
					<div className="grid gap-3">
						<h3 className="text-sm font-bold text-[var(--text-primary)]">{fa ? '۱ · کلمهٔ ثابت پیامک واریز' : '1 · The fixed word of the deposit SMS'}</h3>
						<p className="max-w-3xl text-[13.5px] leading-7 text-[var(--text-secondary)]">
							{fa
								? 'اپ فوروارد باید بداند کدام پیامک را بفرستد. در هر پیامک واریز بانک یک کلمه همیشه تکرار می‌شود؛ شرط اپ را روی همان کلمه بگذارید تا فقط پیامک واریز فرستاده شود و رمز پویا و پیام‌های شخصی هیچ‌وقت از گوشی بیرون نروند.'
								: 'The forwarder must know which message to send. Every deposit SMS of a bank repeats one word; set the app’s condition to that word so only deposit messages are sent and one-time passwords or personal texts never leave the phone.'}
						</p>
						<div className="flex flex-wrap items-center gap-2">
							{DEPOSIT_KEYWORDS.slice(0, 2).map((word) => (
								<button key={word} type="button" onClick={() => setKeyword(word)} aria-pressed={keyword === word} className={cn('min-h-10 rounded-full border px-4 text-sm font-bold', keyword === word ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-white' : 'border-[var(--border-default)] bg-white text-[var(--text-primary)]')}>
									{word}
									<span className="ms-1.5 text-[11.5px] font-normal opacity-75">{word === 'واریز' ? (fa ? 'بیشتر بانک‌ها' : 'most banks') : (fa ? 'بانک ملی' : 'Bank Melli')}</span>
								</button>
							))}
							<CopyButton value={keyword} label={fa ? `کپی «${keyword}»` : `Copy “${keyword}”`} copiedLabel={fa ? 'کپی شد' : 'Copied'} showLabel />
						</div>
						<label className="block max-w-xl">
							<span className="ui-field-label">{fa ? 'مطمئن نیستید؟ یکی از پیامک‌های واریز قبلی‌تان را این‌جا بچسبانید' : 'Not sure? Paste one of your past deposit messages here'}</span>
							<textarea id={`pay-sms-sample-${device.id}`} dir="rtl" rows={4} className="input mt-1.5 resize-y text-[13px] leading-7" value={sample} onChange={(event) => setSample(event.target.value)} placeholder={'حساب…\nواریز12,503,470\nمانده…'} />
						</label>
						{parsed && (
							<p role="status" className={cn('max-w-xl rounded-control p-3 text-[13.5px] leading-7', parsed.kind === 'deposit' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900')}>
								{parsed.kind === 'deposit' && parsed.amountRial != null
									? (fa
										? <>این پیامک خوانده می‌شود: واریز <b dir="ltr">{parsed.amountRial.toLocaleString('en-US')}</b> ریال{found ? <> · کلمهٔ ثابت: <b>«{found}»</b></> : null}. {found && found !== keyword ? <button type="button" className="ui-link" onClick={() => setKeyword(found)}>همین را انتخاب کن</button> : null}</>
										: <>This message is readable: a deposit of <b>{parsed.amountRial.toLocaleString('en-US')}</b> rials{found ? <> · fixed word: <b>“{found}”</b></> : null}. {found && found !== keyword ? <button type="button" className="ui-link" onClick={() => setKeyword(found)}>Use it</button> : null}</>)
									: parsed.kind === 'secret'
										? (fa ? 'این پیام رمز یا کد دارد؛ چنین پیامی هرگز ذخیره نمی‌شود و نباید فوروارد شود.' : 'This message carries a password or code; such a message is never stored and must not be forwarded.')
										: (fa ? 'این پیامک واریز نیست یا مبلغش خوانده نشد. متن کامل یک پیامک واریز را بچسبانید.' : 'This is not a deposit message, or its amount could not be read. Paste the full text of a deposit SMS.')}
							</p>
						)}
					</div>

					{/* 2 · where to send */}
					<div className="grid gap-3">
						<h3 className="text-sm font-bold text-[var(--text-primary)]">{fa ? '۲ · مقصد' : '2 · Destination'}</h3>
						{device.method === 'SMS' ? (
							<div className="flex max-w-xl flex-wrap items-center gap-2 rounded-control border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2.5 ps-3.5">
								<span className="min-w-0 flex-1 text-[13.5px] text-[var(--text-secondary)]">{fa ? 'پیامک واریز را به این شماره فوروارد کنید:' : 'Forward the deposit SMS to this number:'} <b dir="ltr" className="font-mono text-[15px] text-[var(--text-primary)]">{line ?? '—'}</b></span>
								{line && <CopyButton value={line} label={fa ? 'کپی شماره' : 'Copy number'} copiedLabel={fa ? 'کپی شد' : 'Copied'} showLabel />}
							</div>
						) : (
							<div className="grid max-w-2xl gap-2">
								<div className="flex items-center gap-2 rounded-control border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2 ps-3">
									<span dir="ltr" className="min-w-0 flex-1 truncate font-mono text-[12.5px]">{url}</span>
									<CopyButton value={url} label={fa ? 'کپی نشانی' : 'Copy address'} copiedLabel={fa ? 'کپی شد' : 'Copied'} showLabel />
								</div>
								<p className="text-[13px] leading-7 text-[var(--text-muted)]">
									{fa ? 'اگر اپ شما پیامک را داخل خود لینک می‌گذارد، همین نشانی را با ' : 'If your app puts the message inside the link, use this address with '}
									<code dir="ltr" className="rounded bg-[var(--bg-muted)] px-1.5 py-0.5 font-mono text-[12px]">?text=</code>
									{fa ? ' در آخرش بدهید. این نشانی مثل رمز است؛ آن را برای کسی نفرستید.' : ' at the end. This address works like a password; do not share it.'}
								</p>
							</div>
						)}
					</div>

					{/* 3 · on the phone */}
					<div className="grid gap-3">
						<h3 className="text-sm font-bold text-[var(--text-primary)]">{fa ? '۳ · روی گوشی' : '3 · On the phone'}</h3>
						<SetupPlayer platform={device.platform} method={device.method} line={line} url={url} keyword={keyword} lang={fa ? 'fa' : 'en'} />
					</div>

					{/* 4 · connection + test */}
					<div className="grid gap-3">
						<h3 className="text-sm font-bold text-[var(--text-primary)]">{fa ? '۴ · تست' : '4 · Test'}</h3>
						<div className={cn('flex max-w-2xl items-start gap-3 rounded-control border p-3.5', live.connectedAt ? 'border-emerald-200 bg-emerald-50/70' : 'border-[var(--border-default)] bg-[var(--bg-surface)]')}>
							{live.connectedAt ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-hidden /> : <Radio className="mt-0.5 size-5 shrink-0 animate-pulse text-[var(--text-muted)] motion-reduce:animate-none" aria-hidden />}
							<p className="text-[13.5px] leading-7 text-[var(--text-secondary)]">
								{live.connectedAt
									? (fa ? 'اولین پیام از این گوشی رسید؛ اتصال برقرار است.' : 'The first message from this phone arrived; the connection works.')
									: (fa ? 'این صفحه منتظر اولین پیام از این گوشی است. دکمهٔ «تست» اپ را بزنید یا واریز آزمایشی پایین را انجام دهید؛ همین‌جا خودش سبز می‌شود.' : 'This page is waiting for the first message from this phone. Tap the app’s Test button or make the test transfer below; it turns green by itself.')}
							</p>
						</div>
						<TestTransfer verified={Boolean(live.verifiedAt)} hasCard={hasCard} />
					</div>

					{/* settings of this phone */}
					<div className="flex flex-wrap items-center gap-2 border-t border-[var(--border-subtle)] pt-4">
						{device.method === 'URL' && <Button size="sm" variant="outline" loading={busy === 'rotate'} onClick={() => patch({ rotate: true }, 'rotate')}><RefreshCw className="size-3.5" aria-hidden />{fa ? 'نشانی تازه' : 'New address'}</Button>}
						<Button size="sm" variant="outline" loading={busy === 'active'} onClick={() => patch({ active: !device.active }, 'active')}>{device.active ? (fa ? 'غیرفعال کردن این گوشی' : 'Deactivate this phone') : (fa ? 'فعال کردن' : 'Activate')}</Button>
						{confirmDelete ? (
							<>
								<Button size="sm" variant="danger" loading={busy === 'delete'} onClick={remove}>{fa ? 'حذف شود' : 'Remove'}</Button>
								<Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>{fa ? 'انصراف' : 'Keep'}</Button>
							</>
						) : (
							<Button size="sm" variant="ghost" onClick={() => setConfirmDelete(true)}><Trash2 className="size-3.5" aria-hidden />{fa ? 'حذف گوشی' : 'Remove phone'}</Button>
						)}
						{device.method === 'URL' && <span className="text-[12.5px] text-[var(--text-muted)]">{fa ? 'با «نشانی تازه» نشانی قبلی همان لحظه از کار می‌افتد.' : 'A new address stops the old one at once.'}</span>}
					</div>
				</div>
			)}
		</section>
	)
}

/**
 * The one real transfer that proves the chain: a small test payment to the
 * owner's card; the card turns green when its deposit SMS matches.
 */
export function TestTransfer({ verified, hasCard }: { verified: boolean; hasCard: boolean }) {
	const fa = useLocale() !== 'en'
	const router = useRouter()
	const [busy, setBusy] = useState(false)
	const [test, setTest] = useState<CardPayView | null>(null)
	const [testError, setTestError] = useState<string | null>(null)

	async function startTest() {
		setBusy(true)
		setTestError(null)
		try {
			const response = await fetch('/api/payments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: 1000, test: true }) })
			const data = (await response.json().catch(() => null)) as { card?: CardPayView; error?: string } | null
			if (!response.ok || !data?.card) {
				const copy = ERRORS[data?.error ?? '']
				setTestError(copy ? copy[fa ? 0 : 1] : (fa ? 'واریز آزمایشی ساخته نشد.' : 'The test transfer could not be created.'))
				return
			}
			setTest(data.card)
		} finally {
			setBusy(false)
		}
	}

	if (verified) {
		return <p className="flex max-w-2xl items-center gap-2 rounded-control bg-emerald-50 p-3.5 text-[13.5px] font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"><CheckCircle2 className="size-5" aria-hidden />{fa ? 'یک واریز واقعی از روی پیامک گوشی شما تطبیق خورده است.' : 'A real deposit has matched from your phone’s SMS.'}</p>
	}
	if (test) {
		return (
			<div className="grid max-w-sm gap-2">
				<p className="text-[13.5px] leading-7 text-[var(--text-secondary)]">{fa ? 'همین مبلغ را از کارت دیگری (یا از حساب دیگر خودتان) به این کارت واریز کنید. وقتی پیامکش برسد، کارت پایین سبز می‌شود.' : 'Transfer exactly this amount from another card to this card. When its SMS arrives the card below turns green.'}</p>
				<CardPayCardView card={test} accent="#111111" onAccent="#ffffff" canClaim={false} onStatus={(status) => { if (status === 'PAID') router.refresh() }} />
			</div>
		)
	}
	return (
		<div className="flex flex-wrap items-center gap-3">
			<Button loading={busy} disabled={!hasCard} onClick={startTest}>{fa ? 'شروع واریز آزمایشی (حدود ۱٬۰۰۰ تومان)' : 'Start the test transfer (about 1,000 Toman)'}</Button>
			{!hasCard && <span className="text-[13px] text-[var(--text-muted)]">{fa ? 'اول یک کارت اضافه کنید.' : 'Add a card first.'}</span>}
			{testError && <span role="alert" className="text-[13px] text-red-600">{testError}</span>}
		</div>
	)
}
