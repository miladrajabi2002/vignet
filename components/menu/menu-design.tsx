'use client'

/* eslint-disable @next/next/no-img-element -- uploaded cover/logo previews. */

import { useMemo, useRef, useState, type ReactNode } from 'react'
import { Check, ExternalLink, ImagePlus, Loader2, RotateCcw, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Switch } from '@/components/ui/switch'
import { AutoSaveStatus } from '@/components/ui/auto-save-status'
import { uploadFileWithProgress } from '@/components/ui/upload-dropzone'
import { PublicMenu } from '@/components/menu/public-menu'
import { useAutoSave } from '@/lib/hooks/use-auto-save'
import {
  ACCENT_SWATCHES,
  LAYOUT_LABELS,
  MENU_LAYOUTS,
  MENU_THEMES,
  THEME_TOKENS,
  menuPalette,
  menuSettingsSchema,
  type MenuSettings,
} from '@/lib/menu/settings'
import type { PublicMenuSection } from '@/lib/menu/public-data'

/** Why a field is not saved yet, by the settings key the schema rejected. */
const FIELD_HINTS: Record<string, string> = {
  mapUrl: 'لینک مسیریابی باید با https:// شروع شود.',
  coverImage: 'آدرس عکس کاور باید با https:// شروع شود.',
  logo: 'آدرس لوگو باید با https:// شروع شود.',
  instagram: 'آیدی اینستاگرام فقط حروف انگلیسی، عدد، نقطه و _ می‌پذیرد.',
  openAt: 'ساعت شروع را کامل وارد کنید (مثل ۰۹:۳۰).',
  closeAt: 'ساعت پایان را کامل وارد کنید (مثل ۲۳:۰۰).',
}

/**
 * «طراحی منو»: theme, colour, layout, cover, logo, hours and contact, with
 * the real menu rendering live in a phone frame as the owner edits. Every
 * change saves by itself; a value the menu cannot show yet (a half-typed
 * link) waits until it is complete.
 */
