'use client'

import { useMemo, type ReactNode } from 'react'
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

export type SetupStepKind = 'install' | 'permissions' | 'condition' | 'destination' | 'save'

export interface SetupStep {
	kind: SetupStepKind
	title: string
	body: string
	screen: ReactNode
}

/**
 * The phone-side setup, one screen per step: what to tap on the owner's own
 * phone (Android forwarder app or iPhone Shortcuts, by SMS or by URL), with
 * the filter word and the destination filled in.
 */
export function useSetupSteps({ platform, method, line, url, keyword, lang = 'fa' }: Omit<SetupPlayerProps, 'className'>): SetupStep[] {
	const fa = lang !== 'en'
	const shortUrl = url ? url.replace(/^https?:\/\//, '').replace(/(dv_.{4}).+(.{4})$/, '$1…$2') : 'vigent.ir/api/pay/sms/…'
	const target = method === 'SMS' ? (line ?? '3000…') : shortUrl

	return useMemo<SetupStep[]>(() => {
		if (platform === 'ANDROID') {
			return [
				{
					kind: 'install' as const,
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
					kind: 'permissions' as const,
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
					kind: 'condition' as const,
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
					kind: 'destination' as const,
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
			]
		}
		return [
			{
				kind: 'install' as const,
				title: fa ? 'یک اتوماسیون تازه بسازید' : 'Make a new automation',
				body: fa ? 'اپ Shortcuts (میان‌برها) را باز کنید، زبانهٔ Automation و بعد علامت + را بزنید و رویداد Message را انتخاب کنید.' : 'Open the Shortcuts app, tap the Automation tab, then +, and pick the Message trigger.',
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
				kind: 'condition' as const,
				title: fa ? 'شرط: پیامک‌هایی که این متن را دارند' : 'Condition: messages with this text',
				body: fa ? 'در بخش Message Contains متن ثابت زیر را دقیقاً بچسبانید و Run Immediately را روشن کنید تا بدون پرسیدن اجرا شود. فقط پیامک‌هایی که این متن را دارند برای ویجنت فرستاده می‌شوند.' : 'Paste the fixed text below into Message Contains and turn on Run Immediately so it runs without asking. Only messages with this text are sent to Vigent.',
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
				kind: 'destination' as const,
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
				kind: 'save' as const,
				title: fa ? 'ذخیره و تمام' : 'Save and done',
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
		]
	}, [platform, method, keyword, target, fa])
}

/** The phone mock showing one step's screen; the other screens slide out. */
export function PhoneMock({ steps, step, className }: { steps: SetupStep[]; step: number; className?: string }) {
	return (
		<div aria-hidden className={cn('relative mx-auto aspect-[268/520] w-[12.5rem] max-w-full rounded-[2.3rem] bg-[#0f0f10] p-2.5 shadow-[0_30px_50px_-34px_rgba(0,0,0,.6)]', className)}>
			<span className="absolute left-1/2 top-[1.05rem] z-10 h-[1.1rem] w-[4.2rem] -translate-x-1/2 rounded-full bg-[#0f0f10]" />
			<div dir="ltr" className="relative size-full overflow-hidden rounded-[1.8rem] bg-[#f4f4f6] text-[#111]">
				{steps.map((item, index) => (
					<div key={index} className={cn('absolute inset-0 flex flex-col gap-2 px-3 pb-3.5 pt-11 transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none', index === step ? 'translate-x-0 opacity-100' : index < step ? 'pointer-events-none -translate-x-4 opacity-0' : 'pointer-events-none translate-x-4 opacity-0')}>
						{item.screen}
					</div>
				))}
			</div>
		</div>
	)
}
