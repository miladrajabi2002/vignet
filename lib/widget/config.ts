/**
 * Shared types + helpers for the public web widget appearance/security settings.
 *
 * Widget settings live in the WEB_WIDGET AgentChannel's `config` JSON column, so
 * there is no dedicated table/migration. Both the dashboard (to edit) and the
 * public widget endpoints (to serve + enforce) go through the normalizer here so
 * defaults and validation stay in one place.
 */

export type WidgetTheme = 'dark' | 'light'
export type WidgetPosition = 'right' | 'left'

export interface WidgetSettings {
  /** Brand accent: launcher fill, user bubble, send button. */
  primaryColor: string
  /** Panel surface scheme. */
  theme: WidgetTheme
  /** Which corner the launcher sits in. */
  position: WidgetPosition
  /** Optional header title override (defaults to the agent name). */
  headerTitle: string | null
  /** Optional short label shown beside the launcher icon. */
  launcherLabel: string | null
  /**
   * Hostnames allowed to embed the widget. Empty = allow everywhere (with an
   * "unprotected" warning shown in the dashboard).
   */
  allowedDomains: string[]
}

export const DEFAULT_WIDGET_SETTINGS: WidgetSettings = {
  primaryColor: '#0F0F10',
  theme: 'dark',
  position: 'right',
  headerTitle: null,
  launcherLabel: null,
  allowedDomains: [],
}

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

/** Coerce arbitrary JSON (channel config) into a complete, safe settings object. */
export function normalizeWidgetSettings(raw: unknown): WidgetSettings {
  const c = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}

  const primaryColor =
    typeof c.primaryColor === 'string' && HEX.test(c.primaryColor.trim())
      ? c.primaryColor.trim()
      : DEFAULT_WIDGET_SETTINGS.primaryColor

  const theme: WidgetTheme = c.theme === 'light' ? 'light' : 'dark'
  const position: WidgetPosition = c.position === 'left' ? 'left' : 'right'

  const headerTitle =
    typeof c.headerTitle === 'string' && c.headerTitle.trim()
      ? c.headerTitle.trim().slice(0, 60)
      : null

  const launcherLabel =
    typeof c.launcherLabel === 'string' && c.launcherLabel.trim()
      ? c.launcherLabel.trim().slice(0, 40)
      : null

  return {
    primaryColor,
    theme,
    position,
    headerTitle,
    launcherLabel,
    allowedDomains: normalizeDomains(c.allowedDomains),
  }
}

/** Lowercase, strip scheme/path/port/`www.`, dedupe. Used for storage + checks. */
export function normalizeDomains(raw: unknown): string[] {
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? raw.split(/[\n,]/)
      : []
  const out = new Set<string>()
  for (const item of list) {
    const host = hostnameOf(String(item))
    if (host) out.add(host)
  }
  return [...out]
}

/** Extract a bare hostname from a URL, "Origin" header, or hand-typed domain. */
export function hostnameOf(value: string): string | null {
  let v = value.trim().toLowerCase()
  if (!v) return null
  // Drop scheme + any path/query the user pasted along.
  v = v.replace(/^[a-z]+:\/\//, '').replace(/\/.*$/, '')
  // Drop port + leading www.
  v = v.replace(/:\d+$/, '').replace(/^www\./, '')
  // A valid hostname has at least one dot, or is localhost.
  if (v !== 'localhost' && !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(v)) return null
  return v
}

/**
 * Is a request from `origin`/`referer` allowed by the allowlist?
 * Empty allowlist = allow all. Hostname compared with www-insensitivity.
 */
export function isOriginAllowed(
  origin: string | null,
  referer: string | null,
  allowed: string[],
): boolean {
  if (allowed.length === 0) return true
  const host = hostnameOf(origin || '') || hostnameOf(referer || '')
  if (!host) return false
  return allowed.includes(host)
}

/** Pick black/white text for legibility on a given hex background. */
export function contrastOn(hex: string): '#ffffff' | '#000000' {
  const h = hex.replace('#', '')
  const full =
    h.length === 3
      ? h
          .split('')
          .map((x) => x + x)
          .join('')
      : h
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  // Relative luminance (sRGB approximation).
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.6 ? '#000000' : '#ffffff'
}
