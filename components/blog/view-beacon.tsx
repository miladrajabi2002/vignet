'use client'

import { useEffect } from 'react'

/**
 * Client-side view counter for ISR-cached blog posts.
 *
 * The post page itself is statically cached (revalidate = 300), so a
 * server-side increment would run at most once per cache cycle. This beacon
 * fires once per real page view instead — same counting semantics the
 * force-dynamic page used to have.
 */
export function ViewBeacon({ slug }: { slug: string }) {
        useEffect(() => {
                const controller = new AbortController()
                fetch(`/api/blog/${encodeURIComponent(slug)}/view`, {
                        method: 'POST',
                        signal: controller.signal,
                        keepalive: true,
                        headers: { 'content-type': 'application/json' },
                }).catch(() => {})
                return () => controller.abort()
        }, [slug])
        return null
}
