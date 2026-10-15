'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Check, Pause, Play } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SetupPlayerProps {
	platform: 'ANDROID' | 'IOS'
	method: 'SMS' | 'URL'
	/** The platform SMS line the phone forwards to (SMS method). */
	line: string | null
	/** The phone's own address (URL method). Shortened on the small screen. */
	url: string | null
	/** The fixed word of the bank's deposit SMS. */
	keyword: string
	lang?: 'fa' | 'en'
	className?: string
}

const STEP_MS = 4600

function Cell({ label, value, on, rtl }: { label: string; value: ReactNode; on?: boolean; rtl?: boolean }) {
	return (
		<div className={cn('relative flex items-center justify-between gap-2 rounded-xl border bg-white px-2.5 py-2', on ? 'border-[#5b3de8] shadow-[0_0_0_3px_rgba(91,61,232,.16)]' : 'border-[#e6e6ea]')}>
			<span className="min-w-0">
				<span className="block text-[10px] leading-4 text-[#777]">{label}</span>
				<span dir={rtl ? 'rtl' : 'ltr'} className="block break-all text-[11.5px] font-semibold leading-5 text-[#111]">{value}</span>
			</span>
			{on && <span aria-hidden className="absolute -end-1 -top-1 size-3 rounded-full bg-[#5b3de8]"><span className="absolute inset-0 animate-ping rounded-full bg-[#5b3de8] opacity-60 motion-reduce:animate-none" /></span>}
		</div>
	)
}

function Toggle() {
	return <span aria-hidden className="relative h-[18px] w-[30px] shrink-0 rounded-full bg-[#34c759]"><span className="absolute end-0.5 top-0.5 size-3.5 rounded-full bg-white" /></span>
}

/**
 * The phone-side setup as a short loop: what to tap on the owner's own phone,
 * one screen per step. Shared by the dashboard guide and the public pages.
 * Plays only while on screen; with reduced motion it waits for a tap.
 */
