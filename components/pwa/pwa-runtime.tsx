'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { BellRing, Download, PlusSquare, Share, WifiOff, X } from 'lucide-react'
import { MobileBottomSheet } from '@/components/ui/mobile-bottom-sheet'
import {
  OPEN_INSTALL_GUIDE_EVENT,
  PUSH_ARRIVED_EVENT,
  isIos,
  isStandalone,
  readPushState,
  subscribePush,
  unsubscribePush,
} from '@/lib/push/client'

/**
 * The panel as an installed app (mounted once in the dashboard layout):
 *
 *   • iPhone/iPad in Safari → a short «Add to Home Screen» guide, since that
 *     is the only way iOS allows notifications at all.
 *   • Android / Windows / macOS Chrome and Edge → the browser's real install
 *     dialog behind an «نصب اپ» card.
 *   • Inside the installed app with alerts never asked → «اعلان‌ها را روشن
 *     کنید»; the permission request runs from that tap (required on iOS).
 *   • Offline → a slim banner: what is on screen is the last saved copy.
 *
 * It also tells the service worker who is signed in (a different user wipes
 * the offline copy) and turns this device's alerts off on logout.
 */

const DISMISS_DAYS = 14
const KEY_INSTALL = 'vigent:pwa-install-dismissed'
const KEY_PUSH = 'vigent:pwa-push-dismissed'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// The browser fires this once, often before React has mounted: keep it.
let deferredInstall: BeforeInstallPromptEvent | null = null
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredInstall = event as BeforeInstallPromptEvent
    window.dispatchEvent(new Event('vigent:install-available'))
  })
}

function dismissedRecently(key: string): boolean {
  try {
    const at = Number(window.localStorage.getItem(key) || 0)
    return at > 0 && Date.now() - at < DISMISS_DAYS * 86_400_000
  } catch {
    return false
  }
}

function rememberDismiss(key: string) {
  try {
    window.localStorage.setItem(key, String(Date.now()))
  } catch {
    // Private mode: the card simply comes back next visit.
  }
}

type Card = 'install' | 'push' | null

