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
	/** The fixed text of the bank's deposit SMS. */
	keyword: string
	lang?: 'fa' | 'en'
	className?: string
}

export type SetupStepKind = 'install' | 'permissions' | 'condition' | 'destination' | 'save'

export interface SetupStep {
	kind: SetupStepKind
	title: string
	body: string
	screen: ReactNode
	/** Where to get the app. */
	link?: { label: string; href: string; store: 'play' | 'appstore' }
	/** What trips people up on this step (phone makers, OS versions). */
	tips?: string[]
}

/** The one Android app the guide is written for: on Google Play, filters on the message text, sends to a number or a URL. */
export const ANDROID_APP = {
	name: 'SMS Forwarder',
	developer: 'frzinapps',
	play: 'https://play.google.com/store/apps/details?id=com.frzinapps.smsforward',
}
export const SHORTCUTS_APP_STORE = 'https://apps.apple.com/app/shortcuts/id915249334'

// ─── iOS pieces (Shortcuts) ─────────────────────────────────────────────────

const IOS_BLUE = '#007aff'

function IosStatus() {
	return (
		<div className="flex h-7 shrink-0 items-end justify-between px-5 pb-1 text-[10px] font-semibold">
			<span>9:41</span>
			<span className="flex items-center gap-1">
				<svg width="14" height="9" viewBox="0 0 14 9" aria-hidden><rect x="0" y="6" width="2.5" height="3" rx=".6" fill="currentColor" /><rect x="3.8" y="4" width="2.5" height="5" rx=".6" fill="currentColor" /><rect x="7.6" y="2" width="2.5" height="7" rx=".6" fill="currentColor" /><rect x="11.4" y="0" width="2.5" height="9" rx=".6" fill="currentColor" /></svg>
				<svg width="18" height="9" viewBox="0 0 18 9" aria-hidden><rect x=".5" y=".5" width="15" height="8" rx="2.4" fill="none" stroke="currentColor" opacity=".45" /><rect x="2" y="2" width="11" height="5" rx="1.3" fill="currentColor" /><rect x="16.3" y="3" width="1.2" height="3" rx=".5" fill="currentColor" opacity=".45" /></svg>
			</span>
		</div>
	)
}

function IosNav({ back, title, action }: { back?: string; title: string; action?: string }) {
	return (
		<div className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center px-2.5 py-1.5 text-[10.5px]">
			<span className="truncate" style={{ color: IOS_BLUE }}>{back ? `‹ ${back}` : ''}</span>
			<b className="truncate text-[11px]">{title}</b>
			<span className="truncate text-end font-semibold" style={{ color: IOS_BLUE }}>{action ?? ''}</span>
		</div>
	)
}

function IosGroup({ children, header }: { children: ReactNode; header?: string }) {
	return (
		<div className="grid gap-1">
			{header ? <span className="px-3 text-[8.5px] uppercase tracking-wide text-[#8e8e93]">{header}</span> : null}
			<div className="mx-2 divide-y divide-[#e5e5ea] overflow-hidden rounded-[10px] bg-white">{children}</div>
		</div>
	)
}

function IosRow({ label, value, icon, on, check, toggle, chevron }: { label: ReactNode; value?: ReactNode; icon?: ReactNode; on?: boolean; check?: boolean; toggle?: boolean | null; chevron?: boolean }) {
	return (
		<div className={cn('relative flex min-h-[26px] items-center gap-2 px-2.5 py-1.5 text-[10px]', on && 'bg-[#e8f1ff]')}>
			{icon}
			<span className={cn('truncate', value != null ? 'shrink-0' : 'min-w-0 flex-1')}>{label}</span>
			{value != null ? <span dir="auto" className="min-w-0 flex-1 truncate text-end text-[#8e8e93]">{value}</span> : null}
			{check ? <span className="text-[11px] font-bold" style={{ color: IOS_BLUE }}>✓</span> : null}
			{toggle != null ? <IosToggle on={toggle} /> : null}
			{chevron ? <span className="text-[#c7c7cc]">›</span> : null}
			{on ? <Tap /> : null}
		</div>
	)
}

function IosToggle({ on }: { on: boolean }) {
	return <span aria-hidden className={cn('relative h-[15px] w-[25px] shrink-0 rounded-full', on ? 'bg-[#34c759]' : 'bg-[#e9e9ea]')}><span className={cn('absolute top-[1.5px] size-3 rounded-full bg-white shadow', on ? 'end-[1.5px]' : 'start-[1.5px]')} /></span>
}

