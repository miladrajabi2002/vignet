import { Link2Off } from 'lucide-react'

/**
 * An address no chat link answers to (mistyped, or removed by its owner).
 * A customer got here from a business's bio or QR code, so the page speaks
 * about the link, not about Vigent.
 */
export default function ChatLinkNotFound() {
	return (
		<main className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#f2f2f0] px-6 py-10 text-center text-neutral-900">
			<span className="flex h-[76px] w-[76px] items-center justify-center rounded-[25px] border border-black/[0.08] bg-white text-neutral-500">
				<Link2Off className="h-7 w-7" />
			</span>
			<h1 className="mt-5 text-2xl font-bold tracking-tight">این صفحهٔ گفتگو پیدا نشد</h1>
			<p className="mt-3 max-w-xs text-sm leading-7 text-neutral-600">
				آدرس را دوباره بررسی کنید. اگر آن را از صفحه یا پیام یک کسب‌وکار گرفته‌اید، ممکن است آدرسش را عوض کرده باشد.
			</p>
		</main>
	)
}