export function SetupPlayer({ platform, method, line, url, keyword, lang = 'fa', className }: SetupPlayerProps) {
	const fa = lang !== 'en'
	const shortUrl = url ? url.replace(/^https?:\/\//, '').replace(/(dv_.{4}).+(.{4})$/, '$1…$2') : 'vigent.ir/api/pay/sms/…'
	const target = method === 'SMS' ? (line ?? '3000…') : shortUrl

	const steps = useMemo(() => {
		const done = {
			title: fa ? 'یک واریز آزمایشی' : 'One test transfer',
			body: fa ? 'مبلغ کوچکی که ویجنت می‌گوید را به کارت خودتان واریز کنید. پیامکش که برسد، درگاه آماده است.' : 'Transfer the small amount Vigent shows to your own card. When its SMS arrives the gateway is ready.',
			screen: (
				<>
					<p className="text-[13px] font-bold">Messages</p>
					<div dir="rtl" className="w-fit max-w-[92%] whitespace-pre-line rounded-[14px_14px_4px_14px] bg-[#e9e9ee] px-2.5 py-2 text-[11.5px] leading-5">{`${keyword} 13,470\nمانده •••`}</div>
					<div className="m-auto grid justify-items-center gap-1.5 text-center">
						<span className="grid size-14 place-items-center rounded-full bg-[#dcfce7] text-[#15803d]"><Check className="size-7" strokeWidth={2.6} aria-hidden /></span>
						<b className="text-[12.5px]">{method === 'SMS' ? 'Forwarded' : '200 OK'}</b>
						<span className="text-[10.5px] text-[#777]">matched · gateway ready</span>
					</div>
				</>
			),
		}
		if (platform === 'ANDROID') {
			return [
				{
					title: fa ? 'اپ فوروارد پیامک را نصب کنید' : 'Install an SMS forwarder app',
					body: method === 'SMS'
						? (fa ? 'هر اپی که پیامک را خودکار به یک شماره فوروارد کند کافی است.' : 'Any app that forwards an SMS to a number automatically will do.')
						: (fa ? 'هر اپی که پیامک را به یک نشانی اینترنتی بفرستد کافی است؛ مثلاً SMS to URL Forwarder.' : 'Any app that sends an SMS to a web address will do, e.g. SMS to URL Forwarder.'),
					screen: (
						<>
							<p className="text-[13px] font-bold">Install</p>
							<Cell label="Open source" value={method === 'SMS' ? 'SMS Forwarder' : 'SMS to URL Forwarder'} on />
							<Cell label="Rules · SMS / URL" value="SmsForwarder" />
							<Cell label="SMS trigger → action" value="MacroDroid · Tasker" />
							<span className="mt-auto rounded-xl bg-[#5b3de8] py-2 text-center text-[12px] font-bold text-white">Install</span>
						</>
					),
				},
				{
					title: fa ? 'دسترسی پیامک و باتری' : 'SMS and battery permissions',
					body: fa ? 'اجازهٔ خواندن پیامک بدهید و بهینه‌سازی باتری را برای این اپ خاموش کنید تا اندروید آن را نبندد.' : 'Allow reading SMS and turn battery optimisation off for this app so Android does not stop it.',
					screen: (
						<>
							<p className="text-[13px] font-bold">Permissions</p>
							<div className="flex items-center justify-between rounded-xl border border-[#e6e6ea] bg-white px-2.5 py-2 text-[11.5px] font-semibold">Read SMS<Toggle /></div>
							<div className="flex items-center justify-between rounded-xl border border-[#5b3de8] bg-white px-2.5 py-2 text-[11.5px] font-semibold shadow-[0_0_0_3px_rgba(91,61,232,.16)]">Don’t optimise battery<Toggle /></div>
							<div className="flex items-center justify-between rounded-xl border border-[#e6e6ea] bg-white px-2.5 py-2 text-[11.5px] font-semibold">Autostart<Toggle /></div>
						</>
					),
				},
				{
					title: fa ? `شرط: متن پیام شامل «${keyword}»` : `Condition: text contains “${keyword}”`,
					body: fa ? 'این کلمه در همهٔ پیامک‌های واریز بانک شما ثابت است. با این شرط فقط پیامک واریز فرستاده می‌شود؛ رمز پویا و پیام‌های شخصی هرگز از گوشی بیرون نمی‌روند.' : 'This word is in every deposit SMS of your bank. With it only deposit messages are sent; one-time passwords and personal texts never leave the phone.',
					screen: (
						<>
							<p className="text-[13px] font-bold">New rule</p>
							<Cell label="Sender" value="Any" />
							<Cell label="Text contains" value={keyword} rtl on />
							<Cell label="SIM" value="Any" />
						</>
					),
				},
				{
					title: method === 'SMS' ? (fa ? 'مقصد: شمارهٔ سامانهٔ ویجنت' : 'Destination: Vigent’s SMS line') : (fa ? 'مقصد: نشانی اختصاصی شما' : 'Destination: your own address'),
					body: method === 'SMS'
						? (fa ? 'شمارهٔ سامانه را به‌عنوان گیرنده وارد و قانون را روشن کنید. ویجنت پیامک را از روی شمارهٔ همین گوشی می‌شناسد.' : 'Enter the line as the recipient and switch the rule on. Vigent recognises the SMS by this phone’s number.')
						: (fa ? 'نشانی را از همین صفحه کپی و در اپ بچسبانید. قالب پیش‌فرض اپ را دست نزنید.' : 'Copy the address from this page and paste it in the app. Leave the app’s default template as it is.'),
					screen: (
						<>
							<p className="text-[13px] font-bold">{method === 'SMS' ? 'Forward to' : 'Webhook'}</p>
							<Cell label={method === 'SMS' ? 'Phone number' : 'URL · POST'} value={target} on />
							{method === 'URL' && <Cell label="Body (JSON)" value={'{"from":"%from%","text":"%text%"}'} />}
							<div className="flex items-center justify-between rounded-xl border border-[#e6e6ea] bg-white px-2.5 py-2 text-[11.5px] font-semibold">Rule enabled<Toggle /></div>
							<span className="mt-auto rounded-xl bg-[#111] py-2 text-center text-[12px] font-bold text-white">Save</span>
						</>
					),
				},
				done,
			]
		}
		return [
			{
				title: fa ? 'اتوماسیون تازه در Shortcuts' : 'A new automation in Shortcuts',
				body: fa ? 'اپ Shortcuts را باز کنید: زبانهٔ Automation، علامت +، و رویداد Message.' : 'Open Shortcuts: the Automation tab, +, then the Message trigger.',
				screen: (
					<>
						<p className="text-[13px] font-bold">New Automation</p>
						<Cell label="Personal" value="Time of Day" />
						<Cell label="When I get a message" value="Message" on />
						<Cell label="Personal" value="Email" />
					</>
				),
			},
			{
				title: fa ? `شرط: Message Contains «${keyword}»` : `Condition: Message Contains “${keyword}”`,
				body: fa ? 'این کلمه در همهٔ پیامک‌های واریز بانک شما ثابت است. Run Immediately را انتخاب کنید تا بدون پرسیدن اجرا شود.' : 'This word is in every deposit SMS of your bank. Choose Run Immediately so it runs without asking.',
				screen: (
					<>
						<p className="text-[13px] font-bold">When</p>
						<Cell label="Sender" value="Any" />
						<Cell label="Message Contains" value={keyword} rtl on />
						<div className="flex items-center justify-between rounded-xl border border-[#e6e6ea] bg-white px-2.5 py-2 text-[11.5px] font-semibold">Run Immediately<Toggle /></div>
					</>
				),
			},
			{
				title: method === 'SMS' ? (fa ? 'کار: Send Message به سامانهٔ ویجنت' : 'Action: Send Message to Vigent’s line') : (fa ? 'کار: Get Contents of URL' : 'Action: Get Contents of URL'),
				body: method === 'SMS'
					? (fa ? 'گیرنده را شمارهٔ سامانه بگذارید و متن را روی Shortcut Input (همان پیامک بانک).' : 'Set the recipient to the line and the text to Shortcut Input (the bank’s message).')
					: (fa ? 'نشانی خودتان را بچسبانید، Method را POST کنید و در Request Body فیلد text را روی Shortcut Input بگذارید.' : 'Paste your address, set Method to POST and add a text field with Shortcut Input in Request Body.'),
				screen: (
					<>
						<p className="text-[13px] font-bold">{method === 'SMS' ? 'Send Message' : 'Get Contents of URL'}</p>
						<Cell label={method === 'SMS' ? 'Recipient' : 'URL'} value={target} on />
						<Cell label={method === 'SMS' ? 'Message' : 'Request Body · JSON'} value={method === 'SMS' ? 'Shortcut Input' : 'text = Shortcut Input'} />
						{method === 'URL' && <Cell label="Method" value="POST" />}
					</>
				),
			},
			{
				title: fa ? 'ذخیره' : 'Save',
				body: fa ? 'Done را بزنید. از این به بعد هر پیامک واریز بدون باز شدن چیزی روی صفحه فرستاده می‌شود.' : 'Tap Done. From now on every deposit SMS is sent without anything opening on screen.',
				screen: (
					<>
						<p className="text-[13px] font-bold">Automation</p>
						<div className="flex items-center justify-between rounded-xl border border-[#e6e6ea] bg-white px-2.5 py-2 text-[11.5px] font-semibold"><span>When message contains <span dir="rtl">{keyword}</span></span><Toggle /></div>
						<Cell label="Do" value={method === 'SMS' ? 'Send Message' : 'Get Contents of URL'} />
						<span className="mt-auto rounded-xl bg-[#5b3de8] py-2 text-center text-[12px] font-bold text-white">Done</span>
					</>
				),
			},
			done,
		]
	}, [platform, method, keyword, target, fa])

	const [step, setStep] = useState(0)
	const [playing, setPlaying] = useState(true)
	const [visible, setVisible] = useState(false)
	const root = useRef<HTMLDivElement>(null)

	useEffect(() => setStep(0), [platform, method])
	useEffect(() => {
		const node = root.current
		if (!node || !('IntersectionObserver' in window)) return
		const observer = new IntersectionObserver((entries) => setVisible(entries[0].isIntersecting), { threshold: 0.25 })
		observer.observe(node)
		return () => observer.disconnect()
	}, [])
	const running = playing && visible
	useEffect(() => {
		if (!running || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
		const timer = window.setInterval(() => setStep((current) => (current + 1) % steps.length), STEP_MS)
		return () => window.clearInterval(timer)
	}, [running, steps.length])

	return (
		<div ref={root} dir={fa ? 'rtl' : 'ltr'} className={cn('grid gap-5 sm:grid-cols-[13.5rem_minmax(0,1fr)] sm:items-center', className)}>
			<div aria-hidden className="relative mx-auto aspect-[268/520] w-[13.5rem] max-w-full rounded-[2.4rem] bg-[#0f0f10] p-2.5 shadow-[0_36px_60px_-38px_rgba(0,0,0,.6)]">
				<span className="absolute left-1/2 top-[1.05rem] z-10 h-[1.1rem] w-[4.2rem] -translate-x-1/2 rounded-full bg-[#0f0f10]" />
				<div dir="ltr" className="relative size-full overflow-hidden rounded-[1.85rem] bg-[#f4f4f6] text-[#111]">
					{steps.map((item, index) => (
						<div key={index} className={cn('absolute inset-0 flex flex-col gap-2 px-3 pb-3.5 pt-11 transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none', index === step ? 'translate-x-0 opacity-100' : 'pointer-events-none -translate-x-4 opacity-0')}>
							{item.screen}
						</div>
					))}
				</div>
			</div>
			<div className="min-w-0">
				<ol className="grid gap-1">
					{steps.map((item, index) => (
						<li key={index}>
							<button
								type="button"
								onClick={() => { setStep(index); setPlaying(false) }}
								aria-current={index === step ? 'step' : undefined}
								className={cn('relative grid w-full grid-cols-[1.9rem_minmax(0,1fr)] items-start gap-2.5 overflow-hidden rounded-control border p-2.5 text-start transition-colors', index === step ? 'border-[var(--border-default)] bg-white shadow-[var(--elev-1)]' : 'border-transparent hover:bg-[var(--bg-hover)]')}
							>
								<span className={cn('grid size-[1.9rem] place-items-center rounded-full text-[13px] font-bold', index === step ? 'bg-[#5b3de8] text-white' : index < step ? 'bg-emerald-100 text-emerald-700' : 'bg-[var(--bg-muted)] text-[var(--text-secondary)]')}>
									{index < step ? <Check className="size-3.5" aria-hidden /> : (index + 1).toLocaleString(fa ? 'fa-IR' : 'en-US')}
								</span>
								<span className="min-w-0">
									<span className="block text-[14px] font-bold leading-7 text-[var(--text-primary)]">{item.title}</span>
									{index === step && <span className="block text-[13px] leading-6 text-[var(--text-secondary)]">{item.body}</span>}
								</span>
								{index === step && running && <span key={`${step}-bar`} aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 origin-[right] bg-[#5b3de8] motion-reduce:hidden ltr:origin-[left]" style={{ animation: `setup-fill ${STEP_MS}ms linear both` }} />}
							</button>
						</li>
					))}
				</ol>
				<button type="button" onClick={() => setPlaying((value) => !value)} className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-[12.5px] text-[var(--text-muted)] hover:bg-[var(--bg-hover)]">
					{playing ? <Pause className="size-3.5" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
					{playing ? (fa ? 'توقف' : 'Pause') : (fa ? 'پخش' : 'Play')}
				</button>
			</div>
			<style>{'@keyframes setup-fill{from{transform:scaleX(0)}to{transform:scaleX(1)}}'}</style>
		</div>
	)
}
