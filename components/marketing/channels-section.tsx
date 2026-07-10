'use client'

import type { ComponentType } from 'react'
import { useTranslations } from 'next-intl'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import {
  Send,
  MessageCircle,
  Radio,
  MessageSquare,
  Globe,
  ShoppingBag,
  LayoutDashboard,
  MousePointerClick,
  UserPlus,
  Palette,
  Plug,
  Link2,
  Sparkles,
  ArrowUp,
  type LucideIcon,
} from 'lucide-react'
import { InstagramIcon } from './social-links'

type MarketingIcon = ComponentType<{ className?: string }>

const CHANNELS: { key: string; name: string; icon: MarketingIcon }[] = [
  { key: 'telegram', name: 'Telegram', icon: Send },
  { key: 'whatsapp', name: 'WhatsApp', icon: MessageCircle },
  { key: 'instagram', name: 'Instagram', icon: InstagramIcon },
  { key: 'rubika', name: 'Rubika', icon: Radio },
  { key: 'bale', name: 'Bale', icon: MessageSquare },
  { key: 'widget', name: 'Web Widget', icon: Globe },
  { key: 'woocommerce', name: 'WooCommerce', icon: ShoppingBag },
]

// Column centers for the converge SVG — 7 equal columns in a 600-unit box.
const BEAM_XS = [43, 129, 214, 300, 386, 471, 557]

// Per-connection customization chips — icons zip with the i18n `custom` array.
const CUSTOM_ICONS: LucideIcon[] = [MousePointerClick, UserPlus, Palette, Plug]

// Merged message streams shown as tiny channel dots inside the hub card.
const HUB_DOTS = ['bg-sky-500', 'bg-emerald-500', 'bg-pink-500', 'bg-violet-500']

export function ChannelsSection() {
  const t = useTranslations('marketing.channels')
  const customItems = t.raw('custom') as string[]

  return (
    <section className="border-y border-[var(--border-default)] bg-[var(--bg-base)] py-20 md:py-28">
      <div className="mx-auto max-w-5xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-1.5 text-xs tracking-wide text-[var(--text-secondary)]">
            {t('eyebrow')}
          </span>
          <h2 className="mt-6 text-4xl font-light tracking-tight text-[var(--text-primary)] md:text-5xl">
            {t('title')}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[var(--text-secondary)]">{t('subtitle')}</p>
        </motion.div>

        {/* Channel cards — one agent behind every one of them */}
        <div className="mt-14 grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-7 md:gap-4">
          {CHANNELS.map(({ key, name, icon: Icon }, i) => (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
              className={cn(
                'group flex flex-col items-center gap-2.5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] px-2 py-5 text-center transition-all hover:-translate-y-1 hover:border-[var(--border-strong)] hover:bg-[var(--white-05)]',
                i === CHANNELS.length - 1 && 'col-span-2 sm:col-span-1',
              )}
            >
              <Icon className="h-6 w-6 text-[var(--text-secondary)] transition-colors group-hover:text-[var(--text-primary)]" />
              <span className="text-xs font-medium text-[var(--text-primary)]">{name}</span>
            </motion.div>
          ))}
        </div>

        {/* Converging lines — every channel flows into one dashboard */}
        <div aria-hidden className="hidden md:block">
          <svg
            viewBox="0 0 600 96"
            preserveAspectRatio="none"
            fill="none"
            className="h-24 w-full"
          >
            {BEAM_XS.map((x, i) => (
              <motion.path
                key={x}
                d={`M ${x} 2 C ${x} 52, 300 40, 300 94`}
                stroke="var(--border-hover)"
                strokeWidth={1.2}
                vectorEffect="non-scaling-stroke"
                initial={{ pathLength: 0, opacity: 0 }}
                whileInView={{ pathLength: 1, opacity: 1 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.9, delay: 0.15 + i * 0.08, ease: 'easeInOut' }}
              />
            ))}
          </svg>
        </div>
        {/* Mobile connector — a single quiet line */}
        <div
          aria-hidden
          className="mx-auto h-10 w-px bg-gradient-to-b from-transparent to-[var(--border-hover)] md:hidden"
        />

        {/* The hub — one dashboard receiving every stream */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.55, delay: 0.35 }}
          className="flex justify-center"
        >
          <div className="inline-flex items-center gap-4 rounded-2xl border border-[var(--border-hover)] bg-[var(--bg-surface)] px-6 py-4 shadow-[0_8px_30px_rgba(var(--ink-rgb),0.06)]">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--white)] text-[var(--bg-base)]">
              <LayoutDashboard className="h-5 w-5" />
            </span>
            <span className="flex flex-col">
              <span className="text-sm font-medium text-[var(--text-primary)]">
                {t('hubTitle')}
              </span>
              <span className="mt-0.5 text-[11px] text-[var(--text-muted)]">{t('hubDesc')}</span>
            </span>
            <span className="ms-2 flex items-center gap-1" aria-hidden>
              {HUB_DOTS.map((c, i) => (
                <motion.span
                  key={c}
                  className={`h-1.5 w-1.5 rounded-full ${c}`}
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 2, repeat: Infinity, delay: i * 0.35 }}
                />
              ))}
            </span>
          </div>
        </motion.div>

        {/* Customization strip — what you can tune per connection */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.55, delay: 0.15 }}
          className="mt-14 text-center"
        >
          <p className="text-xs tracking-wide text-[var(--text-muted)]">{t('customTitle')}</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {customItems.map((label, i) => {
              const Icon = CUSTOM_ICONS[i] ?? Plug
              return (
                <span
                  key={label}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--white-05)] px-4 py-2 text-xs text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </span>
              )
            })}
          </div>
        </motion.div>

        <ChatLinkHighlight />
      </div>
    </section>
  )
}

