'use client'

/**
 * Inbound channel media (photo / video / voice) rendered inside the
 * conversation thread — WhatsApp/Telegram style.
 *
 * The bytes are never stored on this server: the component points at the
 * workspace-scoped view-time proxy `/api/conversations/[id]/messages/[mid]/media`,
 * which resolves the trusted channel reference (Instagram CDN URL or a
 * Telegram/Bale file id) live. When the reference can no longer be resolved
 * (expired CDN URL, revoked file), the element's onError handler swaps the
 * player for an honest placeholder chip instead of a broken box.
 */

import { useState } from 'react'
import { cn } from '@/lib/utils'

type Locale = 'fa' | 'en'

type MediaKind = 'photo' | 'video' | 'voice' | 'audio' | 'sticker' | 'file'

const PLACEHOLDERS: Record<Locale, Record<string, string>> = {
  fa: {
    photo: 'عکس (از کانال بارگذاری نشد)',
    video: 'ویدیو (از کانال بارگذاری نشد)',
    voice: 'پیام صوتی (از کانال بارگذاری نشد)',
    audio: 'فایل صوتی (از کانال بارگذاری نشد)',
    sticker: 'استیکر',
    file: 'فایل پیوست',
  },
  en: {
    photo: 'Photo (could not be loaded from the channel)',
    video: 'Video (could not be loaded from the channel)',
    voice: 'Voice message (could not be loaded from the channel)',
    audio: 'Audio file (could not be loaded from the channel)',
    sticker: 'Sticker',
    file: 'Attachment',
  },
}

function kindLabel(kind: MediaKind, locale: Locale): string | null {
  const fa: Record<string, string> = {
    photo: 'عکس ارسالی مشتری',
    video: 'ویدیوی ارسالی مشتری',
    voice: 'پیام صوتی مشتری',
    audio: 'فایل صوتی مشتری',
    sticker: 'استیکر مشتری',
    file: 'فایل ارسالی مشتری',
  }
  const en: Record<string, string> = {
    photo: 'Customer photo',
    video: 'Customer video',
    voice: 'Customer voice message',
    audio: 'Customer audio file',
    sticker: 'Customer sticker',
    file: 'Customer file',
  }
  return (locale === 'fa' ? fa : en)[kind] ?? null
}

export function InboundMedia({
  conversationId,
  messageId,
  kind,
  locale,
}: {
  conversationId: string
  messageId: string
  kind: MediaKind
  locale: Locale
}) {
  const [failed, setFailed] = useState(false)
  const src = `/api/conversations/${conversationId}/messages/${messageId}/media`

  if (failed) {
    return (
      <span
        dir="auto"
        className="inline-flex items-center gap-1.5 rounded-2xl border border-black/[0.08] bg-black/[0.04] px-3 py-2 text-xs text-[var(--text-secondary)]"
      >
        <span aria-hidden="true" className="text-sm">
          {kind === 'voice' || kind === 'audio' ? '🎙' : kind === 'video' ? '🎬' : '🖼'}
        </span>
        {PLACEHOLDERS[locale][kind] ?? PLACEHOLDERS[locale].file}
      </span>
    )
  }

  if (kind === 'photo' || kind === 'sticker') {
    return (
      <figure className="m-0 max-w-[min(20rem,78vw)]">
        {/* eslint-disable-next-line @next/next/no-img-element -- view-time proxy, not a build-time asset */}
        <img
          src={src}
          alt={kindLabel(kind, locale) ?? 'Customer media'}
          loading="lazy"
          onError={() => setFailed(true)}
          className="block max-h-80 w-auto rounded-[1.15rem] border border-black/[0.08] bg-white object-contain shadow-sm"
        />
      </figure>
    )
  }

  if (kind === 'video') {
    return (
      <video
        controls
        preload="metadata"
        onError={() => setFailed(true)}
        src={src}
        aria-label={kindLabel(kind, locale) ?? undefined}
        className="block max-h-80 w-auto max-w-[min(20rem,78vw)] rounded-[1.15rem] border border-black/[0.08] bg-black/90 shadow-sm"
      />
    )
  }

  if (kind === 'voice' || kind === 'audio') {
    return (
      <audio
        controls
        preload="metadata"
        onError={() => setFailed(true)}
        src={src}
        aria-label={kindLabel(kind, locale) ?? undefined}
        className={cn('block w-[min(16rem,70vw)]')}
      />
    )
  }

  // Generic files: offer a direct download/open link through the proxy.
  return (
    <a
      href={src}
      target="_blank"
      rel="noreferrer"
      dir="auto"
      className="inline-flex items-center gap-1.5 rounded-2xl border border-black/[0.08] bg-black/[0.04] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] transition hover:border-black/20"
    >
      <span aria-hidden="true">📎</span>
      {kindLabel(kind, locale) ?? PLACEHOLDERS[locale].file}
    </a>
  )
}
