'use client'

import { useState, type ReactNode } from 'react'
import { useLocale } from 'next-intl'
import { SendHorizontal } from 'lucide-react'
import { CHANNEL_TONES, type ChannelKey } from '@/components/ui/channel-mark'
import { cn } from '@/lib/utils'

/**
 * The body of a connection sheet: what the owner does on one side, and a
 * «stage» showing how the agent looks in that channel on the other. The stage
 * is what keeps a not-yet-connected channel from opening onto three lines of
 * text — there is always the thing itself to look at.
 *
 * Below `lg` the two stack; `stageOnMobile` says whether the stage leads,
 * trails or steps aside there.
 */
export function ChannelLayout({
  children,
  stage,
  stageWidth = 'sm',
  stageOnMobile = 'last',
}: {
  children: ReactNode
  stage: ReactNode
  /** `md` fits the web widget mock, which has a fixed-width panel. */
  stageWidth?: 'sm' | 'md'
  stageOnMobile?: 'first' | 'last' | 'hidden'
}) {
  return (
    <div
      className={cn(
        'grid gap-6 lg:gap-7',
        stageWidth === 'md' ? 'lg:grid-cols-[minmax(0,1fr)_22.5rem]' : 'lg:grid-cols-[minmax(0,1fr)_19rem]',
      )}
    >
      <div className="min-w-0 space-y-6">{children}</div>
      <aside
        className={cn(
          'min-w-0 lg:sticky lg:top-0 lg:order-none lg:block lg:self-start',
          stageOnMobile === 'first' && 'order-first',
          stageOnMobile === 'hidden' && 'hidden',
        )}
      >
        {stage}
      </aside>
    </div>
  )
}

/** Title + one line of why, the opening of every not-yet-connected sheet. */
export function ChannelLead({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h3 className="text-base font-bold tracking-tight text-[var(--text-primary)]">{title}</h3>
      <p className="mt-1 text-sm leading-7 text-[var(--text-secondary)]">{body}</p>
    </div>
  )
}