function IosIcon({ color, children }: { color: string; children: ReactNode }) {
	return <span className="grid size-[17px] shrink-0 place-items-center rounded-[5px] text-[9px] text-white" style={{ background: color }}>{children}</span>
}

/** A token inside a Shortcuts action, like «Shortcut Input» or a number. */
function Token({ children, on }: { children: ReactNode; on?: boolean }) {
	return <span className={cn('inline-block max-w-full truncate rounded-[5px] px-1 align-middle font-semibold', on ? 'bg-[#007aff] text-white' : 'bg-[#e8f1ff] text-[#007aff]')}>{children}</span>
}

// ─── Android pieces (Material, SMS Forwarder) ───────────────────────────────

const M3 = { primary: '#3d5afe', container: '#e3e7ff', outline: '#79747e', surface: '#fdfbff' }

function AndroidStatus() {
	return (
		<div className="flex h-6 shrink-0 items-center justify-between px-4 text-[9.5px] font-medium text-[#1d1b20]">
			<span>12:30</span>
			<span className="flex items-center gap-1">
				<svg width="11" height="9" viewBox="0 0 11 9" aria-hidden><path d="M5.5 9 0 2.2C1.5.9 3.4 0 5.5 0S9.5.9 11 2.2Z" fill="currentColor" /></svg>
				<svg width="9" height="9" viewBox="0 0 9 9" aria-hidden><path d="M0 9h9V0Z" fill="currentColor" /></svg>
				<svg width="6" height="10" viewBox="0 0 6 10" aria-hidden><rect x=".5" y="1" width="5" height="8.5" rx="1" fill="currentColor" /><rect x="1.8" y="0" width="2.4" height="1.2" rx=".4" fill="currentColor" /></svg>
			</span>
		</div>
	)
}

function AppBar({ title, back = true, action }: { title: string; back?: boolean; action?: ReactNode }) {
	return (
		<div className="flex h-8 shrink-0 items-center gap-2 px-2.5 text-[#1d1b20]">
			{back ? <span className="text-[13px] leading-none">←</span> : null}
			<b className="min-w-0 flex-1 truncate text-[12px] font-medium">{title}</b>
			{action}
		</div>
	)
}

/** A Material outlined text field with its label in the notch. */
function Field({ label, value, on, rtl }: { label: string; value: ReactNode; on?: boolean; rtl?: boolean }) {
	return (
		<div className={cn('relative mx-2.5 rounded-[5px] border px-2 pb-1.5 pt-2', on ? 'border-2' : 'border-[#79747e]')} style={on ? { borderColor: M3.primary } : undefined}>
			<span className="absolute -top-[6px] start-1.5 bg-[#fdfbff] px-1 text-[7.5px]" style={{ color: on ? M3.primary : M3.outline }}>{label}</span>
			<span dir={rtl ? 'rtl' : 'ltr'} className="block truncate text-[10px] text-[#1d1b20]">{value}</span>
			{on ? <Tap /> : null}
		</div>
	)
}

function Chip({ children, selected }: { children: ReactNode; selected?: boolean }) {
	return <span className={cn('rounded-[6px] border px-1.5 py-[3px] text-[8.5px] font-medium', selected ? 'border-transparent text-[#1d1b20]' : 'border-[#79747e] text-[#49454f]')} style={selected ? { background: M3.container } : undefined}>{selected ? '✓ ' : ''}{children}</span>
}

function M3Switch({ on = true }: { on?: boolean }) {
	return <span aria-hidden className="relative h-[14px] w-[24px] shrink-0 rounded-full" style={{ background: on ? M3.primary : '#e6e0e9' }}><span className={cn('absolute top-[2px] size-[10px] rounded-full', on ? 'end-[2px] bg-white' : 'start-[2px] bg-[#79747e]')} /></span>
}

function AndroidAppIcon({ size = 22 }: { size?: number }) {
	return (
		<span className="grid shrink-0 place-items-center rounded-[28%] text-white" style={{ width: size, height: size, background: 'linear-gradient(135deg,#536dfe,#3d5afe 55%,#304ffe)' }}>
			<svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" aria-hidden><path fill="currentColor" d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2Zm9 3v3H7v2h6v3l4-4-4-4Z" /></svg>
		</span>
	)
}

