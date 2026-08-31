'use client'

import { LazyMotion } from 'framer-motion'
import { InstagramMock } from './home-variants/shared/mocks'
import type { HomeLocale } from './home-variants/shared/types'

const loadMotionFeatures = () => import('./motion-features').then((module) => module.default)

/** Heavy interactive demo boundary. This module is fetched only near viewport. */
export function InstagramDemo({ locale }: { locale: HomeLocale }) {
	return (
		<LazyMotion features={loadMotionFeatures} strict>
			<InstagramMock locale={locale} inverse active />
		</LazyMotion>
	)
}
