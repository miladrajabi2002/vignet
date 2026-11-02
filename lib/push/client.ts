/**
 * Browser side of Web Push and app install (see lib/notifications/web-push
 * and public/sw.js). Every function is safe to call in any browser: where a
 * capability is missing it reports so instead of throwing.
 *
 * Platform facts this encodes:
 *   • iPhone/iPad: Notification and PushManager exist only inside the app
 *     added to the Home Screen (iOS 16.4+), and permission may only be asked
 *     from a tap. In Safari itself the right offer is «Add to Home Screen».
 *   • Android Chrome: `new Notification()` throws; alerts must come from the
 *     service worker registration.
 *   • Desktop Chrome/Edge/Firefox/Safari: push works in a normal tab too.
 */

export type PushState = 'unsupported' | 'needs-install' | 'denied' | 'default' | 'subscribed' | 'granted'

export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  // iPadOS 13+ reports itself as a Mac; touch points give it away.
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function pushApisPresent(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export async function serviceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null
  try {
    return (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register('/sw.js'))
  } catch {
    return null
  }
}

export async function readPushState(): Promise<PushState> {
  if (!pushApisPresent()) return isIos() && !isStandalone() ? 'needs-install' : 'unsupported'
  const permission = window.Notification.permission
  if (permission === 'denied') return 'denied'
  if (permission === 'default') return 'default'
  const registration = await serviceWorkerRegistration()
  const subscription = await registration?.pushManager.getSubscription().catch(() => null)
  return subscription ? 'subscribed' : 'granted'
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (char) => char.charCodeAt(0))
}

/**
 * Ask for permission (must run inside a tap on iOS) and register this device.
 * Returns the resulting state; 'granted' means the browser allows alerts but
 * the server has push turned off, so only in-tab alerts work.
 */
export async function subscribePush(): Promise<PushState> {
  if (!pushApisPresent()) return isIos() && !isStandalone() ? 'needs-install' : 'unsupported'
  const permission = await window.Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'default'

  const registration = await serviceWorkerRegistration()
  if (!registration) return 'granted'
  const keyResponse = await fetch('/api/push/subscription', { cache: 'no-store' }).catch(() => null)
  const { publicKey } = (keyResponse?.ok ? await keyResponse.json().catch(() => ({})) : {}) as { publicKey?: string | null }
  if (!publicKey) return 'granted'

  try {
    await navigator.serviceWorker.ready
    const existing = await registration.pushManager.getSubscription()
    const subscription = existing ?? await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    })
    const saved = await fetch('/api/push/subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription.toJSON()),
    })
    return saved.ok ? 'subscribed' : 'granted'
  } catch {
    return 'granted'
  }
}

/** Stop alerts on this device (and forget it on the server). */
export async function unsubscribePush(): Promise<void> {
  const registration = await serviceWorkerRegistration()
  const subscription = await registration?.pushManager.getSubscription().catch(() => null)
  if (!subscription) return
  await fetch('/api/push/subscription', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
    keepalive: true,
  }).catch(() => undefined)
  await subscription.unsubscribe().catch(() => false)
}

/**
 * Show an alert from the page (the bell's in-tab path). Uses the service
 * worker where it exists — the only way that works on Android.
 */
export async function showLocalNotification(title: string, options: NotificationOptions & { link?: string }): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window) || window.Notification.permission !== 'granted') return false
  const { link, ...rest } = options
  const registration = await serviceWorkerRegistration()
  if (registration) {
    try {
      await registration.showNotification(title, { ...rest, data: { link: link ?? '/overview' } })
      return true
    } catch {
      // Fall through to the constructor (older desktop browsers).
    }
  }
  try {
    new window.Notification(title, rest)
    return true
  } catch {
    return false
  }
}

/** Fired on window when a push arrived while the panel is open. */
export const PUSH_ARRIVED_EVENT = 'vigent:push-arrived'

/** Fired on window to open the «Add to Home Screen» guide (components/pwa/pwa-runtime). */
export const OPEN_INSTALL_GUIDE_EVENT = 'vigent:open-install-guide'
