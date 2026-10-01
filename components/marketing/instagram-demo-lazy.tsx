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
                <div className="grid min-h-[30rem] items-center justify-center gap-4 md:min-h-[45rem] md:grid-cols-[minmax(300px,370px)_minmax(210px,250px)] md:gap-7" aria-hidden>
                        <div className="marketing-demo-skeleton mx-auto aspect-[393/852] w-full max-w-[260px] rounded-[46px] border border-white/10 bg-white/[0.035] sm:max-w-[320px]" />
                        {/* Same footprint as the phone scenario tabs + caption, so the swap does not shift. */}
                        <div className="md:hidden">
                                <div className="marketing-demo-skeleton h-[68px] rounded-2xl bg-white/[0.035]" />
                                <div className="marketing-demo-skeleton mx-auto mt-2.5 h-5 w-48 rounded-full bg-white/[0.035]" />
                        </div>
                        <div className="hidden space-y-2 md:block">
                                <div className="marketing-demo-skeleton mb-3 h-[18px] w-40 rounded-full bg-white/[0.035]" />
                                {[0, 1, 2].map((item) => <div key={item} className="marketing-demo-skeleton h-[68px] rounded-2xl bg-white/[0.035]" />)}
                        </div>
                </div>
        )
}

export function InstagramDemoLazy({ locale }: { locale: HomeLocale }) {
        const rootRef = useRef<HTMLDivElement>(null)
        const [enabled, setEnabled] = useState(false)
        // Once loaded, the demo's timers only run while it is on screen so a
        // visitor reading further down the page pays nothing for it.
        const [inView, setInView] = useState(true)

        useEffect(() => {
                const root = rootRef.current
                if (!root || !enabled || !('IntersectionObserver' in window)) return
                const observer = new IntersectionObserver(
                        (entries) => setInView(entries.some((entry) => entry.isIntersecting)),
                        { rootMargin: '80px 0px', threshold: 0 },
                )
                observer.observe(root)
                return () => observer.disconnect()
        }, [enabled])

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
                <div ref={rootRef} className="relative min-h-[30rem] md:min-h-[45rem]" aria-busy={!enabled}>
                        {enabled ? <InstagramDemo locale={locale} active={inView} /> : <DemoSkeleton />}
                </div>
        )
}