/** The pulsing mark on what to tap. */
function Tap() {
	return <span aria-hidden className="absolute -end-1 -top-1 size-2.5 rounded-full bg-[#5b3de8]"><span className="absolute inset-0 animate-ping rounded-full bg-[#5b3de8] opacity-60 motion-reduce:animate-none" /></span>
}

/**
 * The phone-side setup, one screen per step, drawn after the real apps:
 * SMS Forwarder (Google Play) on Android, Apple's Shortcuts on iPhone, each
 * for forwarding by SMS or by URL, with the filter text and the destination
 * filled in.
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
					title: fa ? 'اپ SMS Forwarder را از Google Play نصب کنید' : 'Install SMS Forwarder from Google Play',
					body: fa
						? 'این اپ پیامک را بر اساس متنش جدا می‌کند و هم به یک شماره (پیامکی) و هم به یک نشانی اینترنتی می‌فرستد؛ راهنمای این صفحه برای همین اپ است.'
						: 'It picks messages by their text and forwards them to a number (as SMS) or to a web address; this guide is written for it.',
					link: { label: fa ? 'دانلود از Google Play' : 'Get it on Google Play', href: ANDROID_APP.play, store: 'play' },
					tips: fa
						? ['از Google Play نصب کنید، نه فایل APK. در اندروید ۱۳ و بالاتر، اپی که از بیرون نصب شده اجازهٔ پیامک نمی‌گیرد؛ اگر APK نصب کرده‌اید: اطلاعات برنامه ← منوی ⋮ ← «اجازه دادن به تنظیمات محدودشده».', 'اپ را یک بار باز کنید تا اندروید آن را فعال بشناسد؛ اپی که هیچ‌وقت باز نشده پیامک دریافت نمی‌کند.']
						: ['Install from Google Play, not an APK. On Android 13+ an app installed from elsewhere cannot get the SMS permission; if you used an APK: App info → ⋮ → «Allow restricted settings».', 'Open the app once so Android treats it as active; an app that was never opened receives no SMS.'],
					screen: (
						<>
							<AndroidStatus />
							<div className="flex items-center gap-2 px-2.5 pt-1 text-[#1d1b20]"><span className="text-[13px]">←</span><span className="ms-auto text-[11px]">⌕ ⋮</span></div>
							<div className="flex items-start gap-2 px-2.5 pt-2">
								<AndroidAppIcon size={34} />
								<div className="min-w-0">
									<b className="block text-[11px] font-medium leading-4 text-[#1d1b20]">SMS Forwarder - Auto forward SMS to PC or Phone</b>
									<span className="block text-[9px] font-medium text-[#01875f]">frzinapps</span>
									<span className="block text-[8px] text-[#5f6368]">Contains ads</span>
								</div>
							</div>
							<div className="mx-2.5 mt-2 grid grid-cols-3 divide-x divide-[#e0e0e0] text-center text-[8px] text-[#5f6368]">
								<span><b className="block text-[9.5px] text-[#1d1b20]">4.4★</b>reviews</span>
								<span><b className="block text-[9.5px] text-[#1d1b20]">1M+</b>Downloads</span>
								<span><b className="block text-[9.5px] text-[#1d1b20]">E</b>Everyone</span>
							</div>
							<span className="relative mx-2.5 mt-2.5 rounded-full bg-[#01875f] py-1.5 text-center text-[10.5px] font-medium text-white">Install<Tap /></span>
							<div className="mx-2.5 mt-2 grid grid-cols-3 gap-1">
								{['Filters', 'To phone', 'To URL'].map((label) => <span key={label} className="grid h-12 place-items-end rounded-md bg-gradient-to-b from-[#e8eaff] to-[#c5cae9] p-1 text-[7px] font-medium text-[#283593]">{label}</span>)}
							</div>
						</>
					),
				},
				{
					kind: 'permissions' as const,
					title: fa ? 'اجازهٔ پیامک و کار در پس‌زمینه' : 'SMS permission and background',
					body: fa
						? 'وقتی اپ اجازهٔ پیامک خواست «اجازه دادن» را بزنید. بعد در اطلاعات برنامه، باتری را روی «بدون محدودیت» بگذارید تا گوشی اپ را نبندد.'
						: 'Tap «Allow» when the app asks for SMS. Then in App info set Battery to «Unrestricted» so the phone never stops it.',
					tips: fa
						? [
							'شیائومی، ردمی و پوکو: «شروع خودکار» (Autostart) را روشن کنید، باتری را «بدون محدودیت» بگذارید و در «سایر مجوزها» هر مجوزی که به پیامک مربوط است را اجازه بدهید؛ وگرنه پیامک‌های خدماتی بانک به اپ نمی‌رسد.',
							'سامسونگ: باتری ← «بدون محدودیت»، و اپ را از فهرست «برنامه‌های در خواب» بیرون بیاورید.',
							...(method === 'SMS'
								? ['اگر اندروید گفت «این برنامه پیامک زیادی می‌فرستد»، «همیشه اجازه بده» را بزنید.', 'گوشی دو سیم‌کارته: در تنظیمات اپ، سیم‌کارتی را برای فرستادن انتخاب کنید که شارژ پیامک دارد.']
								: ['اینترنت گوشی (داده یا وای‌فای) باید روشن بماند؛ «صرفه‌جویی داده» را برای این اپ خاموش کنید.']),
						]
						: [
							'Xiaomi, Redmi, Poco: turn Autostart on, set Battery to «No restrictions» and allow every SMS-related item under «Other permissions», or the bank’s service messages never reach the app.',
							'Samsung: Battery → «Unrestricted», and take the app off «Sleeping apps».',
							...(method === 'SMS'
								? ['If Android warns that the app is sending many messages, choose «Always allow».', 'Dual SIM: in the app’s settings pick the SIM that has SMS credit.']
								: ['Keep mobile data or Wi-Fi on, and turn Data Saver off for this app.']),
						],
					screen: (
						<>
							<AndroidStatus />
							<AppBar title="SMS Forwarder" back={false} />
							<div className="mx-2.5 h-5 rounded-md bg-[#f3edf7]" />
							<div className="mx-2.5 mt-1.5 h-5 rounded-md bg-[#f3edf7]" />
							<div className="absolute inset-0 flex items-center bg-black/35 px-3 pt-10">
								<div className="w-full rounded-[18px] bg-[#f3edf7] p-3 text-center text-[#1d1b20]">
									<span className="mx-auto mb-1.5 grid size-5 place-items-center rounded-full text-[10px]" style={{ background: M3.container, color: M3.primary }}>✉</span>
									<p className="text-[9.5px] leading-[13px]">Allow <b>SMS Forwarder</b> to send and view SMS messages?</p>
									<span className="relative mt-2.5 block rounded-full py-1.5 text-[9.5px] font-medium text-white" style={{ background: M3.primary }}>Allow<Tap /></span>
									<span className="mt-1 block py-1 text-[9.5px] font-medium" style={{ color: M3.primary }}>Don’t allow</span>
								</div>
							</div>
						</>
					),
				},
				{
					kind: 'condition' as const,
					title: fa ? 'یک فیلتر تازه با شرط متن پیام' : 'A new filter on the message text',
					body: fa
						? 'در اپ دکمهٔ + (افزودن فیلتر) را بزنید و در بخش شرط‌ها، «متن پیام شامل» را روی متن ثابت زیر بگذارید. فرستنده را خالی بگذارید.'
						: 'Tap + (add filter) and, under the conditions, set «Message contains» to the fixed text below. Leave the sender empty.',
					tips: fa
						? ['پیامک‌های رمز پویا (OTP) و پیام‌های شخصی این متن را ندارند؛ پس هیچ‌وقت از گوشی بیرون نمی‌روند.']
						: ['One-time passwords and personal texts do not carry this text, so they never leave the phone.'],
					screen: (
						<>
							<AndroidStatus />
							<AppBar title="Add filter" action={<span className="text-[10px] font-medium" style={{ color: M3.primary }}>Save</span>} />
							<span className="px-2.5 pb-1 text-[8.5px] font-medium" style={{ color: M3.primary }}>Conditions</span>
							<div className="grid gap-2.5 pt-1">
								<Field label="Sender contains" value={<span className="text-[#79747e]">Any sender</span>} />
								<Field label="Message contains" value={keyword} rtl on />
							</div>
							<div className="mx-2.5 mt-2.5 flex items-center justify-between text-[9.5px] text-[#1d1b20]">Enabled<M3Switch /></div>
							<span className="px-2.5 pt-2.5 text-[8.5px] font-medium" style={{ color: M3.primary }}>Recipients</span>
							<span className="mx-2.5 mt-1 rounded-md border border-dashed border-[#79747e] py-1.5 text-center text-[9px] text-[#49454f]">+ Add recipient</span>
						</>
					),
				},
				{
					kind: 'destination' as const,
					title: method === 'SMS' ? (fa ? 'گیرنده: شمارهٔ سامانهٔ ویجنت' : 'Recipient: Vigent’s SMS line') : (fa ? 'گیرنده: نشانی اختصاصی شما' : 'Recipient: your own address'),
					body: method === 'SMS'
						? (fa ? 'در همان فیلتر «افزودن گیرنده» را بزنید، «شماره تلفن» را انتخاب و شمارهٔ سامانه را وارد کنید، بعد ذخیره کنید. ویجنت پیامک را از روی شمارهٔ همین گوشی می‌شناسد.' : 'In the same filter tap «Add recipient», choose «Phone number», enter the line and save. Vigent knows the SMS by this phone’s number.')
						: (fa ? '«افزودن گیرنده» ← «URL»، نشانی را از همین صفحه کپی و بچسبانید، روش را POST بگذارید و قالب پیش‌فرض پیام را دست نزنید. بعد ذخیره کنید.' : '«Add recipient» → «URL», paste the address from this page, set the method to POST and keep the default message template. Then save.'),
					screen: (
						<>
							<AndroidStatus />
							<AppBar title="Add recipient" action={<span className="text-[10px] font-medium" style={{ color: M3.primary }}>Save</span>} />
							<div className="flex flex-wrap gap-1 px-2.5 pb-2.5">
								<Chip selected={method === 'SMS'}>Phone number</Chip>
								<Chip selected={method === 'URL'}>URL</Chip>
								<Chip>Email</Chip>
								<Chip>Telegram</Chip>
							</div>
							<div className="grid gap-2.5">
								<Field label={method === 'SMS' ? 'Phone number' : 'URL'} value={target} on />
								{method === 'URL' ? <Field label="Method" value="POST ▾" /> : <Field label="SIM" value="SIM 1 ▾" />}
								<Field label="Message template" value={<span className="text-[#79747e]">{method === 'SMS' ? '{msg}' : 'Default (JSON)'}</span>} />
							</div>
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
				link: { label: fa ? 'Shortcuts در App Store' : 'Shortcuts on the App Store', href: SHORTCUTS_APP_STORE, store: 'appstore' },
				tips: fa
					? ['Shortcuts همراه iOS نصب است؛ فقط اگر پاکش کرده‌اید از App Store دوباره بگیرید.', 'iOS را به ۱۷ یا بالاتر به‌روز کنید؛ در نسخه‌های قدیمی‌تر اتوماسیون پیامک پیش از هر اجرا تأیید می‌خواهد و خودکار کار نمی‌کند.']
					: ['Shortcuts comes with iOS; get it again from the App Store only if you deleted it.', 'Update to iOS 17 or later; older versions ask before every message automation runs.'],
				screen: (
					<>
						<IosStatus />
						<IosNav back="Cancel" title="New Automation" />
						<div className="mx-2 mb-1.5 rounded-[8px] bg-[#e3e3e8] px-2 py-1 text-[9px] text-[#8e8e93]">⌕ Search</div>
						<IosGroup>
							<IosRow icon={<IosIcon color="#ff9500">◷</IosIcon>} label="Time of Day" chevron />
							<IosRow icon={<IosIcon color="#ff9500">⏰</IosIcon>} label="Alarm" chevron />
							<IosRow icon={<IosIcon color="#007aff">✉</IosIcon>} label="Email" chevron />
							<IosRow icon={<IosIcon color="#34c759">●</IosIcon>} label="Message" chevron on />
							<IosRow icon={<IosIcon color="#5856d6">⌂</IosIcon>} label="Arrive" chevron />
						</IosGroup>
					</>
				),
			},
			{
				kind: 'condition' as const,
				title: fa ? 'شرط: پیامک‌هایی که این متن را دارند' : 'Condition: messages with this text',
				body: fa ? 'در Message Contains متن ثابت زیر را دقیقاً بچسبانید، Sender را خالی بگذارید و Run Immediately را انتخاب کنید. فقط پیامک‌هایی که این متن را دارند برای ویجنت فرستاده می‌شوند.' : 'Paste the fixed text below into Message Contains, leave Sender empty and choose Run Immediately. Only messages with this text are sent to Vigent.',
				tips: fa ? ['Notify When Run را خاموش کنید تا با هر واریز اعلانی روی صفحه نیاید.'] : ['Turn Notify When Run off so no banner shows with every deposit.'],
				screen: (
					<>
						<IosStatus />
						<IosNav back="Back" title="Message" action="Next" />
						<IosGroup header="When I get a message">
							<IosRow label="Sender" value="Choose" chevron />
							<IosRow label="Message Contains" value={keyword} on />
						</IosGroup>
						<div className="h-2" />
						<IosGroup>
							<IosRow label="Run After Confirmation" />
							<IosRow label="Run Immediately" check />
						</IosGroup>
						<div className="h-2" />
						<IosGroup>
							<IosRow label="Notify When Run" toggle={false} />
						</IosGroup>
					</>
				),
			},
			{
				kind: 'destination' as const,
				title: method === 'SMS' ? (fa ? 'کار: فرستادن پیامک به سامانهٔ ویجنت' : 'Action: send it to Vigent’s line') : (fa ? 'کار: فرستادن به نشانی شما' : 'Action: send it to your address'),
				body: method === 'SMS'
					? (fa ? 'New Blank Automation را بزنید و کار Send Message را اضافه کنید: پیام را روی Shortcut Input (همان پیامک بانک) و گیرنده را شمارهٔ سامانه بگذارید.' : 'Tap New Blank Automation and add Send Message: set the message to Shortcut Input (the bank’s SMS) and the recipient to the line.')
					: (fa ? 'New Blank Automation ← کار Get Contents of URL: نشانی خودتان را بچسبانید، Method را POST و Request Body را JSON کنید و فیلد text را روی Shortcut Input بگذارید.' : 'New Blank Automation → Get Contents of URL: paste your address, set Method to POST, Request Body to JSON and add a text field with Shortcut Input.'),
				tips: method === 'SMS'
					? (fa ? ['پیامک از سیم‌کارت اصلی آیفون فرستاده می‌شود؛ شارژ پیامک داشته باشد.'] : ['The SMS goes from the iPhone’s main SIM; keep SMS credit on it.'])
					: (fa ? ['داده یا وای‌فای آیفون باید روشن بماند؛ Low Data Mode را برای آن خط خاموش کنید.'] : ['Keep mobile data or Wi-Fi on, and Low Data Mode off.']),
				screen: method === 'SMS' ? (
					<>
						<IosStatus />
						<IosNav back="Back" title="New Automation" action="Done" />
						<div className="relative mx-2 rounded-[10px] bg-white p-2 text-[10px] leading-[18px]">
							<div className="mb-1 flex items-center gap-1.5 text-[9px] text-[#8e8e93]"><IosIcon color="#34c759">●</IosIcon>Messages</div>
							<span>Send </span><Token>Shortcut Input</Token><span> to </span><Token on>{target}</Token>
							<Tap />
						</div>
						<div className="mx-2 mt-2 flex items-center justify-between rounded-[10px] bg-white px-2.5 py-1.5 text-[9.5px]">Show When Run<IosToggle on={false} /></div>
						<div className="mt-auto rounded-t-[12px] bg-white px-3 pb-2 pt-2 text-[8.5px] text-[#8e8e93]">⌕ Search for apps and actions</div>
					</>
				) : (
					<>
						<IosStatus />
						<IosNav back="Back" title="New Automation" action="Done" />
						<div className="relative mx-2 rounded-[10px] bg-white p-2 text-[10px] leading-[18px]">
							<div className="mb-1 flex items-center gap-1.5 text-[9px] text-[#8e8e93]"><IosIcon color="#007aff">⇣</IosIcon>Get Contents of URL</div>
							<span>Get contents of </span><Token on>{target}</Token>
							<Tap />
						</div>
						<div className="mx-2 mt-1.5 divide-y divide-[#e5e5ea] overflow-hidden rounded-[10px] bg-white text-[9.5px]">
							<div className="flex justify-between px-2.5 py-1">Method<span style={{ color: IOS_BLUE }}>POST</span></div>
							<div className="flex justify-between px-2.5 py-1">Request Body<span style={{ color: IOS_BLUE }}>JSON</span></div>
							<div className="flex items-center justify-between gap-2 px-2.5 py-1"><span className="text-[#8e8e93]">Text · text</span><Token>Shortcut Input</Token></div>
						</div>
					</>
				),
			},
			{
				kind: 'save' as const,
				title: fa ? 'Done را بزنید؛ تمام' : 'Tap Done; that is it',
				body: fa ? 'اتوماسیون در فهرست Personal دیده می‌شود. از این به بعد هر پیامک واریز، بدون باز شدن چیزی روی صفحه فرستاده می‌شود.' : 'The automation shows under Personal. From now on every deposit SMS is sent without anything opening on screen.',
				screen: (
					<>
						<IosStatus />
						<div className="flex items-center justify-between px-3 pt-1"><b className="text-[15px]">Automation</b><span className="text-[14px]" style={{ color: IOS_BLUE }}>+</span></div>
						<span className="px-3 pt-2 text-[8.5px] uppercase tracking-wide text-[#8e8e93]">Personal</span>
						<div className="relative mx-2 mt-1 rounded-[10px] bg-white p-2.5">
							<div className="flex items-center gap-1.5"><IosIcon color="#34c759">●</IosIcon><b className="min-w-0 flex-1 truncate text-[10px]">When I get a message containing “<span dir="auto">{keyword}</span>”</b></div>
							<div className="mt-1 flex items-center gap-1.5 ps-[23px] text-[9px] text-[#8e8e93]"><span className="min-w-0 truncate">{method === 'SMS' ? 'Send Message' : 'Get Contents of URL'}</span><span className="ms-auto shrink-0 rounded-full bg-[#e8f1ff] px-1.5 text-[8px] font-semibold" style={{ color: IOS_BLUE }}>Immediately</span></div>
							<Tap />
						</div>
						<div className="mt-auto flex justify-around border-t border-[#e5e5ea] bg-white/90 pb-1.5 pt-1.5 text-[7.5px] text-[#8e8e93]">
							<span>Shortcuts</span><span className="font-semibold" style={{ color: IOS_BLUE }}>Automation</span><span>Gallery</span>
						</div>
					</>
				),
			},
		]
	}, [platform, method, keyword, target, fa])
}

/**
 * The phone mock showing one step's screen; the other screens slide out.
 * An iPhone (Dynamic Island, iOS grey) or an Android phone (punch-hole
 * camera, Material surface), so each owner sees their own phone.
 */