export function ChannelSection({
  title,
  hint,
  action,
  children,
}: {
  title: string
  hint?: string
  /** Sits on the title row — a save status, a link. */
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <h4 className="text-sm font-bold text-[var(--text-primary)]">{title}</h4>
          {hint && <p className="mt-0.5 text-xs leading-6 text-[var(--text-secondary)]">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

/** One number the owner cares about, with what it counts. */
export function ChannelStat({ label, value, tone }: { label: string; value: ReactNode; tone?: 'danger' }) {
  return (
    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-base)] px-4 py-3">
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
      <p className={cn('mt-1 text-base font-bold tabular-nums', tone === 'danger' ? 'text-danger' : 'text-[var(--text-primary)]')}>
        {value}
      </p>
    </div>
  )
}

/**
 * Numbered steps on a rail. A step can carry its own control (a link out, the
 * token field), so the instruction and the thing it asks for sit together.
 */
export function StepList({ steps, label }: { steps: { text: ReactNode; extra?: ReactNode }[]; label?: string }) {
  const nf = new Intl.NumberFormat(useLocale() === 'en' ? 'en-US' : 'fa-IR')
  return (
    <ol aria-label={label}>
      {steps.map((step, index) => (
        <li key={index} className="relative flex gap-3.5 pb-5 last:pb-0">
          {index < steps.length - 1 && (
            <span aria-hidden className="absolute bottom-1 start-[13px] top-8 w-px bg-[var(--border-default)]" />
          )}
          <span
            aria-hidden
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#111] text-xs font-bold tabular-nums text-white"
          >
            {nf.format(index + 1)}
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-sm leading-7 text-[var(--text-primary)]">{step.text}</p>
            {step.extra && <div className="mt-2.5">{step.extra}</div>}
          </div>
        </li>
      ))}
    </ol>
  )
}

/**
 * A conversation in the channel's own colours, from the customer's side: the
 * agent's name, its real welcome message and the reply buttons the owner has
 * defined. Not a pixel copy of any app — a truthful sketch of what a customer
 * meets. Below `lg` it folds to the header, the welcome and the buttons.
 */
export function ChatMock({
  channel,
  name,
  handle,
  avatar,
  greeting,
  welcome,
  buttons = [],
  botLabel,
  composerLabel,
  caption,
}: {
  channel: ChannelKey
  name: string
  /** The connected account, shown under the name once there is one. */
  handle?: string | null
  avatar?: string | null
  /** What the customer writes first. */
  greeting: string
  welcome: string
  buttons?: string[]
  botLabel: string
  composerLabel: string
  caption: string
}) {
  const tone = CHANNEL_TONES[channel] ?? CHANNEL_TONES.API
  const Icon = tone.icon
  const [failedAvatar, setFailedAvatar] = useState<string | null>(null)
  const showAvatar = !!avatar && failedAvatar !== avatar
  const shown = buttons.map((item) => item.trim()).filter(Boolean).slice(0, 4)

  return (
    <figure className="m-0">
      <div className="overflow-hidden rounded-[1.375rem] border border-[var(--border-default)] bg-white shadow-[var(--elev-1)]">
        <div className="flex items-center gap-2.5 border-b border-[var(--border-subtle)] px-3.5 py-3">
          {showAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatar ?? ''}
              alt=""
              width={36}
              height={36}
              loading="lazy"
              decoding="async"
              onError={() => setFailedAvatar(avatar ?? null)}
              className="h-9 w-9 shrink-0 rounded-full border border-[var(--border-default)] object-cover"
            />
          ) : (
            <span
              aria-hidden
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold text-white"
              style={{ background: tone.color }}
            >
              {(name || '؟').trim().charAt(0)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold text-[var(--text-primary)]">{name}</p>
            <p className="truncate text-[11px] text-[var(--text-muted)]">
              <bdi>{handle ? `@${handle}` : botLabel}</bdi>
            </p>
          </div>
          <span aria-hidden style={{ color: tone.color }}>
            <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </span>
        </div>

        {/* Physical sides on purpose: the customer's own message sits on the
            right in every one of these apps, whatever the reading direction. */}
        <div className="space-y-2 px-3 py-3.5" style={{ background: tone.tint }}>
          <p
            dir="auto"
            className="ml-auto hidden w-fit max-w-[82%] rounded-2xl rounded-br-md px-3 py-1.5 text-[12.5px] leading-6 text-white lg:block"
            style={{ background: tone.color }}
          >
            {greeting}
          </p>
          <div className="mr-auto w-fit max-w-[88%] space-y-1.5">
            <p
              dir="auto"
              className="line-clamp-5 whitespace-pre-line rounded-2xl rounded-bl-md bg-white px-3 py-1.5 text-[12.5px] leading-6 text-[var(--text-primary)] shadow-[var(--elev-1)]"
            >
              {welcome}
            </p>
            {shown.length > 0 && (
              <div className="grid grid-cols-2 gap-1.5">
                {shown.map((item, index) => (
                  <span
                    key={index}
                    dir="auto"
                    className={cn(
                      'truncate rounded-xl border border-black/5 bg-white/75 px-2 py-1.5 text-center text-[11.5px] font-semibold',
                      shown.length % 2 === 1 && index === shown.length - 1 && 'col-span-2',
                    )}
                    style={{ color: tone.color }}
                  >
                    {item}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="hidden items-center gap-2 border-t border-[var(--border-subtle)] px-3 py-2.5 lg:flex" aria-hidden>
          <span className="flex-1 rounded-full bg-[var(--bg-muted)] px-3.5 py-2 text-[12px] text-[var(--text-muted)]">
            {composerLabel}
          </span>
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white" style={{ background: tone.color }}>
            <SendHorizontal className="h-4 w-4 rtl:rotate-180" />
          </span>
        </div>
      </div>
      <figcaption className="mt-2.5 text-center text-xs leading-6 text-[var(--text-muted)]">{caption}</figcaption>
    </figure>
  )
}
