import { cn } from '@/lib/utils'

/**
 * Class names and helpers shared by the WooCommerce surfaces. A plain module
 * (no 'use client') so server pages such as Products and Integrations can
 * use the same card, tint and button classes as the client components.
 */

// ─── Surfaces & buttons ─────────────────────────────────────────────────

export const WOO_CARD =
    'rounded-card bg-white shadow-[0_0_0_1px_rgba(17,17,17,0.06),0_1px_2px_rgba(17,17,17,0.04),0_10px_28px_-14px_rgba(17,17,17,0.14)]'

const BTN =
    'inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 text-[13px] font-bold transition-[opacity,box-shadow,background-color,color] disabled:cursor-not-allowed disabled:opacity-50'

export const WOO_BTN_PRIMARY = cn(
    BTN,
    'bg-[var(--text-primary)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_6px_14px_-8px_rgba(17,17,17,0.6)] hover:opacity-90',
)
export const WOO_BTN_SECONDARY = cn(
    BTN,
    'bg-white text-[var(--text-primary)] shadow-[0_0_0_1px_var(--border-default),0_1px_2px_rgba(17,17,17,0.05)] hover:shadow-[0_0_0_1px_var(--border-hover),0_1px_2px_rgba(17,17,17,0.05)]',
)
export const WOO_BTN_GHOST = cn(BTN, 'px-3 text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]')

/** The faint WooCommerce violet — the store's avatar and the tab icon only. */
export const WOO_TINT = 'bg-[#f2edf9] text-[#7f54b3] shadow-[inset_0_0_0_1px_rgba(127,84,179,0.18)]'

export const WOO_TEXT = 'text-[13.5px] leading-[1.9] text-[var(--text-secondary)]'
export const WOO_NOTE = 'text-[12.5px] leading-[1.8] text-[var(--text-muted)]'

/** `https://www.shop.ir/` → `www.shop.ir` — the address people recognise. */
export function storeHost(storeUrl: string): string {
    return storeUrl.replace(/^https?:\/\//i, '').replace(/\/+$/, '')
}

/** A card that opens another page: lifts a pixel and deepens its shadow on hover. */
export const WOO_LINK_CARD = cn(
    WOO_CARD,
    'transition-[transform,box-shadow] hover:-translate-y-px hover:shadow-[0_0_0_1px_rgba(17,17,17,0.1),0_1px_2px_rgba(17,17,17,0.04),0_14px_30px_-14px_rgba(17,17,17,0.22)] motion-reduce:transform-none',
)