/** Featured "Chat Link" block — the link-in-bio use case with a phone mock. */
function ChatLinkHighlight() {
  const t = useTranslations('marketing.channels')
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6 }}
      className="mt-16 overflow-hidden rounded-3xl border border-[var(--border-hover)] bg-[var(--bg-surface)]"
    >
      <div className="grid items-center gap-8 p-7 md:grid-cols-2 md:p-10">
        {/* Copy */}
        <div className="text-center md:text-start">
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--white-05)] px-3.5 py-1.5 text-xs text-[var(--text-secondary)]">
            <Link2 className="h-3.5 w-3.5" />
            {t('chatLinkTitle')}
          </span>
          <p className="mx-auto mt-5 max-w-md text-lg font-light leading-8 text-[var(--text-primary)] md:mx-0">
            {t('chatLinkDesc')}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 md:justify-start">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-full bg-[var(--white)] px-5 py-2.5 text-sm font-medium text-[var(--bg-base)] transition-transform hover:-translate-y-0.5"
            >
              <Sparkles className="h-4 w-4" />
              {t('chatLinkCta')}
            </Link>
            <span
              dir="ltr"
              className="inline-flex items-center rounded-full border border-[var(--border-default)] bg-[var(--bg-base)] px-4 py-2.5 text-xs text-[var(--text-muted)]"
            >
              vigent.ir/c/your-shop
            </span>
          </div>
        </div>

        {/* Phone mock */}
        <div className="flex justify-center">
          <div className="relative w-[210px] overflow-hidden rounded-[2rem] border-[6px] border-[var(--border-strong)] bg-[var(--bg-base)] shadow-[0_20px_60px_rgba(var(--ink-rgb),0.12)]">
            <div className="flex h-[380px] flex-col">
              {/* header */}
              <div className="flex items-center gap-2 border-b border-[var(--border-default)] px-3 py-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--white)] text-[10px] font-semibold text-[var(--bg-base)]">
                  V
                </span>
                <div>
                  <div className="text-[11px] font-semibold text-[var(--text-primary)]">
                    Vigent
                  </div>
                  <div className="flex items-center gap-1 text-[8px] text-[var(--text-muted)]">
                    <span className="h-1 w-1 rounded-full bg-emerald-500" />
                    آنلاین
                  </div>
                </div>
              </div>
              {/* body */}
              <div className="flex flex-1 flex-col justify-end gap-2 p-3">
                <div className="max-w-[80%] self-start rounded-2xl rounded-ss-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 text-[10px] leading-5 text-[var(--text-primary)]">
                  سلام! چطور می‌تونم کمکتون کنم؟
                </div>
                <div className="max-w-[80%] self-end rounded-2xl rounded-ee-md bg-[var(--white)] px-3 py-2 text-[10px] leading-5 text-[var(--bg-base)]">
                  قیمت اشتراک چنده؟
                </div>
                <motion.div
                  className="flex w-11 items-center justify-center gap-1 self-start rounded-2xl rounded-ss-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2.5"
                  aria-hidden
                >
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="h-1 w-1 rounded-full bg-[var(--text-muted)]"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
                    />
                  ))}
                </motion.div>
              </div>
              {/* composer */}
              <div className="flex items-center gap-1.5 border-t border-[var(--border-default)] p-2.5">
                <div className="flex-1 rounded-full border border-[var(--border-default)] px-3 py-1.5 text-[9px] text-[var(--text-muted)]">
                  پیام خود را بنویسید…
                </div>
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--white)] text-[var(--bg-base)]">
                  <ArrowUp className="h-3 w-3" />
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
