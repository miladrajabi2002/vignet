import type { Metadata } from 'next'
import { MarketingMotionProvider } from '@/components/marketing/motion-provider'
import { VariantOnePage } from '@/components/marketing/home-variants/v1/page'
import { getHomeVariantProps } from '@/components/marketing/home-variants/shared/get-variant-props'

export const metadata: Metadata = {
	title: 'کانسپت صفحه اصلی ۱',
	robots: { index: false, follow: false, noarchive: true },
}

export default async function HomeVariantOneRoute() {
	const props = await getHomeVariantProps()
	return <MarketingMotionProvider><VariantOnePage {...props} /></MarketingMotionProvider>
}