export function MenuDesign({
  businessName,
  slug,
  publicUrl,
  chatUrl,
  initial,
  sections,
}: {
  businessName: string
  slug: string
  publicUrl: string
  chatUrl: string | null
  initial: MenuSettings
  sections: PublicMenuSection[]
}) {
  const [settings, setSettings] = useState<MenuSettings>(initial)
  const [notice, setNotice] = useState<string | null>(null)
  const invalid = useMemo(() => {
    const parsed = menuSettingsSchema.safeParse(settings)
    return parsed.success ? null : FIELD_HINTS[String(parsed.error.issues[0]?.path[0])] ?? 'یکی از مقدارها کامل نیست.'
  }, [settings])
  const set = <K extends keyof MenuSettings>(key: K, value: MenuSettings[K]) => setSettings((current) => ({ ...current, [key]: value }))
  const palette = menuPalette(settings)

  const previewData = useMemo(() => ({ name: businessName, slug, settings, sections, chatUrl, table: '۷' }), [businessName, slug, settings, sections, chatUrl])

  const auto = useAutoSave({
    value: settings,
    valid: !invalid,
    save: async (next) => {
      setNotice(null)
      const response = await fetch('/api/menu/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      }).catch(() => null)
      if (response?.ok) return
      setNotice(response?.status === 402 ? 'پلن فضای کاری فعال نیست؛ برای تغییر منو، پلن را تمدید کنید.' : 'اتصال را بررسی کنید و دوباره تلاش کنید.')
      throw new Error('SAVE_FAILED')
    },
  })

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
      <div className="min-w-0 space-y-4" onBlur={auto.flush}>
        <Panel title="ظاهر" hint="تم، رنگ اصلی و چیدمان آیتم‌ها.">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="تم منو">
            {MENU_THEMES.map((theme) => {
              const tokens = THEME_TOKENS[theme]
              const on = settings.theme === theme
              return (
                <button
                  key={theme}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => set('theme', theme)}
                  className={cn('overflow-hidden rounded-2xl border-2 text-start transition-colors', on ? 'border-[var(--text-primary)]' : 'border-[var(--border-subtle)] hover:border-[var(--border-strong)]')}
                >
                  <span className="flex h-14 items-end gap-1 p-2" style={{ background: tokens.bg }}>
                    <span className="h-6 flex-1 rounded-lg" style={{ background: tokens.surface, border: `1px solid ${tokens.line}` }} />
                    <span className="h-6 w-6 rounded-full" style={{ background: settings.accent ?? tokens.accent }} />
                  </span>
                  <span className="flex items-center justify-between px-2.5 py-2 text-[13px] font-bold">
                    {tokens.label}
                    {on && <Check className="h-4 w-4" />}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="mt-4">
            <p className="mb-2 text-[13px] font-medium text-[var(--text-secondary)]">رنگ اصلی</p>
            <div className="flex flex-wrap items-center gap-2">
              {ACCENT_SWATCHES.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => set('accent', color)}
                  aria-label={`رنگ ${color}`}
                  aria-pressed={palette.accent === color}
                  className={cn('grid h-11 w-11 place-items-center rounded-full border-2', palette.accent === color ? 'border-[var(--text-primary)]' : 'border-transparent')}
                >
                  <span className="h-8 w-8 rounded-full" style={{ background: color }} />
                </button>
              ))}
              <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border border-[var(--border-default)] px-3 text-[13px]">
                <input type="color" value={palette.accent} onChange={(event) => set('accent', event.target.value)} className="h-6 w-6 cursor-pointer rounded-full border-0 bg-transparent p-0" aria-label="رنگ دلخواه" />
                دلخواه
              </label>
              {settings.accent && (
                <button type="button" onClick={() => set('accent', null)} className="inline-flex h-11 items-center gap-1 rounded-full px-3 text-[13px] text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                  <RotateCcw className="h-3.5 w-3.5" />رنگ تم
                </button>
              )}
            </div>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-[13px] font-medium text-[var(--text-secondary)]">چیدمان آیتم‌ها</p>
            <div className="ui-seg grid-cols-3" role="tablist" aria-label="چیدمان آیتم‌ها">
              {MENU_LAYOUTS.map((layout) => (
                <button key={layout} type="button" role="tab" aria-selected={settings.layout === layout} onClick={() => set('layout', layout)} className="ui-seg-tab text-[13px]">{LAYOUT_LABELS[layout]}</button>
              ))}
            </div>
          </div>
        </Panel>

        <Panel title="کاور و لوگو" hint="عکس افقی از فضای رستوران یا غذای شاخص؛ لوگو مربعی.">
          <div className="grid gap-3 sm:grid-cols-2">
            <ImageField label="عکس کاور" value={settings.coverImage} onChange={(value) => set('coverImage', value)} wide />
            <ImageField label="لوگو" value={settings.logo} onChange={(value) => set('logo', value)} />
          </div>
        </Panel>

        <Panel title="معرفی و اطلاعات" hint="چیزهایی که مشتری قبل از سفارش می‌پرسد.">
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField id="menu-tagline" label="جملهٔ معرفی" value={settings.tagline} max={140} placeholder="مثلاً غذای ایرانی با نان تازه تنوری" onChange={(value) => set('tagline', value)} wide />
            <TextField id="menu-notice" label="اطلاعیهٔ بالای منو" value={settings.notice} max={160} placeholder="مثلاً ناهار روزهای کاری ۱۰٪ تخفیف" onChange={(value) => set('notice', value)} wide />
            <TextField id="menu-open" label="ساعت شروع" type="time" value={settings.openAt} onChange={(value) => set('openAt', value)} />
            <TextField id="menu-close" label="ساعت پایان" type="time" value={settings.closeAt} onChange={(value) => set('closeAt', value)} />
            <TextField id="menu-phone" label="تلفن" value={settings.phone} max={24} dir="ltr" placeholder="021 1234 5678" onChange={(value) => set('phone', value)} />
            <TextField id="menu-instagram" label="اینستاگرام" value={settings.instagram} max={40} dir="ltr" placeholder="@yourcafe" onChange={(value) => set('instagram', value)} />
            <TextField id="menu-address" label="آدرس" value={settings.address} max={160} onChange={(value) => set('address', value)} wide />
            <TextField id="menu-map" label="لینک مسیریابی (نشان، بلد یا گوگل مپ)" value={settings.mapUrl} dir="ltr" placeholder="https://nshn.ir/…" onChange={(value) => set('mapUrl', value)} wide />
          </div>
          <p className="mt-2 text-[12px] leading-6 text-[var(--text-muted)]">با ساعت شروع و پایان، منو خودش «باز است تا …» یا «بسته» نشان می‌دهد (به وقت تهران؛ ساعت پایان بعد از نیمه‌شب هم درست حساب می‌شود).</p>
        </Panel>

        <Panel title="امکانات منو">
          <div className="divide-y divide-[var(--border-subtle)]">
            <ToggleRow
              title="دکمهٔ «از منو بپرس»"
              description={chatUrl ? 'مشتری دربارهٔ غذاها از همان ایجنت شما می‌پرسد یا فهرست انتخاب‌هایش را در گفتگو می‌فرستد.' : 'اول لینک گفتگوی ایجنت را از بخش اتصال‌ها فعال کنید.'}
              checked={settings.showAsk}
              disabled={!chatUrl}
              onChange={(value) => set('showAsk', value)}
            />
            <ToggleRow title="جستجو در منو" description="برای منوهای بلند؛ فارسی و عربی (ی/ي، ک/ك) را یکی می‌بیند." checked={settings.showSearch} onChange={(value) => set('showSearch', value)} />
          </div>
          <p className="mt-2 text-[12px] leading-6 text-[var(--text-muted)]">برچسب‌های «پیشنهاد سرآشپز»، «پرطرفدار»، «جدید»، «تند» و «گیاهی» را از تب آیتم‌ها روی هر غذا بزنید؛ آیتم‌های سرآشپز و پرطرفدار بالای منو در «پیشنهاد ما» می‌آیند.</p>
        </Panel>

        <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-[var(--border-subtle)] bg-white/95 py-2 pe-2 ps-3 shadow-[var(--shadow-control)] backdrop-blur">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
            {invalid
              ? <p role="alert" className="text-[13px] leading-6 text-amber-800">{invalid} تا آن موقع ذخیره نمی‌شود.</p>
              : <AutoSaveStatus status={auto.status} onRetry={auto.flush} idleLabel="ذخیرهٔ خودکار؛ منوی مشتری به‌روز است" className="-ms-2.5" />}
            {!invalid && auto.status === 'error' && notice && <p role="alert" className="text-[13px] text-red-700">{notice}</p>}
          </div>
          <a href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            <ExternalLink className="h-4 w-4" />منوی مشتری
          </a>
        </div>
      </div>

      <aside className="lg:sticky lg:top-24" aria-label="پیش‌نمایش زندهٔ منو">
        <div className="mx-auto w-full max-w-[380px] rounded-[44px] bg-[#0b0b0d] p-2.5 shadow-[0_30px_70px_-30px_rgba(0,0,0,.55)]">
          <div className="relative h-[680px] overflow-y-auto overscroll-contain rounded-[36px] [scrollbar-width:none]" style={{ background: palette.bg }}>
            <PublicMenu data={previewData} preview />
          </div>
        </div>
        <p className="mt-2 text-center text-[12px] text-[var(--text-muted)]">پیش‌نمایش زنده با آیتم‌های واقعی شما (میز ۷ نمونه است)</p>
      </aside>
    </div>
  )
}

