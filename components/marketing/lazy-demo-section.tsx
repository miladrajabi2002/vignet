'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'

const DemoSection = dynamic(
	() => import('@/components/marketing/demo-section').then((mod) => mod.DemoSection),
	{ loading: () => <DemoPlaceholder /> },
)

/** Load the animation-heavy demo only when the visitor is close to it. */
export function LazyDemoSection() {
	const markerRef = useRef<HTMLDivElement>(null)
	const [ready, setReady] = useState(false)

	useEffect(() => {
		const marker = markerRef.current
		if (!marker || ready) return
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) {
					setReady(true)
					observer.disconnect()
				}
			},
			{ rootMargin: '500px 0px' },
		)
		observer.observe(marker)
		return () => observer.disconnect()
	}, [ready])

	return <div ref={markerRef}>{ready ? <DemoSection /> : <DemoPlaceholder />}</div>
}

function DemoPlaceholder() {
	return (
		<section id="demo" className="min-h-[680px] bg-[var(--bg-base)] py-20 md:min-h-[760px] md:py-28">
			<div className="mx-auto max-w-6xl px-6">
				<div className="mx-auto h-4 w-28 animate-pulse rounded-full bg-[var(--white-05)]" />
				<div className="mx-auto mt-6 h-10 max-w-md animate-pulse rounded-lg bg-[var(--white-05)]" />
				<div className="mt-12 aspect-[16/9] w-full animate-pulse rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]" />
			</div>
		</section>
	)
}
