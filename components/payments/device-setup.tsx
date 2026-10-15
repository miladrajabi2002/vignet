'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { AlertTriangle, Apple, ArrowLeft, ArrowRight, BookOpen, CheckCircle2, ChevronDown, ClipboardPaste, Download, Globe, Lightbulb, ListChecks, Loader2, Lock, MessageSquareText, Radio, RefreshCw, RotateCcw, ShieldCheck, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/ui/copy-button'
import { StatusChip } from '@/components/ui/status-chip'
import { CardPayCardView } from '@/components/commerce/card-pay-view'
import { PhoneMock, useSetupSteps } from '@/components/payments/setup-player'
import { cn } from '@/lib/utils'
import { displayPhone, normalizeIranianMobile } from '@/lib/phone'
import type { CardPayView } from '@/lib/payments/card/pay-card'
import type { GatewayDeviceRow } from '@/lib/payments/card/dashboard'
import type { SmsSampleReading } from '@/lib/payments/card/sms-sample'

type Platform = 'ANDROID' | 'IOS'
type Method = 'SMS' | 'URL'

const ERRORS: Record<string, [string, string]> = {
	INVALID_PHONE: ['شمارهٔ موبایل درست نیست؛ مثل 09121234567 وارد کنید.', 'That mobile number is not valid; enter it like 09121234567.'],
	PHONE_IN_USE: ['این شماره قبلاً برای یک گوشی دیگر ثبت شده است.', 'This number is already registered for another phone.'],
	TOO_MANY_DEVICES: ['یک گوشی ثبت شده است؛ برای عوض کردنش اول همان را حذف کنید.', 'A phone is already registered; remove it first to change it.'],
	NO_CARD: ['اول از تب «کارت‌ها» یک کارت فعال اضافه کنید.', 'Add an active card in the Cards tab first.'],
}

/** The phone step's stages, the same row in the questions and in the guide. */
const STAGES: Array<[string, string]> = [
	['نوع گوشی', 'Phone type'],
	['پیامک نمونه', 'Sample SMS'],
	['روش ارسال', 'Delivery'],
	['شمارهٔ فرستنده', 'Sender number'],
	['تنظیم روی گوشی', 'On the phone'],
]

/**
 * The answers of a phone being replaced (switching to another phone, or
 * editing the answers mid-setup), so the questions open filled in.
 */
const DRAFT_KEY = 'vigent:pay-phone-draft'
type Draft = { platform: Platform | null; method: Method | null; phone: string; keyword: string | null }

function readDraft(): Draft | null {
	try {
		const raw = window.sessionStorage.getItem(DRAFT_KEY)
		return raw ? (JSON.parse(raw) as Draft) : null
	} catch {
		return null
	}
}
function writeDraft(draft: Draft | null) {
	try {
		if (draft) window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
		else window.sessionStorage.removeItem(DRAFT_KEY)
	} catch { /* private mode: the questions open empty */ }
}

const platformName = (platform: Platform, fa: boolean) => (platform === 'IOS' ? (fa ? 'آیفون' : 'iPhone') : (fa ? 'اندروید' : 'Android'))
const methodName = (method: Method, fa: boolean) => (method === 'SMS' ? (fa ? 'فوروارد پیامکی' : 'Forward as SMS') : (fa ? 'با اینترنت' : 'Over the internet'))

/** Where the phone step goes from its first and last screens (the gateway setup's previous and next steps). */
export interface StepExits {
	back?: { label: string; onClick: () => void } | null
	next?: { label: string; onClick: () => void; ready: boolean } | null
}

function Progress({ stage, sub }: { stage: number; sub?: string }) {
	const fa = useLocale() !== 'en'
	const at = fa ? 0 : 1
	const numbers = fa ? 'fa-IR' : 'en-US'
	return (
		<div className="grid gap-2">
			<p className="text-[12.5px] text-[var(--text-muted)]">
				{fa ? `مرحلهٔ ${(stage + 1).toLocaleString(numbers)} از ${STAGES.length.toLocaleString(numbers)}` : `Stage ${stage + 1} of ${STAGES.length}`}
				{' · '}<b className="text-[var(--text-primary)]">{STAGES[stage][at]}</b>
				{sub ? <span> ({sub})</span> : null}
			</p>
			<ol aria-hidden className="grid gap-1" style={{ gridTemplateColumns: `repeat(${STAGES.length}, minmax(0, 1fr))` }}>
				{STAGES.map((label, index) => (
					<li key={label[1]} className="grid gap-1">
						<span className={cn('h-1 rounded-full transition-colors duration-300', index < stage ? 'bg-emerald-500' : index === stage ? 'bg-[#5b3de8]' : 'bg-[var(--bg-muted)]')} />
						<span className={cn('hidden truncate text-[11px] md:block', index === stage ? 'font-bold text-[var(--text-primary)]' : 'text-[var(--text-hint)]')}>{label[at]}</span>
					</li>
				))}
			</ol>
		</div>
	)
}

/**
 * Back on the start side, the way forward on the end side; the same bar on
 * every screen of the phone step, so the buttons never move around.
 */
export function StepFooter({ back, next, hint }: { back?: { label: string; onClick: () => void } | null; next?: ReactNode; hint?: ReactNode }) {
	return (
		<div className="grid gap-2 border-t border-[var(--border-subtle)] pt-4">
			<div className="flex flex-wrap-reverse items-center justify-between gap-2">
				{back ? (
					<Button type="button" variant="outline" onClick={back.onClick}>
						<ArrowRight className="size-4 ltr:rotate-180" aria-hidden />{back.label}
					</Button>
				) : <span />}
				{next ?? null}
			</div>
			{hint ? <p className="flex items-center gap-1.5 text-[12.5px] text-[var(--text-muted)] sm:justify-end"><Lock className="size-3.5 shrink-0" aria-hidden />{hint}</p> : null}
		</div>
	)
}

