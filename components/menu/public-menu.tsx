'use client'

/* eslint-disable @next/next/no-img-element -- menu photos come from arbitrary store/upload hosts. */

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Clock, ImageOff, MapPin, Megaphone, Minus, Phone, Plus, Search, ShoppingBag, Sparkles, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { normalizePersian } from '@/lib/search/persian'
import { BADGE_LABELS, menuPalette, openState, type MenuBadge } from '@/lib/menu/settings'
import type { PublicMenuData, PublicMenuItem, PublicMenuVariant } from '@/lib/menu/public-data'

const fa = (value: number) => Math.round(value).toLocaleString('fa-IR')
const faDigits = (value: string) => value.replace(/\d/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)])

type MenuPick = { id: string; variantId: number | null; qty: number }

/*
 * One component for the customer's menu and the dashboard's live preview.
 * `preview` renders the same page inside the phone frame: no dialogs, no
 * storage, no scroll-spy (the frame is its own scroller).
 */
export function PublicMenu({ data, preview = false }: { data: PublicMenuData; preview?: boolean }) {
  const { settings } = data
  const palette = menuPalette(settings)
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [active, setActive] = useState(data.sections[0]?.key ?? '')
  const [open, setOpen] = useState<PublicMenuItem | null>(null)
  const [picksOpen, setPicksOpen] = useState(false)
  const [picks, setPicks] = useState<MenuPick[]>([])
  const [bump, setBump] = useState(0)
  const [status, setStatus] = useState<ReturnType<typeof openState>>(null)
  const chipBar = useRef<HTMLDivElement>(null)
  const storageKey = `vg-menu-picks:${data.slug}`

  // Opening status is wall-clock dependent: computed after mount (no SSR mismatch).
  useEffect(() => {
    const tick = () => setStatus(openState(settings, new Date()))
    tick()
    const timer = window.setInterval(tick, 60_000)
    return () => window.clearInterval(timer)
  }, [settings])

  useEffect(() => {
    if (preview) return
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? '[]') as MenuPick[]
      if (Array.isArray(saved)) setPicks(saved.filter((pick) => pick && typeof pick.id === 'string' && pick.qty > 0).slice(0, 40))
    } catch { /* storage unavailable: picks live in memory */ }
  }, [preview, storageKey])

  const savePicks = useCallback((next: MenuPick[]) => {
    setPicks(next)
    try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch { /* ignore */ }
  }, [storageKey])

  const allItems = useMemo(() => new Map(data.sections.flatMap((section) => section.items.map((item) => [item.id, item] as const))), [data.sections])

  const sections = useMemo(() => {
    const needle = normalizePersian(query.trim())
    if (!needle) return data.sections
    return data.sections
      .map((section) => ({ ...section, items: section.items.filter((item) => normalizePersian(`${item.name} ${item.description ?? ''} ${section.name}`).includes(needle)) }))
      .filter((section) => section.items.length)
  }, [data.sections, query])

  const featured = useMemo(
    () => data.sections.flatMap((section) => section.items).filter((item) => !item.soldOut && (item.badges.includes('chef') || item.badges.includes('popular'))).slice(0, 8),
    [data.sections],
  )

  // Scroll-spy: the section crossing the upper third of the screen is active.
  useEffect(() => {
    if (preview || query) return
    const headings = data.sections.map((section) => document.getElementById(`menu-${section.key}`)).filter((node): node is HTMLElement => Boolean(node))
    if (!headings.length || !('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
      if (visible) setActive(visible.target.id.replace(/^menu-/, ''))
    }, { rootMargin: '-30% 0px -60% 0px' })
    headings.forEach((heading) => observer.observe(heading))
    return () => observer.disconnect()
  }, [data.sections, preview, query])

  useEffect(() => {
    const chip = chipBar.current?.querySelector<HTMLElement>(`[data-key="${active}"]`)
    chip?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }, [active])

  const jump = (key: string) => {
    setActive(key)
    if (preview) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    document.getElementById(`menu-${key}`)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }

  const addPick = (item: PublicMenuItem, variantId: number | null, qty = 1) => {
    if (preview || item.soldOut) return
    const existing = picks.find((pick) => pick.id === item.id && pick.variantId === variantId)
    savePicks(existing
      ? picks.map((pick) => (pick === existing ? { ...pick, qty: Math.min(pick.qty + qty, 20) } : pick))
      : [...picks, { id: item.id, variantId, qty }])
    setBump((value) => value + 1)
  }

  const pickLines = picks.flatMap((pick) => {
    const item = allItems.get(pick.id)
    if (!item) return []
    const variant = pick.variantId != null ? item.variants.find((row) => row.id === pick.variantId) ?? null : null
    const unit = variant?.price ?? item.price
    return [{ pick, item, variant, unit }]
  })
  const pickCount = pickLines.reduce((sum, line) => sum + line.pick.qty, 0)
  const pickTotal = pickLines.every((line) => line.unit != null) ? pickLines.reduce((sum, line) => sum + (line.unit ?? 0) * line.pick.qty, 0) : null

  const askUrl = (text: string) => (!data.chatUrl ? null : text ? `${data.chatUrl}?q=${encodeURIComponent(text.slice(0, 300))}` : data.chatUrl)
  const tablePrefix = data.table ? `میز ${faDigits(data.table)}: ` : ''
  const orderText = pickLines.length
    ? `${tablePrefix}می‌خوام سفارش بدم:\n${pickLines.map((line) => `${faDigits(String(line.pick.qty))}× ${line.item.name}${line.variant ? ` (${line.variant.label})` : ''}`).join('\n')}`
    : ''

  const vars = {
    '--m-bg': palette.bg,
    '--m-surface': palette.surface,
    '--m-ink': palette.ink,
    '--m-muted': palette.muted,
    '--m-line': palette.line,
    '--m-accent': palette.accent,
    '--m-on-accent': palette.onAccent,
    colorScheme: palette.dark ? 'dark' : 'light',
  } as CSSProperties

  const hasItems = data.sections.length > 0
  const showAsk = settings.showAsk && Boolean(data.chatUrl)

  return (
    <div dir="rtl" className={cn('pm relative min-h-full bg-[var(--m-bg)] text-[var(--m-ink)] antialiased', preview ? 'pm-preview' : 'min-h-dvh')} style={vars}>
      <style>{MENU_CSS}</style>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <header className="relative">
        <div className={cn('relative overflow-hidden', settings.coverImage ? 'h-[200px] sm:h-[300px]' : 'h-[132px] sm:h-[180px]')}>
          {settings.coverImage ? (
            <img src={settings.coverImage} alt="" className="pm-cover h-full w-full object-cover" />
          ) : (
            <div aria-hidden className="pm-pattern h-full w-full" />
          )}
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[var(--m-bg)] via-transparent to-black/25" />
          <div className="absolute inset-x-0 top-0 mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 pt-[max(0.9rem,env(safe-area-inset-top))]">
            {data.table ? <span className="pm-glass rounded-full px-3 py-1 text-[12px] font-bold">میز {faDigits(data.table)}</span> : <span />}
            {status && (
              <span className="pm-glass inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-bold">
                <span className={cn('h-2 w-2 rounded-full', status.open ? 'bg-emerald-400 pm-live' : 'bg-rose-400')} />
                {status.open ? `باز است تا ${faDigits(status.until)}` : `بسته؛ از ${faDigits(status.until)} باز می‌شود`}
              </span>
            )}
          </div>
        </div>

        <div className="pm-rise relative mx-auto -mt-12 max-w-5xl px-4 sm:-mt-16">
          <div className="flex items-end gap-3.5">
            {settings.logo ? (
              <img src={settings.logo} alt={`لوگوی ${data.name}`} className="h-[76px] w-[76px] shrink-0 rounded-[22px] border-4 border-[var(--m-bg)] bg-[var(--m-surface)] object-cover shadow-lg sm:h-24 sm:w-24" />
            ) : (
              <span className="grid h-[76px] w-[76px] shrink-0 place-items-center rounded-[22px] border-4 border-[var(--m-bg)] bg-[var(--m-accent)] text-3xl font-bold text-[var(--m-on-accent)] shadow-lg sm:h-24 sm:w-24">{data.name.trim().charAt(0)}</span>
            )}
            <div className="min-w-0 pb-1">
              <h1 className="text-[26px] font-bold leading-tight tracking-tight sm:text-[34px]">{data.name}</h1>
              {settings.tagline && <p className="mt-1 text-[13.5px] leading-6 text-[var(--m-muted)] sm:text-[15px]">{settings.tagline}</p>}
            </div>
          </div>

          <ul className="mt-4 flex flex-wrap gap-2 text-[12.5px]">
            {settings.openAt && settings.closeAt && (
              <InfoChip icon={<Clock className="h-3.5 w-3.5" />}>هر روز {faDigits(settings.openAt)} تا {faDigits(settings.closeAt)}</InfoChip>
            )}
            {settings.address && (
              <InfoChip icon={<MapPin className="h-3.5 w-3.5" />} href={settings.mapUrl || undefined}>{settings.address}</InfoChip>
            )}
            {settings.phone && (
              <InfoChip icon={<Phone className="h-3.5 w-3.5" />} href={`tel:${settings.phone.replace(/[^\d+]/g, '')}`}><span dir="ltr">{faDigits(settings.phone)}</span></InfoChip>
            )}
            {settings.instagram && (
              <InfoChip icon={<span className="text-[13px] font-bold leading-none">@</span>} href={`https://instagram.com/${settings.instagram.replace(/^@/, '')}`}>
                <span dir="ltr">{settings.instagram.replace(/^@/, '')}</span>
              </InfoChip>
            )}
          </ul>

          {settings.notice && (
            <p className="mt-4 flex items-start gap-2 rounded-2xl bg-[color-mix(in_srgb,var(--m-accent)_12%,var(--m-surface))] px-3.5 py-2.5 text-[13px] leading-6">
              <Megaphone className="mt-1 h-4 w-4 shrink-0 text-[var(--m-accent)]" />{settings.notice}
            </p>
          )}
        </div>
      </header>

      {/* ── Category bar + search ────────────────────────────── */}
      {hasItems && (
        <nav aria-label="دسته‌بندی‌های منو" className="pm-bar sticky top-0 z-20 mt-5 border-b border-[var(--m-line)]">
          <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-2.5">
            {settings.showSearch && (
              searching ? (
                <label className="relative flex min-w-0 flex-1 items-center">
                  <span className="sr-only">جستجو در منو</span>
                  <Search className="pointer-events-none absolute start-3 h-4 w-4 text-[var(--m-muted)]" aria-hidden />
                  <input
                    id="menu-search"
                    autoFocus={!preview}
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="چی میل دارید؟"
                    className="h-10 w-full rounded-full border border-[var(--m-line)] bg-[var(--m-surface)] ps-9 pe-10 text-[14px] text-[var(--m-ink)] outline-none placeholder:text-[var(--m-muted)] focus:border-[var(--m-accent)]"
                  />
                  <button type="button" onClick={() => { setQuery(''); setSearching(false) }} aria-label="بستن جستجو" className="absolute end-1 grid h-8 w-8 place-items-center rounded-full text-[var(--m-muted)]">
                    <X className="h-4 w-4" />
                  </button>
                </label>
              ) : (
                <button type="button" onClick={() => setSearching(true)} aria-label="جستجو در منو" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[var(--m-line)] bg-[var(--m-surface)]">
                  <Search className="h-4 w-4" />
                </button>
              )
            )}
            {!searching && (
              <div ref={chipBar} className="pm-chips flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
                {data.sections.map((section) => (
                  <button
                    key={section.key}
                    type="button"
                    data-key={section.key}
                    onClick={() => jump(section.key)}
                    aria-current={active === section.key ? 'true' : undefined}
                    className={cn(
                      'h-10 shrink-0 rounded-full px-4 text-[13.5px] font-bold transition-colors',
                      active === section.key ? 'bg-[var(--m-accent)] text-[var(--m-on-accent)]' : 'text-[var(--m-muted)] hover:text-[var(--m-ink)]',
                    )}
                  >
                    {section.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </nav>
      )}

      {/* ── Menu ─────────────────────────────────────────────── */}
      <main className="mx-auto max-w-5xl px-4 pb-8 pt-5">
        {!hasItems ? (
          <div className="rounded-3xl border border-dashed border-[var(--m-line)] p-12 text-center">
            <p className="font-bold">منو در حال آماده‌سازی است</p>
            <p className="mt-1 text-sm text-[var(--m-muted)]">به‌زودی آیتم‌ها اینجا نمایش داده می‌شوند.</p>
          </div>
        ) : (
          <div className="space-y-9">
            {!query && featured.length > 1 && settings.layout !== 'classic' && (
              <section aria-labelledby="menu-featured">
                <h2 id="menu-featured" className="mb-3 flex items-center gap-2 text-[18px] font-bold"><Sparkles className="h-4 w-4 text-[var(--m-accent)]" />پیشنهاد ما</h2>
                <div className="pm-chips -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
                  {featured.map((item) => (
                    <button key={item.id} type="button" onClick={() => !preview && setOpen(item)} className="pm-card w-[210px] shrink-0 snap-start overflow-hidden rounded-3xl border border-[var(--m-line)] bg-[var(--m-surface)] text-start">
                      <Photo item={item} className="aspect-[4/3] w-full" />
                      <div className="p-3">
                        <p className="truncate font-bold">{item.name}</p>
                        <Price item={item} className="mt-1" />
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {sections.map((section) => (
              <section key={section.key} aria-labelledby={`menu-${section.key}`}>
                <div className="mb-3 flex items-baseline gap-2">
                  <h2 id={`menu-${section.key}`} className="scroll-mt-20 text-[20px] font-bold tracking-tight">{section.name}</h2>
                  <span className="text-[12px] text-[var(--m-muted)]">{fa(section.items.length)} آیتم</span>
                </div>
                {settings.layout === 'classic' ? (
                  <ul className="divide-y divide-[var(--m-line)] rounded-3xl border border-[var(--m-line)] bg-[var(--m-surface)] px-4">
                    {section.items.map((item) => (
                      <li key={item.id}>
                        <button type="button" onClick={() => !preview && setOpen(item)} className={cn('block w-full py-3.5 text-start', item.soldOut && 'opacity-50')}>
                          <span className="flex items-baseline gap-2">
                            <span className="font-bold">{item.name}</span>
                            <span aria-hidden className="pm-leader min-w-4 flex-1" />
                            <Price item={item} compact />
                          </span>
                          {item.description && <span className="mt-1 block text-[12.5px] leading-6 text-[var(--m-muted)]">{item.description}</span>}
                          <Badges badges={item.badges} soldOut={item.soldOut} className="mt-1.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : settings.layout === 'grid' ? (
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                    {section.items.map((item) => (
                      <article key={item.id} className={cn('pm-card relative overflow-hidden rounded-3xl border border-[var(--m-line)] bg-[var(--m-surface)]', item.soldOut && 'opacity-60')}>
                        <button type="button" onClick={() => !preview && setOpen(item)} className="block w-full text-start">
                          <Photo item={item} className="aspect-square w-full sm:aspect-[4/3]" />
                          <div className="p-3 pb-12">
                            <h3 className="line-clamp-2 text-[14.5px] font-bold leading-6">{item.name}</h3>
                            <Badges badges={item.badges} soldOut={item.soldOut} className="mt-1" />
                            {item.description && <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-[var(--m-muted)]">{item.description}</p>}
                          </div>
                        </button>
                        <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2">
                          <Price item={item} />
                          {!item.soldOut && item.variants.length === 0 && <AddButton onAdd={() => addPick(item, null)} label={item.name} />}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {section.items.map((item) => (
                      <article key={item.id} className={cn('pm-card relative flex gap-3 rounded-3xl border border-[var(--m-line)] bg-[var(--m-surface)] p-3', item.soldOut && 'opacity-60')}>
                        <button type="button" onClick={() => !preview && setOpen(item)} className="flex min-w-0 flex-1 gap-3 text-start">
                          <div className="flex min-w-0 flex-1 flex-col py-0.5">
                            <h3 className="text-[15px] font-bold leading-6">{item.name}</h3>
                            <Badges badges={item.badges} soldOut={item.soldOut} className="mt-1" />
                            {item.description && <p className="mt-1 line-clamp-2 text-[12.5px] leading-6 text-[var(--m-muted)]">{item.description}</p>}
                            <Price item={item} className="mt-auto pt-2" />
                          </div>
                          <Photo item={item} className="h-[104px] w-[104px] shrink-0 rounded-2xl" />
                        </button>
                        {!item.soldOut && item.variants.length === 0 && (
                          <div className="absolute bottom-2 end-2"><AddButton onAdd={() => addPick(item, null)} label={item.name} /></div>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </section>
            ))}
            {query && !sections.length && (
              <p className="py-10 text-center text-sm text-[var(--m-muted)]">چیزی با «{query}» پیدا نشد.</p>
            )}
          </div>
        )}
        <footer className="pt-12 text-center text-[12px] text-[var(--m-muted)]">
          منوی دیجیتال با <a href="https://vigent.ir" className="font-bold underline-offset-4 hover:underline">ویجنت</a>
        </footer>
      </main>

      {/* ── Bottom actions ───────────────────────────────────── */}
      {(showAsk || pickCount > 0) && (
        <div className="pointer-events-none sticky bottom-0 z-30 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto flex max-w-md items-center justify-center gap-2">
            {pickCount > 0 && (
              <button key={bump} type="button" onClick={() => setPicksOpen(true)} className="pm-pop pointer-events-auto inline-flex h-12 items-center gap-2 rounded-full bg-[var(--m-ink)] px-5 text-[14px] font-bold text-[var(--m-bg)] shadow-xl">
                <ShoppingBag className="h-4 w-4" />انتخاب‌های من · {fa(pickCount)}
              </button>
            )}
            {showAsk && (
              <a
                href={askUrl(data.table ? `${tablePrefix}سلام، یه سؤال درباره منو دارم` : '') ?? '#'}
                className="pm-ask pointer-events-auto relative inline-flex h-12 items-center gap-2 overflow-hidden rounded-full bg-[var(--m-accent)] px-5 text-[14px] font-bold text-[var(--m-on-accent)] shadow-xl"
              >
                <Sparkles className="h-4 w-4" />از منو بپرس
              </a>
            )}
          </div>
        </div>
      )}

      {!preview && open && (
        <ItemSheet
          item={open}
          onClose={() => setOpen(null)}
          onAdd={(variantId, qty) => { addPick(open, variantId, qty); setOpen(null) }}
          askHref={askUrl(`${tablePrefix}درباره «${open.name}» سؤال دارم: `)}
        />
      )}
      {!preview && picksOpen && (
        <Sheet title="انتخاب‌های من" onClose={() => setPicksOpen(false)}>
          {pickLines.length ? (
            <>
              <ul className="divide-y divide-[var(--m-line)]">
                {pickLines.map((line) => (
                  <li key={`${line.item.id}:${line.variant?.id ?? ''}`} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold">{line.item.name}</p>
                      {line.variant && <p className="text-[12.5px] text-[var(--m-muted)]">{line.variant.label}</p>}
                      {line.unit != null && <p className="text-[12.5px] tabular-nums text-[var(--m-muted)]">{fa(line.unit * line.pick.qty)} تومان</p>}
                    </div>
                    <Stepper
                      value={line.pick.qty}
                      onChange={(qty) => savePicks(qty > 0 ? picks.map((pick) => (pick === line.pick ? { ...pick, qty } : pick)) : picks.filter((pick) => pick !== line.pick))}
                    />
                  </li>
                ))}
              </ul>
              {pickTotal != null && (
                <p className="mt-2 flex items-center justify-between border-t border-[var(--m-line)] pt-3 text-[15px] font-bold">
                  <span>جمع</span><span className="tabular-nums">{fa(pickTotal)} تومان</span>
                </p>
              )}
              <p className="mt-3 text-[12.5px] leading-6 text-[var(--m-muted)]">این فهرست را به گارسون نشان دهید{data.chatUrl ? '، یا همین‌جا در گفتگو بفرستید.' : '.'}</p>
              {data.chatUrl && (
                <a href={askUrl(orderText) ?? '#'} className="mt-3 flex h-12 items-center justify-center gap-2 rounded-2xl bg-[var(--m-accent)] text-[14px] font-bold text-[var(--m-on-accent)]">
                  <Sparkles className="h-4 w-4" />ارسال در گفتگو
                </a>
              )}
              <button type="button" onClick={() => savePicks([])} className="mt-2 h-11 w-full rounded-2xl text-[13px] font-bold text-[var(--m-muted)]">خالی کردن فهرست</button>
            </>
          ) : (
            <p className="py-8 text-center text-sm text-[var(--m-muted)]">هنوز چیزی انتخاب نکرده‌اید.</p>
          )}
        </Sheet>
      )}
    </div>
  )
}

function InfoChip({ icon, href, children }: { icon: ReactNode; href?: string; children: ReactNode }) {
  const body = <>{icon}<span className="truncate">{children}</span></>
  const cls = 'inline-flex max-w-full min-h-9 items-center gap-1.5 rounded-full border border-[var(--m-line)] bg-[var(--m-surface)] px-3 text-[var(--m-ink)]'
  return <li className="min-w-0 max-w-full">{href ? <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className={cls}>{body}</a> : <span className={cls}>{body}</span>}</li>
}

function Photo({ item, className }: { item: PublicMenuItem; className?: string }) {
  return item.image ? (
    <img src={item.image} alt={item.name} loading="lazy" decoding="async" className={cn('bg-[var(--m-line)] object-cover', item.soldOut && 'grayscale', className)} />
  ) : (
    <span aria-hidden className={cn('pm-noimg grid place-items-center text-[var(--m-muted)]', className)}><ImageOff className="h-5 w-5 opacity-50" /></span>
  )
}

function Price({ item, className, compact = false }: { item: PublicMenuItem; className?: string; compact?: boolean }) {
  if (item.soldOut) return <span className={cn('text-[13px] font-bold text-rose-500', className)}>تمام شد</span>
  if (item.price == null) return <span className={cn('text-[13px] font-bold text-[var(--m-muted)]', className)}>قیمت را بپرسید</span>
  return (
    <span className={cn('inline-flex flex-wrap items-baseline gap-x-1.5 whitespace-nowrap', className)}>
      {item.variants.length > 1 && <span className="text-[11.5px] text-[var(--m-muted)]">از</span>}
      <strong className={cn('tabular-nums', compact ? 'text-[14px]' : 'text-[15px]')}>{fa(item.price)}</strong>
      <span className="text-[11.5px] text-[var(--m-muted)]">تومان</span>
      {item.comparePrice != null && !compact && <span className="text-[11.5px] tabular-nums text-[var(--m-muted)] line-through">{fa(item.comparePrice)}</span>}
    </span>
  )
}

function Badges({ badges, soldOut, className }: { badges: MenuBadge[]; soldOut: boolean; className?: string }) {
  if (!badges.length || soldOut) return null
  return (
    <span className={cn('flex flex-wrap gap-1', className)}>
      {badges.map((badge) => (
        <span key={badge} className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold', badge === 'spicy' ? 'bg-rose-500/10 text-rose-600' : badge === 'veg' ? 'bg-emerald-500/10 text-emerald-700' : 'bg-[color-mix(in_srgb,var(--m-accent)_14%,transparent)] text-[var(--m-accent)]')}>
          {BADGE_LABELS[badge]}
        </span>
      ))}
    </span>
  )
}

function AddButton({ onAdd, label }: { onAdd: () => void; label: string }) {
  return (
    <button type="button" onClick={onAdd} aria-label={`افزودن ${label} به انتخاب‌ها`} className="grid h-10 w-10 place-items-center rounded-full bg-[var(--m-accent)] text-[var(--m-on-accent)] shadow-md transition-transform active:scale-90">
      <Plus className="h-4 w-4" />
    </button>
  )
}

function Stepper({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[var(--m-line)]">
      <button type="button" onClick={() => onChange(Math.min(value + 1, 20))} aria-label="یکی بیشتر" className="grid h-10 w-10 place-items-center"><Plus className="h-4 w-4" /></button>
      <span className="w-6 text-center font-bold tabular-nums">{fa(value)}</span>
      <button type="button" onClick={() => onChange(value - 1)} aria-label="یکی کمتر" className="grid h-10 w-10 place-items-center"><Minus className="h-4 w-4" /></button>
    </span>
  )
}

function Sheet({ title, onClose, children, bare = false }: { title: string; onClose: () => void; children: ReactNode; bare?: boolean }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    closeRef.current?.focus()
    const root = document.documentElement
    const previous = root.style.overflow
    root.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { root.style.overflow = previous; window.removeEventListener('keydown', onKey) }
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="بستن" onClick={onClose} className="pm-fade absolute inset-0 bg-black/45" />
      <div className="pm-sheet relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[28px] bg-[var(--m-surface)] text-[var(--m-ink)] shadow-2xl sm:rounded-[28px]">
        {!bare && (
          <div className="sticky top-0 z-10 flex items-center justify-between bg-[var(--m-surface)] px-5 pb-2 pt-4">
            <h2 className="text-[17px] font-bold">{title}</h2>
            <button ref={closeRef} type="button" onClick={onClose} aria-label="بستن" className="grid h-10 w-10 place-items-center rounded-full bg-[var(--m-bg)]"><X className="h-4 w-4" /></button>
          </div>
        )}
        {bare && <button ref={closeRef} type="button" onClick={onClose} aria-label="بستن" className="pm-glass absolute end-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full"><X className="h-4 w-4" /></button>}
        <div className={bare ? '' : 'px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]'}>{children}</div>
      </div>
    </div>
  )
}

function ItemSheet({ item, onClose, onAdd, askHref }: { item: PublicMenuItem; onClose: () => void; onAdd: (variantId: number | null, qty: number) => void; askHref: string | null }) {
  const firstOpen = item.variants.find((variant) => !variant.soldOut) ?? null
  const [variant, setVariant] = useState<PublicMenuVariant | null>(firstOpen)
  const [qty, setQty] = useState(1)
  const unit = variant?.price ?? item.price
  return (
    <Sheet title={item.name} onClose={onClose} bare>
      {item.image ? (
        <img src={item.image} alt={item.name} className="aspect-[4/3] max-h-[46dvh] w-full object-cover" />
      ) : (
        <div aria-hidden className="pm-pattern h-28 w-full" />
      )}
      <div className="px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
        <h2 className="text-[22px] font-bold leading-tight">{item.name}</h2>
        <Badges badges={item.badges} soldOut={item.soldOut} className="mt-2" />
        {item.description && <p className="mt-3 text-[14px] leading-7 text-[var(--m-muted)]">{item.description}</p>}

        {item.variants.length > 0 && (
          <fieldset className="mt-4">
            <legend className="mb-2 text-[13px] font-bold">انتخاب کنید</legend>
            <div className="grid gap-2">
              {item.variants.map((row) => (
                <label key={row.id} className={cn('flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border px-3.5', variant?.id === row.id ? 'border-[var(--m-accent)] bg-[color-mix(in_srgb,var(--m-accent)_8%,transparent)]' : 'border-[var(--m-line)]', row.soldOut && 'cursor-not-allowed opacity-50')}>
                  <input type="radio" name="variant" className="accent-[var(--m-accent)]" disabled={row.soldOut} checked={variant?.id === row.id} onChange={() => setVariant(row)} />
                  <span className="flex-1 font-medium">{row.label}</span>
                  <span className="text-[13px] tabular-nums text-[var(--m-muted)]">{row.soldOut ? 'تمام شد' : row.price != null ? `${fa(row.price)} تومان` : ''}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {!item.soldOut && (
          <div className="mt-5 flex items-center gap-3">
            <Stepper value={qty} onChange={(value) => setQty(Math.max(1, value))} />
            <button
              type="button"
              disabled={item.variants.length > 0 && !variant}
              onClick={() => onAdd(variant?.id ?? null, qty)}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-[var(--m-accent)] px-4 text-[14px] font-bold text-[var(--m-on-accent)] disabled:opacity-50"
            >
              افزودن{unit != null ? ` · ${fa(unit * qty)} تومان` : ''}
            </button>
          </div>
        )}
        {askHref && (
          <a href={askHref} className="mt-2.5 flex h-12 items-center justify-center gap-2 rounded-2xl border border-[var(--m-line)] text-[14px] font-bold">
            <Sparkles className="h-4 w-4 text-[var(--m-accent)]" />درباره این غذا بپرسید
          </a>
        )}
      </div>
    </Sheet>
  )
}

/* Motion is small and purposeful: the header settles in once, sheets slide
   up, the picks button pops when something is added, the "ask" button gets
   one slow sheen. Everything stops under prefers-reduced-motion. */
const MENU_CSS = `
.pm { font-feature-settings: "ss01"; }
.pm-bar { background: color-mix(in srgb, var(--m-bg) 90%, transparent); -webkit-backdrop-filter: saturate(160%) blur(14px); backdrop-filter: saturate(160%) blur(14px); }
.pm-preview .pm-bar { -webkit-backdrop-filter: none; backdrop-filter: none; background: var(--m-bg); }
.pm-chips { scrollbar-width: none; -webkit-mask-image: linear-gradient(to left, #000 88%, transparent); mask-image: linear-gradient(to left, #000 88%, transparent); }
.pm-chips::-webkit-scrollbar { display: none; }
.pm-glass { background: color-mix(in srgb, var(--m-surface) 78%, transparent); color: var(--m-ink); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); }
.pm-pattern { background:
  radial-gradient(60% 90% at 85% 10%, color-mix(in srgb, var(--m-accent) 42%, transparent), transparent 70%),
  radial-gradient(50% 80% at 10% 100%, color-mix(in srgb, var(--m-accent) 22%, transparent), transparent 70%),
  radial-gradient(color-mix(in srgb, var(--m-ink) 10%, transparent) 1px, transparent 1px) 0 0 / 18px 18px,
  var(--m-bg); }
.pm-noimg { background: color-mix(in srgb, var(--m-accent) 7%, var(--m-bg)); }
.pm-leader { border-bottom: 2px dotted var(--m-line); transform: translateY(-4px); }
.pm-card { transition: transform 220ms cubic-bezier(.23,1,.32,1), box-shadow 220ms ease; }
@media (hover: hover) and (pointer: fine) { .pm-card:hover { transform: translateY(-2px); box-shadow: 0 18px 40px -26px rgba(0,0,0,.45); } }
.pm-rise { animation: pm-rise 560ms cubic-bezier(.23,1,.32,1) both; }
.pm-cover { animation: pm-zoom 1400ms cubic-bezier(.23,1,.32,1) both; }
.pm-sheet { animation: pm-up 320ms cubic-bezier(.23,1,.32,1) both; }
.pm-fade { animation: pm-fade 240ms ease both; }
.pm-pop { animation: pm-pop 420ms cubic-bezier(.34,1.56,.64,1) both; }
.pm-live { animation: pm-live 2.4s ease-in-out infinite; }
.pm-ask::after { content: ''; position: absolute; inset: 0; background: linear-gradient(105deg, transparent 35%, rgba(255,255,255,.35) 50%, transparent 65%); transform: translateX(-120%); animation: pm-sheen 2.8s ease-in-out 1.2s 2; }
@keyframes pm-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
@keyframes pm-zoom { from { transform: scale(1.06); } to { transform: none; } }
@keyframes pm-up { from { transform: translateY(24px); opacity: .6; } to { transform: none; opacity: 1; } }
@keyframes pm-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes pm-pop { 0% { transform: scale(.92); } 60% { transform: scale(1.06); } 100% { transform: none; } }
@keyframes pm-live { 0%, 100% { box-shadow: 0 0 0 0 rgba(52,211,153,.6); } 50% { box-shadow: 0 0 0 5px rgba(52,211,153,0); } }
@keyframes pm-sheen { to { transform: translateX(120%); } }
@media (prefers-reduced-motion: reduce) { .pm *, .pm *::after { animation: none !important; transition: none !important; } }
`