export function PwaRuntime({ userId, fa }: { userId: string; fa: boolean }) {
  const router = useRouter()
  const reduceMotion = useReducedMotion()
  const [card, setCard] = useState<Card>(null)
  const [guideOpen, setGuideOpen] = useState(false)
  const [offline, setOffline] = useState(false)
  const [busy, setBusy] = useState(false)
  const guideTriggerRef = useRef<HTMLElement | null>(null)

  // Session + messages from the service worker.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const sw = navigator.serviceWorker
    void sw.ready.then((registration) => registration.active?.postMessage({ type: 'vigent:session', userId })).catch(() => undefined)
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; link?: string } | null
      if (data?.type === 'vigent:push') window.dispatchEvent(new Event(PUSH_ARRIVED_EVENT))
      if (data?.type === 'vigent:open' && data.link?.startsWith('/')) router.push(data.link)
    }
    sw.addEventListener('message', onMessage)
    return () => sw.removeEventListener('message', onMessage)
  }, [router, userId])

  // Logout on this device: stop its alerts and drop the offline copy.
  useEffect(() => {
    const onSubmit = (event: Event) => {
      const form = event.target as HTMLElement | null
      if (!form?.hasAttribute?.('data-vigent-logout')) return
      void unsubscribePush()
      navigator.serviceWorker?.controller?.postMessage({ type: 'vigent:logout' })
    }
    document.addEventListener('submit', onSubmit, true)
    return () => document.removeEventListener('submit', onSubmit, true)
  }, [])

  // Offline banner.
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  // Which offer (if any) this device gets.
  useEffect(() => {
    let cancelled = false
    const decide = async () => {
      if (isStandalone()) {
        const state = await readPushState()
        if (!cancelled && state === 'default' && !dismissedRecently(KEY_PUSH)) setCard('push')
        return
      }
      if (dismissedRecently(KEY_INSTALL)) return
      if (isIos()) {
        if (!cancelled) setCard('install')
        return
      }
      if (deferredInstall && !cancelled) setCard('install')
    }
    const timer = window.setTimeout(() => void decide(), 3500)
    const onAvailable = () => {
      if (!isStandalone() && !dismissedRecently(KEY_INSTALL)) setCard('install')
    }
    const onInstalled = () => {
      deferredInstall = null
      setCard(null)
    }
    const openGuide = () => setGuideOpen(true)
    window.addEventListener('vigent:install-available', onAvailable)
    window.addEventListener('appinstalled', onInstalled)
    window.addEventListener(OPEN_INSTALL_GUIDE_EVENT, openGuide)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      window.removeEventListener('vigent:install-available', onAvailable)
      window.removeEventListener('appinstalled', onInstalled)
      window.removeEventListener(OPEN_INSTALL_GUIDE_EVENT, openGuide)
    }
  }, [])

  const dismiss = useCallback(() => {
    rememberDismiss(card === 'push' ? KEY_PUSH : KEY_INSTALL)
    setCard(null)
  }, [card])

  async function act(trigger: HTMLElement) {
    if (card === 'push') {
      setBusy(true)
      try {
        const state = await subscribePush()
        if (state === 'subscribed') void fetch('/api/push/test', { method: 'POST' }).catch(() => undefined)
        if (state !== 'default') setCard(null)
      } finally {
        setBusy(false)
      }
      return
    }
    if (deferredInstall) {
      const prompt = deferredInstall
      deferredInstall = null
      await prompt.prompt().catch(() => undefined)
      const choice = await prompt.userChoice.catch(() => null)
      if (choice?.outcome !== 'accepted') rememberDismiss(KEY_INSTALL)
      setCard(null)
      return
    }
    guideTriggerRef.current = trigger
    setGuideOpen(true)
  }

  const copy = card === 'push'
    ? {
        icon: BellRing,
        title: fa ? 'اعلان‌ها را روشن کنید' : 'Turn on notifications',
        body: fa ? 'پیام تازهٔ مشتری و درخواست اپراتور، حتی وقتی برنامه بسته است.' : 'New customer messages and operator requests, even with the app closed.',
        action: fa ? 'فعال‌سازی' : 'Turn on',
      }
    : {
        icon: Download,
        title: fa ? 'ویجنت را نصب کنید' : 'Install Vigent',
        body: isIos()
          ? (fa ? 'با افزودن به صفحهٔ اصلی، پنل مثل یک اپ باز می‌شود و اعلان می‌گیرد.' : 'Add it to your Home Screen to open the panel like an app and get alerts.')
          : (fa ? 'پنل در پنجرهٔ خودش باز می‌شود و اعلان پیام‌ها را می‌گیرد.' : 'The panel opens in its own window and gets message alerts.'),
        action: isIos() ? (fa ? 'نحوهٔ نصب' : 'How to') : (fa ? 'نصب' : 'Install'),
      }
  const Icon = copy.icon

  return (
    <>
      <AnimatePresence>
        {offline && (
          <motion.div
            key="offline"
            role="status"
            initial={reduceMotion ? { opacity: 0 } : { y: -24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { y: -24, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="fixed inset-x-0 top-0 z-[70] flex items-center justify-center gap-2 bg-[#111] px-4 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-[12px] font-semibold text-white"
          >
            <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
            {fa ? 'آفلاین هستید — آخرین نسخهٔ ذخیره‌شده نمایش داده می‌شود و تغییرات ارسال نمی‌شوند.' : 'You are offline — showing the last saved copy; changes are not sent.'}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {card && (
          <motion.aside
            key={card}
            aria-label={copy.title}
            initial={reduceMotion ? { opacity: 0 } : { y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { y: 24, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
            className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] z-[60] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-black/[0.06] bg-white p-3 shadow-[0_12px_40px_-12px_rgba(17,17,17,0.35)] sm:bottom-6 sm:end-6 sm:start-auto sm:mx-0"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-black text-white">
              <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-bold text-[var(--text-primary)]">{copy.title}</span>
              <span className="block text-[12px] leading-5 text-[var(--text-muted)]">{copy.body}</span>
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={(event) => void act(event.currentTarget)}
              className="spatial-press inline-flex min-h-10 shrink-0 items-center rounded-full bg-black px-4 text-[12px] font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 disabled:opacity-60"
            >
              {copy.action}
            </button>
            <button
              type="button"
              onClick={dismiss}
              aria-label={fa ? 'بعداً' : 'Later'}
              className="inline-flex h-10 w-8 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </motion.aside>
        )}
      </AnimatePresence>

      <MobileBottomSheet
        open={guideOpen}
        mobileOnly={false}
        title={fa ? 'افزودن ویجنت به صفحهٔ اصلی' : 'Add Vigent to your Home Screen'}
        description={fa ? 'در آیفون، اعلان فقط برای برنامه‌ای کار می‌کند که روی صفحهٔ اصلی باشد.' : 'On iPhone, notifications only work for apps on the Home Screen.'}
        closeLabel={fa ? 'بستن' : 'Close'}
        triggerRef={guideTriggerRef}
        onClose={() => setGuideOpen(false)}
      >
        <ol className="space-y-3">
          {[
            { icon: Share, text: fa ? 'در نوار پایین Safari، دکمهٔ «Share» را بزنید.' : 'In Safari, tap the Share button in the toolbar.' },
            { icon: PlusSquare, text: fa ? 'گزینهٔ «Add to Home Screen» را انتخاب و «Add» را بزنید.' : 'Choose “Add to Home Screen”, then tap “Add”.' },
            { icon: BellRing, text: fa ? 'ویجنت را از صفحهٔ اصلی باز کنید و «فعال‌سازی اعلان‌ها» را بزنید.' : 'Open Vigent from the Home Screen and turn on notifications.' },
          ].map((step, index) => (
            <li key={index} className="flex items-start gap-3 rounded-xl border border-[var(--border-default)] bg-white p-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--bg-surface)] text-[var(--text-secondary)]">
                <step.icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="pt-1 text-sm leading-6 text-[var(--text-secondary)]">
                <span className="me-1 font-bold tabular-nums text-[var(--text-primary)]">{(index + 1).toLocaleString(fa ? 'fa-IR' : 'en-US')}.</span>
                {step.text}
              </span>
            </li>
          ))}
        </ol>
      </MobileBottomSheet>
    </>
  )
}
