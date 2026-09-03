'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'
import type { HomeLocale } from './home-variants/shared/types'

const InstagramDemo = dynamic(
	() => import('./instagram-demo').then((module) => module.InstagramDemo),
	{ ssr: false },
)

function DemoSkeleton() {
	return (
		<div className="grid min-h-[43rem] items-center justify-center gap-5 md:min-h-[45rem] md:grid-cols-[minmax(300px,370px)_minmax(170px,220px)] md:gap-6" aria-hidden>
			<div className="marketing-demo-skeleton mx-auto aspect-[393/852] w-full max-w-[284px] rounded-[46px] border border-white/10 bg-white/[0.035] sm:max-w-[320px]" />
			<div className="hidden space-y-7 ps-8 md:block">
				{[0, 1, 2].map((item) => <div key={item} className="marketing-demo-skeleton h-11 rounded-xl bg-white/[0.035]" />)}
			</div>
		</div>
	)
}

export function InstagramDemoLazy({ locale }: { locale: HomeLocale }) {
	const rootRef = useRef<HTMLDivElement>(null)
	const [enabled, setEnabled] = useState(false)

	useEffect(() => {
		const root = rootRef.current
		if (!root || enabled) return
		if (!('IntersectionObserver' in window)) {
			setEnabled(true)
			return
		}
		const mobile = window.matchMedia('(max-width: 767px)').matches

		const observer = new IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return
				setEnabled(true)
				observer.disconnect()
			},
			{ rootMargin: mobile ? '1400px 0px' : '600px 0px', threshold: 0.01 },
		)
		observer.observe(root)
		return () => observer.disconnect()
	}, [enabled])

	return (
		<div ref={rootRef} className="relative min-h-[43rem] md:min-h-[45rem]" aria-busy={!enabled}>
			{enabled ? <InstagramDemo locale={locale} /> : <DemoSkeleton />}
		</div>
	)
}
