'use client'

/**
 * Outbound scenario media (photo / video / audio) rendered inside the
 * conversation thread — what the Instagram automation actually delivered to
 * the customer.
 *
 * Unlike inbound channel media (components/crm/inbound-media.tsx — short-lived
 * CDN references resolved through the view-time proxy), these references are
 * durable HTTPS URLs: the S3 uploads picked in the automation builder are the
 * same public URLs Meta downloaded when delivering the DM/comment reply. The
 * element therefore points straight at the source; onError swaps in an honest
 * placeholder chip instead of a broken box (links can rot, buckets can be
 * reconfigured).
 */

import { useState } from 'react'

type Locale = 'fa' | 'en'

export type OutboundMediaItem = {
  kind: 'photo' | 'video' | 'audio'
  mediaUrl: string
}

const PLACEHOLDERS: Record<Locale, Record<string, string>> = {
  fa: {
    photo: 'تصویر ارسالی (لینک دیگر در دسترس نیست)',
    video: 'ویدیوی ارسالی (لینک دیگر در دسترس نیست)',
    audio: 'فایل صوتی ارسالی (لینک دیگر در دسترس نیست)',
  },
  en: {
    photo: 'Sent image (link no longer reachable)',
    video: 'Sent video (link no longer reachable)',
    audio: 'Sent audio (link no longer reachable)',
  },
}

function mediaLabel(kind: OutboundMediaItem['kind'], locale: Locale): string {
  const fa: Record<string, string> = {
    photo: 'تصویر ارسالی ایجنت',
    video: 'ویدیوی ارسالی ایجنت',
    audio: 'فایل صوتی ارسالی ایجنت',
  }
  const en: Record<string, string> = {
    photo: 'Sent by agent',
    video: 'Sent by agent',
    audio: 'Sent by agent',
  }
  return (locale === 'fa' ? fa : en)[kind] ?? (locale === 'fa' ? 'رسانه ارسالی' : 'Sent media')
}

export function OutboundMediaView({
  media,
  locale,
}: {
  media: OutboundMediaItem
  locale: Locale
}) {
  const [failed, setFailed] = useState(false)

  if (media.kind !== 'photo' && media.kind !== 'video' && media.kind !== 'audio') return null

  if (failed) {
    return (
      <span
        dir="auto"
        className="inline-flex items-center gap-1.5 rounded-2xl border border-black/[0.08] bg-black/[0.04] px-3 py-2 text-xs text-[var(--text-secondary)]"
      >
        <span aria-hidden="true" className="text-sm">
          {media.kind === 'audio' ? '🎵' : media.kind === 'video' ? '🎬' : '🖼'}
        </span>
        {PLACEHOLDERS[locale][media.kind] ?? PLACEHOLDERS[locale].photo}
      </span>
    )
  }

  if (media.kind === 'photo') {
    return (
      <figure className="m-0 max-w-[min(20rem,78vw)]">
        {/* eslint-disable-next-line @next/next/no-img-element -- durable public S3 URL persisted with the receipt */}
        <img
          src={media.mediaUrl}
          alt={mediaLabel(media.kind, locale)}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="block max-h-80 w-auto rounded-card border border-black/[0.08] bg-white object-contain shadow-sm"
        />
      </figure>
    )
  }

  if (media.kind === 'video') {
    return (
      <video
        controls
        preload="metadata"
        src={media.mediaUrl}
        onError={() => setFailed(true)}
        aria-label={mediaLabel(media.kind, locale)}
        className="block max-h-80 w-auto max-w-[min(20rem,78vw)] rounded-card border border-black/[0.08] bg-white shadow-sm"
      />
    )
  }

  return (
    <audio
      controls
      preload="metadata"
      src={media.mediaUrl}
      onError={() => setFailed(true)}
      aria-label={mediaLabel(media.kind, locale)}
      className="block w-60 max-w-full"
    />
  )
}