function Panel({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="spatial-surface rounded-card p-4 sm:p-5">
      <h2 className="ui-h3">{title}</h2>
      {hint && <p className="mt-0.5 text-[13px] text-[var(--text-muted)]">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  )
}

function TextField({ id, label, value, onChange, placeholder, max, type = 'text', dir, wide = false }: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  max?: number
  type?: string
  dir?: 'ltr' | 'rtl'
  wide?: boolean
}) {
  return (
    <label htmlFor={id} className={cn('block min-w-0', wide && 'sm:col-span-2')}>
      <span className="mb-1.5 block text-[13px] text-[var(--text-secondary)]">{label}</span>
      <input id={id} type={type} dir={dir} value={value} maxLength={max} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="input w-full" />
    </label>
  )
}

function ToggleRow({ title, description, checked, disabled, onChange }: { title: string; description: string; checked: boolean; disabled?: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-[var(--text-primary)]">{title}</p>
        <p className="mt-0.5 text-[13px] leading-6 text-[var(--text-muted)]">{description}</p>
      </div>
      <Switch checked={checked && !disabled} disabled={disabled} onChange={onChange} aria-label={title} />
    </div>
  )
}

function ImageField({ label, value, onChange, wide = false }: { label: string; value: string; onChange: (value: string) => void; wide?: boolean }) {
  const input = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState('')

  async function upload(file: File) {
    setError('')
    setProgress(0)
    try {
      const body = new FormData()
      body.set('file', file)
      const { response, status } = await uploadFileWithProgress('/api/uploads/products', body, setProgress)
      const url = (response as { url?: string } | null)?.url
      if (status >= 400 || !url) throw new Error('upload')
      onChange(url)
    } catch {
      setError('آپلود نشد؛ JPG، PNG یا WebP تا چند مگابایت را امتحان کنید.')
    } finally {
      setProgress(null)
    }
  }

  return (
    <div className="min-w-0">
      <p className="mb-1.5 text-[13px] text-[var(--text-secondary)]">{label}</p>
      <div className={cn('relative grid place-items-center overflow-hidden rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--bg-base)]', wide ? 'aspect-[16/7]' : 'aspect-[16/7] sm:aspect-auto sm:h-full sm:min-h-[8.5rem]')}>
        {value ? (
          <>
            <img src={value} alt="" className={cn('h-full w-full', wide ? 'object-cover' : 'object-contain p-3')} />
            <button type="button" onClick={() => onChange('')} aria-label={`حذف ${label}`} className="absolute end-2 top-2 grid h-10 w-10 place-items-center rounded-xl bg-white/90 text-red-600 shadow-sm">
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        ) : (
          <button type="button" onClick={() => input.current?.click()} className="flex min-h-11 flex-col items-center gap-1 p-4 text-[13px] text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            {progress != null ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
            {progress != null ? `${Math.round(progress)}٪` : `انتخاب ${label}`}
          </button>
        )}
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); event.target.value = '' }} />
      </div>
      {error && <p role="alert" className="mt-1 text-[12px] text-red-700">{error}</p>}
    </div>
  )
}