function NextButton({ label, onClick, disabled, loading, type = 'button' }: { label: string; onClick?: () => void; disabled?: boolean; loading?: boolean; type?: 'button' | 'submit' }) {
	return (
		<Button type={type} onClick={onClick} disabled={disabled} loading={loading}>
			{label}<ArrowLeft className="size-4 ltr:rotate-180" aria-hidden />
		</Button>
	)
}

/** Radio cards: the icon, the title with its tag, and a radio mark at the end that never sits on the tag. */
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
							'grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 rounded-2xl border-[1.5px] bg-white p-3.5 text-start transition-[border-color,box-shadow,transform] duration-150 disabled:cursor-not-allowed disabled:opacity-50 sm:p-4 dark:bg-neutral-900',
							selected ? 'border-[#5b3de8] shadow-[0_0_0_4px_#f1eeff] dark:shadow-[0_0_0_4px_rgba(91,61,232,.25)]' : 'border-[var(--border-default)] enabled:hover:-translate-y-px enabled:hover:border-[var(--border-hover)] enabled:hover:shadow-[var(--elev-2)]',
						)}
					>
						<span className={cn('row-span-2 grid size-11 place-items-center rounded-xl', selected ? 'bg-[#f1eeff] text-[#5b3de8] dark:bg-[#5b3de8]/20' : 'bg-[var(--bg-surface)] text-[var(--text-secondary)]')}><Icon className="size-5" aria-hidden /></span>
						<span className="flex flex-wrap items-center gap-x-2 gap-y-1">
							<span className="text-[14.5px] font-bold text-[var(--text-primary)]">{option.title}</span>
							{option.recommended && !option.disabled ? <span className="rounded-full bg-[#f1eeff] px-2 text-[11px] font-bold leading-5 text-[#5b3de8] dark:bg-[#5b3de8]/20 dark:text-[#b9adff]">{fa ? 'پیشنهادی' : 'Recommended'}</span> : null}
						</span>
						<span aria-hidden className={cn('row-span-2 grid size-5 place-items-center rounded-full border-[1.5px] transition-colors', selected ? 'border-[#5b3de8] bg-[#5b3de8]' : 'border-[var(--border-strong)]')}>
							{selected ? <span className="size-2 rounded-full bg-white" /> : null}
						</span>
						<span className="text-[12.5px] leading-6 text-[var(--text-secondary)]">{option.body}</span>
					</button>
				)
			})}
		</div>
	)
}

function Question({ title, body, children }: { title: string; body: ReactNode; children: ReactNode }) {
	return (
		<div className="grid gap-3.5">
			<div>
				<h2 className="text-[18px] font-extrabold leading-8 text-[var(--text-primary)]">{title}</h2>
				<p className="text-[13px] leading-6 text-[var(--text-secondary)]">{body}</p>
			</div>
			{children}
		</div>
	)
}

/**
 * «دریافت پیامک»: one phone gets the bank's deposit SMS and passes it to
 * Vigent. With no phone yet it asks four questions (phone type, a sample
 * deposit SMS to read the filter from, delivery, the sender's number); once
 * the phone is registered it is the guide for that phone, page by page.
 * Whether it works is proved by the test transfer that follows.
 */
export function DeviceSetup({ devices, inboundLines, hasCard, inSetup = false, exits }: { devices: GatewayDeviceRow[]; inboundLines: string[]; hasCard: boolean; inSetup?: boolean; exits?: StepExits }) {
	const fa = useLocale() !== 'en'
	return (
		<div className="space-y-4">
			{!inSetup && (
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
			)}
			{devices.length === 0
				? <NewPhone inboundLines={inboundLines} exits={exits} />
				: devices.map((device) => <PhoneGuide key={device.id} device={device} line={inboundLines[0] ?? null} hasCard={hasCard} inSetup={inSetup} exits={exits} />)}
		</div>
	)
}

// ─── The four questions ──────────────────────────────────────────────────────

