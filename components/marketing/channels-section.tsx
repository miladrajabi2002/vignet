'use client'

import { useTranslations } from 'next-intl'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
  Send,
  MessageCircle,
  Camera,
  Radio,
  MessageSquare,
  Globe,
  ShoppingBag,
  LayoutDashboard,
  MousePointerClick,
  UserPlus,
  Palette,
  Plug,
  type LucideIcon,
} from 'lucide-react'

const CHANNELS: { key: string; name: string; icon: LucideIcon }[] = [
  { key: 'telegram', name: 'Telegram', icon: Send },
  { key: 'whatsapp', name: 'WhatsApp', icon: MessageCircle },
  { key: 'instagram', name: 'Instagram', icon: Camera },
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
      </div>
    </section>
  )
}
