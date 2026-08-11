import type { Metadata } from 'next'
import { MarketingMotionProvider } from '@/components/marketing/motion-provider'
import { VariantTwoPage } from '@/components/marketing/home-variants/v2/page'
import { getHomeVariantProps } from '@/components/marketing/home-variants/shared/get-variant-props'

export const metadata: Metadata = {
	title: 'کانسپت صفحه اصلی ۲',
	robots: { index: false, follow: false, noarchive: true },
}

export default async function HomeVariantTwoRoute() {
	const props = await getHomeVariantProps()
	return <MarketingMotionProvider><VariantTwoPage {...props} /></MarketingMotionProvider>
}
