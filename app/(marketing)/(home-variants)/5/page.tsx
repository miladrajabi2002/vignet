import type { Metadata } from 'next'
import { MarketingMotionProvider } from '@/components/marketing/motion-provider'
import { VariantFivePage } from '@/components/marketing/home-variants/v5/page'
import { getHomeVariantProps } from '@/components/marketing/home-variants/shared/get-variant-props'

export const metadata: Metadata = {
	title: 'کانسپت صفحه اصلی ۵',
	robots: { index: false, follow: false, noarchive: true },
}

export default async function HomeVariantFiveRoute() {
	const props = await getHomeVariantProps()
	return <MarketingMotionProvider><VariantFivePage {...props} /></MarketingMotionProvider>
}
