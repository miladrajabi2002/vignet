import type { Metadata } from 'next'
import { MarketingMotionProvider } from '@/components/marketing/motion-provider'
import { VariantFourPage } from '@/components/marketing/home-variants/v4/page'
import { getHomeVariantProps } from '@/components/marketing/home-variants/shared/get-variant-props'

export const metadata: Metadata = {
	title: 'کانسپت صفحه اصلی ۴',
	robots: { index: false, follow: false, noarchive: true },
}

export default async function HomeVariantFourRoute() {
	const props = await getHomeVariantProps()
	return <MarketingMotionProvider><VariantFourPage {...props} /></MarketingMotionProvider>
}
