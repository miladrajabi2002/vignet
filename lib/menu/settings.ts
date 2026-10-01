/**
 * Digital menu settings (Workspace.menuSettings) — shape, defaults, themes and
 * the small pure helpers the public page and the dashboard preview share.
 * Everything here is safe on both server and client (no DB, no Node APIs).
 */
import { z } from 'zod'

export const MENU_THEMES = ['minimal', 'night', 'garden', 'cafe'] as const
export const MENU_LAYOUTS = ['list', 'grid', 'classic'] as const
export type MenuTheme = (typeof MENU_THEMES)[number]
export type MenuLayout = (typeof MENU_LAYOUTS)[number]

export interface ThemeTokens {
  label: string
  bg: string
  surface: string
  ink: string
  muted: string
  line: string
  /** Default accent when the owner has not picked one. */
  accent: string
  dark: boolean
}

/* Four looks a restaurant can wear. Neutrals lean toward each theme's accent
   so no preset reads as a default grey. */
export const THEME_TOKENS: Record<MenuTheme, ThemeTokens> = {
  minimal: { label: 'روشن مینیمال', bg: '#f7f7f5', surface: '#ffffff', ink: '#17171a', muted: '#6c6c74', line: '#e9e9ec', accent: '#17171a', dark: false },
  night: { label: 'شب', bg: '#11100e', surface: '#1b1917', ink: '#f4efe7', muted: '#a8a095', line: '#2c2926', accent: '#d6aa5b', dark: true },
  garden: { label: 'باغ', bg: '#f0f5f1', surface: '#ffffff', ink: '#16311f', muted: '#5d7465', line: '#dbe6dd', accent: '#1f7a55', dark: false },
  cafe: { label: 'کافه', bg: '#fbf6f1', surface: '#ffffff', ink: '#2b1d17', muted: '#8a6f63', line: '#f0e2d8', accent: '#c2552f', dark: false },
}

export const LAYOUT_LABELS: Record<MenuLayout, string> = {
  list: 'فهرست با عکس',
  grid: 'کارت‌های بزرگ',
  classic: 'کلاسیک بدون عکس',
}

/** Accent swatches offered in the dashboard (any hex is accepted). */
export const ACCENT_SWATCHES = ['#17171a', '#6d4aff', '#c2552f', '#d6aa5b', '#1f7a55', '#0e7490', '#b4235a', '#9a3412']

const hex = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/)
const clock = z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
const shortText = (max: number) => z.string().trim().max(max)
const url = z.string().trim().max(600).refine((value) => value === '' || /^https:\/\//.test(value) || value.startsWith('/'), 'https only')

export const menuSettingsSchema = z.object({
  theme: z.enum(MENU_THEMES).default('minimal'),
  layout: z.enum(MENU_LAYOUTS).default('list'),
  accent: hex.nullable().default(null),
  coverImage: url.default(''),
  logo: url.default(''),
  tagline: shortText(140).default(''),
  notice: shortText(160).default(''),
  openAt: clock.or(z.literal('')).default(''),
  closeAt: clock.or(z.literal('')).default(''),
  phone: shortText(24).default(''),
  address: shortText(160).default(''),
  mapUrl: url.default(''),
  instagram: z.string().trim().max(40).regex(/^@?[A-Za-z0-9._]*$/).default(''),
  showAsk: z.boolean().default(true),
  showSearch: z.boolean().default(true),
})

export type MenuSettings = z.infer<typeof menuSettingsSchema>

export const DEFAULT_MENU_SETTINGS: MenuSettings = menuSettingsSchema.parse({})

/** Stored JSON → settings; anything malformed falls back field by field. */
export function readMenuSettings(raw: unknown): MenuSettings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return DEFAULT_MENU_SETTINGS
  const out: Record<string, unknown> = { ...DEFAULT_MENU_SETTINGS }
  const shape = menuSettingsSchema.shape
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!(key in shape)) continue
    const parsed = shape[key as keyof typeof shape].safeParse(value)
    if (parsed.success) out[key] = parsed.data
  }
  return out as MenuSettings
}