function NewPhone({ inboundLines, exits }: { inboundLines: string[]; exits?: StepExits }) {
	const fa = useLocale() !== 'en'
	const router = useRouter()
	const lineReady = inboundLines.length > 0
	const [question, setQuestion] = useState(0)
	const [platform, setPlatform] = useState<Platform | null>(null)
	const [keyword, setKeyword] = useState<string | null>(null)
	const [method, setMethod] = useState<Method | null>(null)
	const [phone, setPhone] = useState('')
	const [sample, setSample] = useState('')
	const [reading, setReading] = useState(false)
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const sampleRef = useRef<HTMLTextAreaElement>(null)
	const validPhone = normalizeIranianMobile(phone)

	// A phone being replaced: its answers come back filled in.
	useEffect(() => {
		const draft = readDraft()
		if (!draft) return
		setPlatform(draft.platform)
		setMethod(draft.method)
		setPhone(draft.phone)
		setKeyword(draft.keyword)
	}, [])

	/** Reads the pasted SMS for its fixed text, then moves on without stopping to show it. */
	async function readSample(text = sample) {
		if (text.trim().length < 8 || reading) return
		setReading(true)
		setError(null)
		try {
			const response = await fetch('/api/payments/sms-sample', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) })
			const data = (await response.json().catch(() => null)) as SmsSampleReading | null
			if (!response.ok || !data) {
				setError(response.status === 429 ? (fa ? 'چند دقیقه بعد دوباره امتحان کنید.' : 'Try again in a few minutes.') : (fa ? 'پیامک خوانده نشد؛ دوباره تلاش کنید.' : 'Could not read it; try again.'))
				return
			}
			if (data.kind === 'secret') return setError(fa ? 'این پیامک رمز یا کد دارد. یک پیامک «واریز» بچسبانید.' : 'This message carries a password or code. Paste a deposit message.')
			if (data.kind === 'withdraw') return setError(fa ? 'این پیامک برداشت است، نه واریز. یک پیامک واریز بچسبانید.' : 'This is a withdrawal, not a deposit. Paste a deposit message.')
			if (!data.filter) return setError(fa ? 'متن ثابتی در این پیامک پیدا نشد؛ متن کامل یک پیامک واریز را بچسبانید.' : 'No fixed text was found; paste the full text of a deposit message.')
			setKeyword(data.filter)
			setQuestion(2)
		} catch {
			setError(fa ? 'پیامک خوانده نشد؛ اینترنت را چک کنید.' : 'Could not read it; check the connection.')
		} finally {
			setReading(false)
		}
	}

	async function pasteSample() {
		try {
			const text = await navigator.clipboard.readText()
			if (!text.trim()) {
				setError(fa ? 'کلیپ‌بورد خالی است؛ اول پیامک واریز را کپی کنید.' : 'The clipboard is empty; copy the deposit message first.')
				return
			}
			setSample(text)
			void readSample(text)
		} catch {
			sampleRef.current?.focus()
			setError(fa ? 'مرورگر اجازهٔ خواندن کلیپ‌بورد را نداد؛ پیامک را داخل کادر بچسبانید.' : 'The browser did not allow reading the clipboard; paste the message into the box.')
		}
	}

	async function create() {
		if (!platform || !method || !validPhone) return
		setBusy(true)
		setError(null)
		try {
			const response = await fetch('/api/payments/devices', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: platform === 'IOS' ? (fa ? 'آیفون فروشگاه' : 'Store iPhone') : (fa ? 'گوشی فروشگاه' : 'Store phone'), platform, method, phone: validPhone, keyword }),
			})
			const data = (await response.json().catch(() => null)) as { id?: string; error?: string } | null
			if (!response.ok || !data?.id) {
				const copy = ERRORS[data?.error ?? '']
				setError(copy ? copy[fa ? 0 : 1] : (fa ? 'ثبت نشد؛ دوباره تلاش کنید.' : 'Not saved; try again.'))
				return
			}
			writeDraft(null)
			router.refresh()
		} catch {
			setError(fa ? 'ثبت نشد؛ اینترنت را چک کنید.' : 'Not saved; check the connection.')
		} finally {
			setBusy(false)
		}
	}

	function go(to: number) {
		setError(null)
		setQuestion(to)
	}
	const back = question > 0 ? { label: fa ? 'قبلی' : 'Back', onClick: () => go(question - 1) } : exits?.back ?? null
	const ready = [platform != null, sample.trim().length >= 8 || keyword != null, method != null, validPhone != null][question]

	function submit() {
		if (question === 3) return void create()
		// The sample is read on the way forward; an answer kept from before needs no new read.
		if (question === 1 && (sample.trim().length >= 8 || !keyword)) return void readSample()
		if (ready) go(question + 1)
	}

	return (
		<form onSubmit={(event) => { event.preventDefault(); submit() }} className="spatial-surface grid gap-5 rounded-card p-4 sm:p-6">
			<Progress stage={question} />
			<div className="grid min-h-[15rem] content-start gap-4">
				{question === 0 && (
					<Question title={fa ? 'پیامک واریز بانک روی کدام گوشی می‌آید؟' : 'Which phone gets the bank’s deposit SMS?'} body={fa ? 'همان گوشی‌ای که سیم‌کارتِ ثبت‌شده در بانک داخلش است. راهنمای بعدی برای همین گوشی نوشته می‌شود.' : 'The one with the SIM registered at your bank. The guide that follows is written for it.'}>
						<Choice<Platform> label={fa ? 'نوع گوشی' : 'Phone type'} value={platform} onChange={setPlatform} options={[
							{ value: 'ANDROID', icon: Smartphone, title: fa ? 'اندروید' : 'Android', body: fa ? 'سامسونگ، شیائومی و…؛ با یک اپ فوروارد پیامک' : 'Samsung, Xiaomi…; with an SMS forwarder app' },
							{ value: 'IOS', icon: Apple, title: fa ? 'آیفون' : 'iPhone', body: fa ? 'با اپ Shortcuts خود اپل؛ بدون نصب اپ' : 'With Apple’s Shortcuts app; nothing to install' },
						]} />
					</Question>
				)}
				{question === 1 && (
					<Question title={fa ? 'یک پیامک واریز همین کارت را وارد کنید' : 'Paste one deposit SMS of this card'} body={fa ? 'روی همان گوشی، یکی از پیامک‌های واریز بانک را کپی کنید و این‌جا بچسبانید. ویجنت خودش متن ثابت آن را پیدا می‌کند و به مرحلهٔ بعد می‌رود.' : 'On that phone, copy one of the bank’s deposit messages and paste it here. Vigent finds its fixed text by itself and moves on.'}>
						<div className={cn('relative rounded-control border-[1.5px] bg-white transition-colors focus-within:border-[#5b3de8] dark:bg-neutral-900', error ? 'border-red-300' : 'border-[var(--border-default)]')}>
							<label className="block">
								<span className="sr-only">{fa ? 'متن پیامک واریز' : 'Deposit SMS text'}</span>
								<textarea
									ref={sampleRef}
									id="pay-sms-sample"
									dir="rtl"
									rows={5}
									className="block w-full resize-none bg-transparent px-3.5 pb-14 pt-3 font-mono text-[13.5px] leading-7 text-[var(--text-primary)] outline-none placeholder:text-[var(--text-hint)]"
									value={sample}
									disabled={reading}
									onChange={(event) => { setSample(event.target.value); setError(null) }}
									onPaste={(event) => { const text = event.clipboardData.getData('text'); if (text.trim().length >= 8) window.setTimeout(() => void readSample(text), 0) }}
									placeholder={fa ? 'مثلاً:\nحساب8907027623\nواریز303,210,000\nمانده452,963,014\n05/07/15-11:33' : 'e.g.\nAccount 8907027623\nDeposit 303,210,000\nBalance 452,963,014'}
								/>
							</label>
							<div className="absolute inset-x-2.5 bottom-2.5 flex items-center justify-between gap-2">
								<span className="flex min-w-0 items-center gap-1.5 text-[12px] text-[var(--text-muted)]">
									{reading
										? <><Loader2 className="size-3.5 shrink-0 animate-spin text-[#5b3de8]" aria-hidden /><span role="status">{fa ? 'در حال پیدا کردن متن ثابت…' : 'Finding the fixed text…'}</span></>
										: <><ShieldCheck className="size-3.5 shrink-0" aria-hidden /><span className="truncate">{fa ? 'مانده و رمز هیچ‌وقت ذخیره نمی‌شوند' : 'Balances and codes are never stored'}</span></>}
								</span>
								<Button type="button" size="sm" variant="secondary" disabled={reading} onClick={pasteSample}>
									<ClipboardPaste className="size-4" aria-hidden />{fa ? 'چسباندن' : 'Paste'}
								</Button>
							</div>
						</div>
						{error ? <p role="alert" className="flex items-start gap-2 text-[13px] leading-6 text-red-600"><AlertTriangle className="mt-1 size-4 shrink-0" aria-hidden />{error}</p> : null}
						{!error && keyword && !sample.trim() ? <p className="text-[12.5px] leading-6 text-[var(--text-muted)]">{fa ? 'پیامک تازه‌ای لازم نیست؛ با «بعدی» همان متن ثابت قبلی می‌ماند.' : 'No new message needed; «Next» keeps the fixed text from before.'}</p> : null}
					</Question>
				)}
				{question === 2 && (
					<Question title={fa ? 'پیامک چطور به ویجنت برسد؟' : 'How should the SMS reach Vigent?'} body={fa ? 'اگر مطمئن نیستید، گزینهٔ پیشنهادی را بزنید.' : 'Not sure? Take the recommended one.'}>
						<Choice<Method> label={fa ? 'روش ارسال' : 'Delivery'} value={method} onChange={setMethod} options={[
							{ value: 'SMS', icon: MessageSquareText, recommended: lineReady, disabled: !lineReady, title: fa ? 'فوروارد پیامکی' : 'Forward as SMS', body: lineReady ? (fa ? 'اینترنت لازم ندارد · هزینهٔ یک پیامک برای هر واریز' : 'No internet needed · one SMS per deposit') : (fa ? 'سامانهٔ پیامکی هنوز فعال نشده' : 'The SMS line is not active yet') },
							{ value: 'URL', icon: Globe, recommended: !lineReady, title: fa ? 'با اینترنت (لینک)' : 'Over the internet (link)', body: fa ? 'رایگان · گوشی باید به اینترنت وصل بماند' : 'Free · the phone must stay online' },
						]} />
					</Question>
				)}
				{question === 3 && (
					<Question
						title={method === 'URL' ? (fa ? 'شمارهٔ سیم‌کارت همین گوشی' : 'This phone’s SIM number') : (fa ? 'شماره‌ای که پیامک را می‌فرستد' : 'The number that sends the SMS')}
						body={method === 'URL'
							? (fa ? 'شمارهٔ سیم‌کارتی که پیامک واریز بانک رویش می‌آید.' : 'The SIM that gets the bank’s deposit SMS.')
							: (fa ? 'شماره‌ای که پیامک‌های واریز را برای سامانهٔ پیامکی ویجنت می‌فرستد. فقط پیامک‌هایی که از همین شماره برسند خوانده می‌شوند.' : 'The number that forwards the deposit messages to Vigent’s SMS line. Only messages from this number are read.')}
					>
						<label className="block max-w-sm">
							<span className="sr-only">{fa ? 'شمارهٔ موبایل' : 'Mobile number'}</span>
							<input
								id="pay-device-phone"
								dir="ltr"
								inputMode="tel"
								autoComplete="tel"
								autoFocus
								className="input font-mono text-[17px] tracking-wider"
								placeholder="0912 123 4567"
								value={phone}
								onChange={(event) => setPhone(event.target.value)}
								// +98…, 98… and 912… all become 09…: one spelling for one SIM.
								onBlur={() => { if (validPhone) setPhone(validPhone) }}
							/>
						</label>
						{phone ? (validPhone
							? <p className="flex items-center gap-1.5 text-[12.5px] text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="size-4" aria-hidden />{fa ? 'ثبت می‌شود به شکل ' : 'Saved as '}<b dir="ltr" className="font-mono">{validPhone}</b></p>
							: <p className="text-[12.5px] text-[var(--text-muted)]">{fa ? 'مثل 09121234567' : 'Like 09121234567'}</p>) : null}
						{error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
					</Question>
				)}
			</div>
			<StepFooter
				back={back}
				next={<NextButton type="submit" label={question === 3 ? (fa ? 'ثبت و رفتن به راهنما' : 'Save and open the guide') : (fa ? 'بعدی' : 'Next')} disabled={!ready || reading} loading={busy || reading} />}
			/>
		</form>
	)
}

