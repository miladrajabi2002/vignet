import type { Metadata } from 'next'
import { MobileNavShowcase } from '@/components/marketing/mobile-nav-showcase'

export const metadata: Metadata = {
	title: 'مقایسه مدل‌های منوی موبایل',
	description: 'چهار کانسپت پیشنهادی برای منوی پایین موبایل ویجنت',
	robots: { index: false, follow: false },
}

export default function MobileNavShowcasePage() {
	return <MobileNavShowcase />
}