export function PhoneMock({ steps, step, platform = 'IOS', className }: { steps: SetupStep[]; step: number; platform?: 'ANDROID' | 'IOS'; className?: string }) {
	const ios = platform === 'IOS'
	return (
		<div aria-hidden className={cn('relative mx-auto aspect-[268/540] w-[12.5rem] max-w-full p-[7px] shadow-[0_30px_50px_-34px_rgba(0,0,0,.6)]', ios ? 'rounded-[2.4rem] bg-[#1c1c1e] ring-1 ring-[#3a3a3c]' : 'rounded-[1.9rem] bg-[#202124] ring-1 ring-[#44474e]', className)}>
			{ios
				? <span className="absolute left-1/2 top-[13px] z-10 h-[15px] w-[54px] -translate-x-1/2 rounded-full bg-black" />
				: <span className="absolute left-1/2 top-[12px] z-10 size-[9px] -translate-x-1/2 rounded-full bg-black ring-2 ring-[#2d2e31]" />}
			<div dir="ltr" className={cn('relative size-full overflow-hidden font-sans text-[#111]', ios ? 'rounded-[2rem] bg-[#f2f2f7]' : 'rounded-[1.55rem] bg-[#fdfbff]')}>
				{steps.map((item, index) => (
					<div key={index} className={cn('absolute inset-0 flex flex-col gap-1 pb-2 pt-1 transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none', index === step ? 'translate-x-0 opacity-100' : index < step ? 'pointer-events-none -translate-x-4 opacity-0' : 'pointer-events-none translate-x-4 opacity-0')}>
						{item.screen}
					</div>
				))}
				{ios ? <span className="absolute bottom-1.5 left-1/2 h-[3px] w-[70px] -translate-x-1/2 rounded-full bg-black/80" /> : <span className="absolute bottom-1.5 left-1/2 h-[3px] w-[52px] -translate-x-1/2 rounded-full bg-black/45" />}
			</div>
		</div>
	)
}
