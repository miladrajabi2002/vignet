import { Clock, MapPin, Phone } from 'lucide-react'
import { InstagramIcon } from '@/components/marketing/social-links'
import { contrastOn } from '@/lib/widget/config'
import type { ChatLinkSettings } from '@/lib/chat-link/config'

/**
 * What a customer sees when the owner has paused the chat link: the business's
 * own name and colour, a plain reason, and any other way to reach it. Kept
 * free of client code so it renders even in the most limited in-app browser.
 */
export function ChatLinkUnavailable({
	name,
	avatar,
	settings,
}: {
	name: string
	avatar: string | null
	settings: ChatLinkSettings
}) {
	const accent = settings.primaryColor
	const contacts = [
		settings.phone && { href: `tel:${settings.phone}`, label: 'تماس', icon: Phone },
		settings.instagram && { href: `https://instagram.com/${settings.instagram}`, label: 'اینستاگرام', icon: InstagramIcon },
		settings.mapUrl && { href: settings.mapUrl, label: 'مسیریابی', icon: MapPin },
	].filter((item): item is { href: string; label: string; icon: typeof Phone } => Boolean(item))

	return (
		<main className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#f2f2f0] px-6 py-10 text-center text-neutral-900">
			{avatar ? (
				// eslint-disable-next-line @next/next/no-img-element
				<img src={avatar} alt="" width={76} height={76} className="h-[76px] w-[76px] rounded-[25px] object-cover ring-1 ring-black/10" />
			) : (
				<span
					className="flex h-[76px] w-[76px] items-center justify-center rounded-[25px] text-3xl font-semibold ring-1 ring-black/10"
					style={{ backgroundColor: accent, color: contrastOn(accent) }}
				>
					{(name || '؟').trim().charAt(0)}
				</span>
			)}
			<h1 className="mt-5 text-2xl font-bold tracking-tight">{name}</h1>
			<p className="mt-4 inline-flex min-h-9 items-center gap-1.5 rounded-full border border-black/[0.08] bg-white px-3.5 text-[13px] text-neutral-600">
				<Clock className="h-3.5 w-3.5" />
				گفتگوی آنلاین فعلاً در دسترس نیست
			</p>
			<p className="mt-4 max-w-xs text-sm leading-7 text-neutral-600">
				این صفحه موقتاً متوقف شده است. کمی بعد دوباره سر بزنید
				{contacts.length ? ' یا از راه‌های زیر با ما در تماس باشید.' : '.'}
			</p>
			{contacts.length > 0 && (
				<div className="mt-6 flex flex-wrap items-center justify-center gap-2">
					{contacts.map((item) => (
						<a
							key={item.label}
							href={item.href}
							{...(item.href.startsWith('http') ? { target: '_blank', rel: 'noreferrer' } : {})}
							className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-black/10 bg-white px-4 text-sm font-semibold text-neutral-800 transition-colors hover:border-black/25"
						>
							<item.icon className="h-4 w-4" />
							{item.label}
						</a>
					))}
				</div>
			)}
		</main>
	)
}
