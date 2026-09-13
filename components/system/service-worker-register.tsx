'use client'

import { useEffect } from 'react'

/**
 * Registers the Vigent service worker (/sw.js) so the app becomes
 * installable on mobile (Add to Home Screen / install prompt) and gets a
 * friendly offline page. The SW never caches authenticated content — see
 * public/sw.js for the exact strategy.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    function register() {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // SW registration is a progressive enhancement — never break the page.
      })
    }

    if (document.readyState === 'complete') {
      register()
      return
    }
    window.addEventListener('load', register, { once: true })
    return () => window.removeEventListener('load', register)
  }, [])

  return null
}
