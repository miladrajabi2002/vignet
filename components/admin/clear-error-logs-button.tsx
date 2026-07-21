'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Trash2 } from 'lucide-react'

export function ClearErrorLogsButton({ disabled = false }: { disabled?: boolean }) {
  const router = useRouter()
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function clearLogs() {
    if (!window.confirm('تمام لاگ‌های خطا و هشدار برای همیشه حذف می‌شوند. ادامه می‌دهید؟')) {
      return
    }

    setStatus('loading')
    setMessage('')
    try {
      const response = await fetch('/api/admin/errors', { method: 'DELETE' })
      const data = (await response.json().catch(() => ({}))) as {
        cleared?: number
        error?: string
      }
      if (!response.ok) throw new Error(data.error ?? 'CLEAR_FAILED')

      const cleared = Number(data.cleared ?? 0).toLocaleString('fa-IR')
      setStatus('success')
      setMessage(`${cleared} لاگ پاک شد`)
      router.refresh()
    } catch {
      setStatus('error')
      setMessage('پاک‌سازی انجام نشد؛ دوباره تلاش کنید')
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={clearLogs}
        disabled={disabled || status === 'loading'}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-bold text-rose-700 transition-colors hover:border-rose-300 hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/70 disabled:cursor-not-allowed disabled:opacity-45"
      >
        {status === 'loading' ? (
          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        ) : (
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        )}
        {status === 'loading' ? 'در حال پاک‌سازی…' : 'پاک‌سازی لاگ‌ها'}
      </button>
      {message ? (
        <span
          role="status"
          className={status === 'error' ? 'text-xs text-rose-700' : 'text-xs text-emerald-700'}
        >
          {message}
        </span>
      ) : null}
    </div>
  )
}