/** The colours a page renders with: theme tokens plus the owner's accent. */
export function menuPalette(settings: Pick<MenuSettings, 'theme' | 'accent'>): ThemeTokens & { onAccent: string } {
  const tokens = THEME_TOKENS[settings.theme] ?? THEME_TOKENS.minimal
  const accent = settings.accent ?? tokens.accent
  return { ...tokens, accent, onAccent: readableOn(accent) }
}

/** Black or white text, whichever reads better on the colour. */
export function readableOn(color: string): string {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color)
  if (!match) return '#ffffff'
  const [r, g, b] = match.slice(1).map((part) => {
    const channel = Number.parseInt(part, 16) / 255
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return luminance > 0.4 ? '#141414' : '#ffffff'
}

// ─── Opening hours ──────────────────────────────────────────────────────────

function minutes(value: string): number {
  const [h, m] = value.split(':').map(Number)
  return h * 60 + m
}

/** Tehran wall-clock minutes of the day. */
export function tehranMinutes(now: Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Tehran' }).formatToParts(now)
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0) % 24
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0)
  return hour * 60 + minute
}

/** Open right now? null when no hours are set. Handles past-midnight closing. */
export function openState(settings: Pick<MenuSettings, 'openAt' | 'closeAt'>, now: Date): { open: boolean; until: string } | null {
  if (!settings.openAt || !settings.closeAt) return null
  const current = tehranMinutes(now)
  const start = minutes(settings.openAt)
  const end = minutes(settings.closeAt)
  const open = start === end ? true : start < end ? current >= start && current < end : current >= start || current < end
  return { open, until: open ? settings.closeAt : settings.openAt }
}

// ─── Badges (from product tags) ─────────────────────────────────────────────

export type MenuBadge = 'chef' | 'new' | 'spicy' | 'veg' | 'popular'

export const BADGE_LABELS: Record<MenuBadge, string> = {
  chef: 'پیشنهاد سرآشپز',
  popular: 'پرطرفدار',
  new: 'جدید',
  spicy: 'تند',
  veg: 'گیاهی',
}

const BADGE_TAGS: Record<MenuBadge, RegExp> = {
  chef: /^(پیشنهاد\s*سرآشپز|پیشنهاد\s*ویژه|سرآشپز|chef'?s?\s*(pick|choice)?|signature)$/i,
  popular: /^(پرطرفدار|پرفروش|محبوب|popular|best\s*seller|bestseller)$/i,
  new: /^(جدید|تازه|new)$/i,
  spicy: /^(تند|spicy|hot)$/i,
  veg: /^(گیاهی|وگان|vegan|vegetarian|veg)$/i,
}

export function badgesFromTags(tags: string[]): MenuBadge[] {
  const found = new Set<MenuBadge>()
  for (const tag of tags) {
    for (const [badge, pattern] of Object.entries(BADGE_TAGS) as Array<[MenuBadge, RegExp]>) {
      if (pattern.test(tag.trim())) found.add(badge)
    }
  }
  return (Object.keys(BADGE_LABELS) as MenuBadge[]).filter((badge) => found.has(badge))
}

/** The tag a dashboard toggle writes for a badge. */
export function badgeTag(badge: MenuBadge): string {
  return BADGE_LABELS[badge]
}

/** Remove every tag that maps to this badge (so a toggle-off is clean). */
export function withoutBadge(tags: string[], badge: MenuBadge): string[] {
  return tags.filter((tag) => !BADGE_TAGS[badge].test(tag.trim()))
}

// ─── Table numbers (QR per table) ───────────────────────────────────────────

export function readTable(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw) return null
  const clean = raw.replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))).trim()
  return /^[A-Za-z0-9-]{1,8}$/.test(clean) ? clean : null
}
