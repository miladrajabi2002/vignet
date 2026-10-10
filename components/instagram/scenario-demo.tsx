'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'
import type { InstagramDemoAccount, InstagramDemoMode } from '@/components/marketing/home-variants/shared/mocks'

/**
 * The marketing iPhone demo, pinned to one scenario, for the dashboard's
 * empty Instagram tab: the customer types, the message is seen, the store
 * types back — the same flow the scenario will run for real, shown as the
 * operator's own connected account.
 *
 * framer-motion and the mock load on demand (the dashboard shell ships
 * neither), and the timers only run while the phone is on screen.
 */
const Player = dynamic(
        async () => {
                const [{ LazyMotion }, { InstagramMock }, features] = await Promise.all([
                        import('framer-motion'),
                        import('@/components/marketing/home-variants/shared/mocks'),
                        import('@/components/marketing/motion-features'),
                ])
                return function ScenarioPlayer({ locale, mode, active, account }: { locale: 'fa' | 'en'; mode: InstagramDemoMode; active: boolean; account?: InstagramDemoAccount }) {
                        return (
                                <LazyMotion features={features.default} strict>
                                        <InstagramMock locale={locale} only={mode} active={active} inverse={false} account={account} />
                                </LazyMotion>
                        )
                }
        },
        {
                ssr: false,
                loading: () => <div aria-hidden className="aspect-[393/852] w-full animate-pulse rounded-[2.4rem] bg-black/[0.05] motion-reduce:animate-none" />,
        },
)

export function InstagramScenarioDemo({
        locale,
        mode,
        account,
        label,
        className,
}: {
        locale: 'fa' | 'en'
        mode: InstagramDemoMode
        /** The connected account the phone plays as; the sample store when absent. */
        account?: InstagramDemoAccount
        /** What the animation shows, for assistive tech. */
        label: string
        className?: string
}) {
        const rootRef = useRef<HTMLDivElement>(null)
        const [inView, setInView] = useState(true)

        useEffect(() => {
                const root = rootRef.current
                if (!root || !('IntersectionObserver' in window)) return
                const observer = new IntersectionObserver(
                        (entries) => setInView(entries.some((entry) => entry.isIntersecting)),
                        { rootMargin: '80px 0px', threshold: 0 },
                )
                observer.observe(root)
                return () => observer.disconnect()
        }, [])

        return (
                <div ref={rootRef} role="img" aria-label={label} className={className}>
                        <Player locale={locale} mode={mode} active={inView} account={account} />
                </div>
        )
}
