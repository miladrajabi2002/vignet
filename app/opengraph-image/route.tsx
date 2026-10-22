import { renderShareImage } from '@/lib/seo/share-image'

export const dynamic = 'force-static'

export function GET() {
	return renderShareImage()
}
