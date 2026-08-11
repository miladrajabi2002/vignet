import type { Metadata } from 'next'
import { MarketingMotionProvider } from '@/components/marketing/motion-provider'
import { VariantThreePage } from '@/components/marketing/home-variants/v3/page'
import { getHomeVariantProps } from '@/components/marketing/home-variants/shared/get-variant-props'

export const metadata: Metadata = {
	title: 'کانسپت صفحه اصلی ۳',
	robots: { index: false, follow: false, noarchive: true },
}

export default async function HomeVariantThreeRoute() {
	const props = await getHomeVariantProps()
	return <MarketingMotionProvider><VariantThreePage {...props} /></MarketingMotionProvider>
}