// ─── The registered phone: the guide, page by page ──────────────────────────

/**
 * The guide for the registered phone, one screen per thing to tap. In the
 * setup its last page hands over to the test transfer; on its own page the
 * test transfer is its last page.
 */
function PhoneGuide({ device, line, hasCard, inSetup, exits }: { device: GatewayDeviceRow; line: string | null; hasCard: boolean; inSetup: boolean; exits?: StepExits }) {
	const fa = useLocale() !== 'en'
	const numbers = fa ? 'fa-IR' : 'en-US'
	const router = useRouter()
	const [url, setUrl] = useState(device.url)
	const [busy, setBusy] = useState<string | null>(null)
	const [page, setPage] = useState(0)
	const keyword = device.keyword ?? 'واریز'
	const steps = useSetupSteps({ platform: device.platform, method: device.method, line, url, keyword, lang: fa ? 'fa' : 'en' })
	// Outside the setup the test transfer is one more page.
	const testPage = inSetup ? -1 : steps.length
	const lastPage = inSetup ? steps.length - 1 : steps.length
	const current = steps[Math.min(page, steps.length - 1)]
	const destination = device.method === 'SMS' ? line : url

	async function rotate() {
		setBusy('rotate')
		try {
			const response = await fetch(`/api/payments/devices/${device.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rotate: true }) })
			const data = (await response.json().catch(() => null)) as { url?: string } | null
			if (data?.url) setUrl(data.url)
			router.refresh()
		} finally {
			setBusy(null)
		}
	}
	/** Back to the questions, filled in with this phone's answers. */
	async function editAnswers() {
		setBusy('edit')
		try {
			writeDraft({ platform: device.platform, method: device.method, phone: device.phone ?? '', keyword: device.keyword })
			await fetch(`/api/payments/devices/${device.id}`, { method: 'DELETE' })
			router.refresh()
		} finally {
			setBusy(null)
		}
	}

	// Editing the answers replaces the phone: only in the setup, before it is live.
	// Afterwards that is «تعویض گوشی» in Settings, with its own confirmation.
	const back = page > 0
		? { label: fa ? 'قبلی' : 'Back', onClick: () => setPage(page - 1) }
		: inSetup ? { label: fa ? 'ویرایش پاسخ‌ها' : 'Edit the answers', onClick: () => void editAnswers() } : null
	let next: ReactNode = null
	if (page < lastPage) next = <NextButton label={fa ? 'بعدی' : 'Next'} onClick={() => setPage(page + 1)} />
	else if (inSetup && exits?.next) next = <NextButton label={exits.next.label} onClick={exits.next.onClick} />
	// The phone is proved: nothing to go back to, the way on is the payments.
	const done = page === testPage && Boolean(device.verifiedAt)
	if (done) next = <Link href="/payments" className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-[var(--text-primary)] px-5 text-[14px] font-bold text-white dark:text-neutral-900"><ListChecks className="size-4" aria-hidden />{fa ? 'رفتن به پرداخت‌ها' : 'Go to payments'}<ArrowLeft className="size-4 ltr:rotate-180" aria-hidden /></Link>

	return (
		<section className="spatial-surface grid gap-5 rounded-card p-4 sm:p-6">
			<Progress stage={4} sub={page === testPage ? (fa ? 'واریز آزمایشی' : 'test transfer') : (fa ? `${(page + 1).toLocaleString(numbers)} از ${steps.length.toLocaleString(numbers)}` : `${page + 1} of ${steps.length}`)} />

			{page === testPage ? (
				<div className="grid gap-3">
					<div>
						<h3 className="text-[17px] font-extrabold leading-8 text-[var(--text-primary)]">{fa ? 'یک واریز آزمایشی' : 'One test transfer'}</h3>
						<p className="text-[13.5px] leading-7 text-[var(--text-secondary)]">{fa ? 'گوشی وقتی وصل حساب می‌شود که پیامک یک واریز واقعی از آن به ویجنت برسد.' : 'The phone counts as connected once a real deposit’s SMS reaches Vigent from it.'}</p>
					</div>
					<TestTransfer verified={Boolean(device.verifiedAt)} hasCard={hasCard} />
				</div>
			) : (
				<div className="grid gap-5 md:grid-cols-[12.5rem_minmax(0,1fr)] md:items-start md:gap-8">
					<PhoneMock steps={steps} step={Math.min(page, steps.length - 1)} platform={device.platform} className="w-[11rem] md:w-[12.5rem]" />
					<div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-3.5">
						<p className="flex flex-wrap items-center gap-1.5 text-[12px] text-[var(--text-muted)]">
							{device.platform === 'IOS' ? <Apple className="size-3.5" aria-hidden /> : <Smartphone className="size-3.5" aria-hidden />}
							{platformName(device.platform, fa)} · {methodName(device.method, fa)}
							{device.phone ? <> · <span dir="ltr" className="font-mono">{displayPhone(device.phone)}</span></> : null}
						</p>
						<div>
							<h3 className="text-[17px] font-extrabold leading-8 text-[var(--text-primary)]">{current.title}</h3>
							<p className="text-[13.5px] leading-7 text-[var(--text-secondary)]">{current.body}</p>
						</div>

						{current.link ? (
							<a href={current.link.href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 w-fit items-center gap-2.5 rounded-xl bg-[#111] py-1.5 pe-4 ps-3 text-white transition-opacity hover:opacity-90 dark:bg-white dark:text-neutral-900">
								{current.link.store === 'play' ? (
									<svg width="20" height="22" viewBox="0 0 20 22" aria-hidden><path d="M1 1.2 11.2 11 1 20.8c-.4-.2-.6-.6-.6-1.1V2.3c0-.5.2-.9.6-1.1Z" fill="#00d7fe" /><path d="m14.6 7.6-3.4 3.4L1 1.2c.2-.1.5-.2.8-.2.3 0 .6.1.9.2l11.9 6.4Z" fill="#00f076" /><path d="M14.6 14.4 2.7 20.8c-.3.2-.6.2-.9.2-.3 0-.6-.1-.8-.2L11.2 11l3.4 3.4Z" fill="#ff3a44" /><path d="m18.6 12.2-4 2.2-3.4-3.4 3.4-3.4 4 2.2c.5.3.8.7.8 1.2s-.3.9-.8 1.2Z" fill="#ffd400" /></svg>
								) : <Apple className="size-5" aria-hidden />}
								<span className="grid leading-tight">
									<span className="text-[10px] opacity-70">{current.link.store === 'play' ? 'GET IT ON' : 'Download on the'}</span>
									<b className="text-[13.5px]">{current.link.store === 'play' ? 'Google Play' : 'App Store'}</b>
								</span>
								<Download className="ms-1 size-4 opacity-70" aria-hidden />
								<span className="sr-only">{current.link.label}</span>
							</a>
						) : null}

						{current.tips?.length ? (
							<div className="grid gap-2 rounded-2xl border border-amber-200/80 bg-amber-50/60 p-3.5 dark:border-amber-900/50 dark:bg-amber-950/20">
								<p className="flex items-center gap-1.5 text-[12.5px] font-bold text-amber-900 dark:text-amber-200"><Lightbulb className="size-4" aria-hidden />{fa ? 'اگر پیامک نرسید' : 'If messages do not arrive'}</p>
								<ul className="grid gap-1.5">
									{current.tips.map((tip) => <li key={tip} className="flex items-start gap-2 text-[12.5px] leading-6 text-[var(--text-secondary)]"><span aria-hidden className="mt-2.5 size-1 shrink-0 rounded-full bg-amber-600" />{tip}</li>)}
								</ul>
							</div>
						) : null}

						{current.kind === 'condition' && (
							<CopyBox
								label={fa ? 'متن ثابت شرط' : 'The condition’s fixed text'}
								value={keyword}
								copy={fa ? 'کپی متن' : 'Copy text'}
								note={/[يك]/.test(keyword) ? (fa ? 'این متن «ي» عربی دارد؛ تایپش نکنید، کپی کنید.' : 'This text has an Arabic letter; copy it, do not type it.') : null}
								info={fa ? 'پیامک‌هایی که این متن ثابت را دارند برای ویجنت فرستاده می‌شوند؛ بقیهٔ پیامک‌ها روی گوشی می‌مانند.' : 'Messages that carry this fixed text are sent to Vigent; every other message stays on the phone.'}
							/>
						)}

						{current.kind === 'destination' && (destination ? (
							<CopyBox
								label={device.method === 'SMS' ? (fa ? 'شمارهٔ سامانهٔ ویجنت' : 'Vigent’s SMS line') : (fa ? 'نشانی اختصاصی این گوشی' : 'This phone’s own address')}
								value={destination}
								ltr
								copy={device.method === 'SMS' ? (fa ? 'کپی شماره' : 'Copy number') : (fa ? 'کپی نشانی' : 'Copy address')}
								note={device.method === 'URL' ? (fa ? 'این نشانی مثل رمز است؛ آن را برای کسی نفرستید. اگر اپ پیامک را داخل خود لینک می‌گذارد، ?text= را آخرش اضافه کنید.' : 'This address works like a password; do not share it. If your app puts the message inside the link, add ?text= at the end.') : null}
								after={device.method === 'URL' && !inSetup ? <button type="button" disabled={busy !== null} onClick={rotate} className="ui-link inline-flex w-fit items-center gap-1 text-[12.5px]"><RefreshCw className={cn('size-3.5', busy === 'rotate' && 'animate-spin')} aria-hidden />{fa ? 'ساخت نشانی تازه (نشانی قبلی از کار می‌افتد)' : 'New address (the old one stops working)'}</button> : null}
							/>
						) : <p className="text-[13px] text-amber-800">{fa ? 'سامانهٔ پیامکی ویجنت هنوز فعال نشده؛ روش «با اینترنت» را انتخاب کنید.' : 'Vigent’s SMS line is not active yet; use «over the internet».'}</p>)}
					</div>
				</div>
			)}

			<StepFooter
				back={busy === 'edit' || done ? null : back}
				next={next}
				hint={page === lastPage && inSetup ? (fa ? 'قدم بعد، با یک واریز آزمایشی معلوم می‌شود تنظیم درست است یا نه.' : 'The next step’s test transfer shows whether it all works.') : null}
			/>
		</section>
	)
}

function CopyBox({ label, value, copy, ltr, note, info, after }: { label: string; value: string; copy: string; ltr?: boolean; note?: string | null; info?: string | null; after?: ReactNode }) {
	const fa = useLocale() !== 'en'
	return (
		<div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-1.5">
			<span className="text-[12.5px] font-medium text-[var(--text-muted)]">{label}</span>
			<div className="flex min-w-0 items-center gap-2 rounded-control border-[1.5px] border-[#5b3de8]/40 bg-[#f7f5ff] p-2 ps-3.5 dark:bg-[#5b3de8]/10">
				<bdi dir={ltr ? 'ltr' : 'auto'} className={cn('min-w-0 flex-1 font-mono font-bold text-[var(--text-primary)]', ltr ? 'truncate text-[14px]' : 'break-all text-[18px]')}>{value}</bdi>
				<CopyButton value={value} label={copy} copiedLabel={fa ? 'کپی شد' : 'Copied'} showLabel />
			</div>
			{info ? <p className="flex items-start gap-1.5 text-[12.5px] leading-6 text-[var(--text-secondary)]"><MessageSquareText className="mt-1 size-3.5 shrink-0 text-[#5b3de8]" aria-hidden />{info}</p> : null}
			{note ? <p className="flex items-start gap-1.5 text-[12.5px] leading-6 text-[var(--text-muted)]"><AlertTriangle className="mt-1 size-3.5 shrink-0 text-amber-600" aria-hidden />{note}</p> : null}
			{after}
		</div>
	)
}

/**
 * The one real transfer that proves the chain: a 10,000-toman test payment
 * to the owner's own card, shown in rials (the unit bank apps ask for). It
 * turns green when its deposit SMS reaches Vigent through the phone.
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
			const response = await fetch('/api/payments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ test: true }) })
			const data = (await response.json().catch(() => null)) as { card?: CardPayView; error?: string } | null
			if (!response.ok || !data?.card) {
				const copy = ERRORS[data?.error ?? '']
				setTestError(copy ? copy[fa ? 0 : 1] : (fa ? 'تراکنش آزمایشی ساخته نشد.' : 'The test transaction could not be created.'))
				return
			}
			setTest(data.card)
		} catch {
			setTestError(fa ? 'تراکنش آزمایشی ساخته نشد؛ اینترنت را چک کنید.' : 'Not created; check the connection.')
		} finally {
			setBusy(false)
		}
	}

	if (verified) {
		return <p className="flex max-w-2xl items-center gap-2 rounded-control bg-emerald-50 p-3.5 text-[13.5px] font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"><CheckCircle2 className="size-5 shrink-0" aria-hidden />{fa ? 'واریز آزمایشی از روی پیامک گوشی شما تأیید شد؛ اتصال برقرار است.' : 'The test transfer was confirmed from your phone’s SMS; the connection works.'}</p>
	}
	const rows = fa
		? ['یک تراکنش ۱۰٬۰۰۰ تومانی با چند رقم آخرِ مخصوص ساخته می‌شود.', 'از یک کارت دیگر، همان مبلغ را دقیقاً به ریال به کارت خودتان واریز کنید.', 'پیامک واریز که از گوشی برسد، این قدم خودش سبز می‌شود.']
		: ['A 10,000-toman transaction with its own last digits is made.', 'From another card, transfer exactly that many rials to your own card.', 'When the deposit SMS arrives through the phone, this step turns green.']
	return (
		<div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,21rem)] md:items-start">
			<div className="grid content-start gap-4">
				<ol className="grid gap-2.5">
					{rows.map((row, index) => (
						<li key={row} className="flex items-start gap-3 text-[13.5px] leading-7 text-[var(--text-secondary)]">
							<span className={cn('mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-[12px] font-bold', test && index === 0 ? 'bg-emerald-600 text-white' : 'bg-[var(--bg-muted)] text-[var(--text-primary)]')}>
								{test && index === 0 ? <CheckCircle2 className="size-3.5" aria-hidden /> : (index + 1).toLocaleString(fa ? 'fa-IR' : 'en-US')}
							</span>
							{row}
						</li>
					))}
				</ol>
				{test ? (
					<p role="status" className="flex items-center gap-2 rounded-control border border-[var(--border-default)] bg-[var(--bg-surface)] p-3 text-[13px] text-[var(--text-secondary)]">
						<Radio className="size-4 shrink-0 animate-pulse text-[#5b3de8] motion-reduce:animate-none" aria-hidden />
						{fa ? 'منتظر پیامک واریز از گوشی شما…' : 'Waiting for the deposit SMS from your phone…'}
					</p>
				) : (
					<div className="flex flex-wrap items-center gap-3">
						<Button loading={busy} disabled={!hasCard} onClick={startTest}>{fa ? 'ساخت تراکنش آزمایشی' : 'Create the test transaction'}</Button>
						{!hasCard && <span className="text-[13px] text-[var(--text-muted)]">{fa ? 'اول یک کارت اضافه کنید.' : 'Add a card first.'}</span>}
						{testError && <span role="alert" className="text-[13px] text-red-600">{testError}</span>}
					</div>
				)}
			</div>
			{test ? (
				<div className="mx-auto w-full max-w-[21rem]">
					<CardPayCardView card={test} accent="#111111" onAccent="#ffffff" canClaim={false} unit="rial" onStatus={(status) => { if (status === 'PAID') router.refresh() }} />
				</div>
			) : (
				<div aria-hidden className="hidden rounded-3xl border border-dashed border-[var(--border-default)] p-6 text-center text-[12.5px] leading-6 text-[var(--text-hint)] md:grid md:min-h-[14rem] md:place-items-center">
					{fa ? 'کارت و مبلغ دقیق، بعد از ساخت تراکنش این‌جا می‌آید.' : 'The card and the exact amount appear here once the transaction is made.'}
				</div>
			)}
		</div>
	)
}

// ─── The phone, once the gateway is live (settings) ─────────────────────────

/**
 * The SMS phone in the gateway's settings: what it is, what it forwards and
 * when it was last heard from, with «راه‌اندازی مجدد»: the phone is let go
 * and the setup questions open again, filled in with its answers (a new
 * phone, Android or iPhone, a new SIM, the other delivery).
 */
export function PhoneCard({ device, line }: { device: GatewayDeviceRow | null; line: string | null }) {
	const fa = useLocale() !== 'en'
	const router = useRouter()
	const [confirming, setConfirming] = useState(false)
	const [busy, setBusy] = useState(false)

	if (!device) {
		return (
			<section className="spatial-surface flex flex-wrap items-center gap-4 rounded-card p-4 sm:p-5">
				<span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"><Smartphone className="size-6" aria-hidden /></span>
				<div className="min-w-0 flex-1 basis-56">
					<h2 className="text-[15.5px] font-bold text-[var(--text-primary)]">{fa ? 'گوشی دریافت پیامک وصل نیست' : 'No SMS phone is connected'}</h2>
					<p className="mt-0.5 text-[13px] leading-6 text-[var(--text-secondary)]">{fa ? 'تا وصل شدنش، پرداخت‌ها برای تأیید دستی به شما می‌رسند.' : 'Until one is, payments come to you to confirm by hand.'}</p>
				</div>
				<Link href="/payments/devices" className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-[var(--text-primary)] px-4 text-[13.5px] font-bold text-white dark:text-neutral-900">{fa ? 'وصل کردن گوشی' : 'Connect a phone'}<ArrowLeft className="size-4 ltr:rotate-180" aria-hidden /></Link>
			</section>
		)
	}

	const numbers = fa ? 'fa-IR' : 'en-US'
	const state = device.verifiedAt
		? { tone: 'ok' as const, text: fa ? 'وصل و فعال' : 'Connected' }
		: device.connectedAt
			? { tone: 'signal' as const, text: fa ? 'وصل · منتظر واریز آزمایشی' : 'Connected · test pending' }
			: { tone: 'warn' as const, text: fa ? 'هنوز پیامکی نرسیده' : 'No message yet' }
	const facts = [
		{ label: fa ? 'متن ثابت شرط' : 'Filter text', value: <bdi dir="auto" className="font-mono">{device.keyword ?? 'واریز'}</bdi> },
		{ label: device.method === 'SMS' ? (fa ? 'فوروارد به' : 'Forwards to') : (fa ? 'ارسال' : 'Sends'), value: device.method === 'SMS' ? <span dir="ltr" className="font-mono">{line ?? '—'}</span> : (fa ? 'به نشانی اختصاصی' : 'to its own address') },
		{ label: fa ? 'آخرین پیامک' : 'Last message', value: device.lastSmsAt ? new Intl.DateTimeFormat(numbers, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(device.lastSmsAt)) : '—' },
	]

	async function replace() {
		if (!device) return
		setBusy(true)
		try {
			writeDraft({ platform: device.platform, method: device.method, phone: device.phone ?? '', keyword: device.keyword })
			await fetch(`/api/payments/devices/${device.id}`, { method: 'DELETE' })
			router.push('/payments/devices')
			router.refresh()
		} finally {
			setBusy(false)
		}
	}

	return (
		<section className="spatial-surface overflow-hidden rounded-card">
			<div className="flex flex-wrap items-center gap-4 p-4 sm:p-5">
				<span className="relative grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--text-primary)] text-white dark:text-neutral-900">
					{device.platform === 'IOS' ? <Apple className="size-6" aria-hidden /> : <Smartphone className="size-6" aria-hidden />}
					<span aria-hidden className={cn('absolute -end-1 -top-1 size-3.5 rounded-full border-2 border-white dark:border-neutral-900', device.verifiedAt ? 'bg-emerald-500' : 'bg-amber-500')} />
				</span>
				<div className="min-w-0 flex-1 basis-48">
					<div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
						<h2 className="text-[15.5px] font-bold text-[var(--text-primary)]">{fa ? 'گوشی دریافت پیامک' : 'SMS phone'}</h2>
						<StatusChip tone={state.tone} dot>{state.text}</StatusChip>
					</div>
					<p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">
						{platformName(device.platform, fa)} · {methodName(device.method, fa)}
						{device.phone ? <> · <span dir="ltr" className="font-mono">{displayPhone(device.phone)}</span></> : null}
					</p>
				</div>
				<div className="flex w-full flex-wrap gap-2 sm:w-auto">
					<Link href="/payments/devices" className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-full border border-[var(--border-default)] px-4 text-[13px] font-medium text-[var(--text-primary)] hover:border-[var(--border-hover)] sm:flex-none"><BookOpen className="size-4" aria-hidden />{fa ? 'راهنمای تنظیم' : 'Setup guide'}</Link>
					<button type="button" aria-expanded={confirming} onClick={() => setConfirming(!confirming)} className={cn('inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-full px-4 text-[13px] font-bold sm:flex-none', confirming ? 'bg-[var(--bg-muted)] text-[var(--text-primary)]' : 'bg-[var(--text-primary)] text-white dark:text-neutral-900')}><RotateCcw className="size-4" aria-hidden />{fa ? 'راه‌اندازی دوباره' : 'Set up again'}</button>
				</div>
			</div>
			<dl className="grid grid-cols-1 border-t border-[var(--border-subtle)] sm:grid-cols-3 sm:divide-x sm:divide-[var(--border-subtle)] sm:rtl:divide-x-reverse">
				{facts.map((fact) => (
					<div key={fact.label} className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-4 py-3 last:border-b-0 sm:block sm:border-b-0 sm:px-5">
						<dt className="text-[12px] text-[var(--text-muted)]">{fact.label}</dt>
						<dd className="truncate text-[13.5px] font-semibold text-[var(--text-primary)] sm:mt-0.5">{fact.value}</dd>
					</div>
				))}
			</dl>
			{confirming && (
				<div className="grid gap-3 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 sm:p-5">
					<div>
						<p className="text-[14px] font-bold text-[var(--text-primary)]">{fa ? 'راه‌اندازی دوبارهٔ گوشی دریافت پیامک' : 'Set up the SMS phone again'}</p>
						<p className="mt-1 text-[12.5px] leading-6 text-[var(--text-muted)]">{fa ? 'برای گوشی تازه (اندروید یا آیفون)، سیم‌کارت تازه یا روش ارسال دیگر. همان سؤال‌ها با پاسخ‌های فعلی باز می‌شود و با یک واریز آزمایشی تمام می‌شود؛ تا آن موقع پرداخت‌ها برای تأیید دستی به شما می‌رسند.' : 'For a new phone (Android or iPhone), a new SIM or the other delivery. The same questions open with the current answers and finish with one test transfer; until then payments come to you to confirm by hand.'}</p>
					</div>
					<div className="flex flex-wrap gap-2">
						<Button loading={busy} onClick={replace}><RotateCcw className="size-4" aria-hidden />{fa ? 'شروع دوبارهٔ راه‌اندازی' : 'Start again'}</Button>
						<Button variant="ghost" onClick={() => setConfirming(false)}>{fa ? 'انصراف' : 'Cancel'}</Button>
					</div>
				</div>
			)}
		</section>
	)
}
