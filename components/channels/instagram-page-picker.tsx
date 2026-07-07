'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Camera, ChevronRight, AlertCircle } from 'lucide-react'

/**
 * Multi-page Instagram OAuth picker.
 *
 * When the OAuth callback discovers more than one Facebook Page with a linked
 * Instagram account, it stashes the resolved pages in a short-lived
 * `ig_oauth_pending` cookie and redirects to the channels page with
 * `?ig_pick=1`. The (server-component) channels page reads the cookie and
 * passes the list here as `pages`.
 *
 * The operator picks the page they want → we POST `{ pageId }` to the
 * finalize endpoint (which reads the same cookie server-side, persists the
 * channel, and clears the cookie) → on success we navigate back to the
 * channels page with `?ig_connected=1`.
 */

export interface PickerInstagram {
  igBusinessAccountId?: string
  username: string
  profilePictureUrl?: string
  followersCount?: number
}

export interface PickerPage {
  pageId: string
  pageName: string
  instagram: PickerInstagram
}

export function InstagramPagePicker({
  agentId,
  pages,
}: {
  agentId: string
  pages: PickerPage[]
}) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function pick(pageId: string) {
    setBusyId(pageId)
    setError(null)
    try {
      const res = await fetch(
        `/api/agents/${agentId}/channels/instagram-connect`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pageId }),
        },
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (data.error === 'NO_PENDING_OAUTH' || data.error === 'BAD_PENDING') {
          setError('نشست منقضی شده — لطفاً دوباره اتصال را شروع کنید.')
        } else if (data.error === 'PAGE_NOT_FOUND') {
          setError('صفحه انتخاب‌شده معتبر نیست. دوباره تلاش کنید.')
        } else {
          setError('اتصال ناموفق بود. دوباره تلاش کنید.')
        }
        return
      }
      // Success — go to the channels page with the success flag.
      router.push(`/agents/${agentId}/channels?ig_connected=1`)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af] text-white">
          <Camera className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-[var(--text-primary)]">
            اکانت اینستاگرام موردنظر را انتخاب کنید
          </h3>
          <p className="text-xs text-[var(--text-secondary)]">
            {pages.length.toLocaleString('fa-IR')} صفحه با اکانت اینستاگرام متصل
            پیدا شد
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/5 p-2.5 text-xs text-danger">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="leading-relaxed">{error}</span>
        </div>
      )}

      <div className="mt-4 max-h-80 space-y-2 overflow-y-auto pe-1">
        {pages.map((p) => (
          <button
            key={p.pageId}
            type="button"
            onClick={() => pick(p.pageId)}
            disabled={!!busyId}
            className="flex w-full items-center gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] p-3 text-right transition-colors hover:bg-[var(--bg-surface)] disabled:opacity-50"
          >
            {p.instagram?.profilePictureUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.instagram.profilePictureUrl}
                alt={p.instagram.username}
                className="h-10 w-10 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)]">
                <Camera className="h-5 w-5 text-[var(--text-tertiary)]" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-[var(--text-primary)]">
                @{p.instagram?.username ?? '(unknown)'}
              </div>
              <div className="truncate text-xs text-[var(--text-secondary)]">
                {p.pageName}
                {p.instagram?.followersCount != null
                  ? ` · ${p.instagram.followersCount.toLocaleString('fa-IR')} فالوور`
                  : ''}
              </div>
            </div>
            {busyId === p.pageId ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--text-secondary)]" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-tertiary)] rtl:rotate-180" />
            )}
          </button>
        ))}
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-[var(--text-tertiary)]">
        اگر اکانت موردنظر در این لیست نیست، ابتدا آن را در اپ اینستاگرام به یک
        صفحه فیسبوک متصل کنید و دوباره تلاش کنید.
      </p>
    </div>
  )
}
