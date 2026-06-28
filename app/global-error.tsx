'use client'

import { useEffect } from 'react'

/**
 * Last-resort boundary for errors thrown in the root layout itself (e.g. an
 * i18n/message load failure). It replaces the whole document, so it cannot use
 * the theme providers — keep the markup self-contained. A blank white page is
 * what users hit today; this gives them a way back.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[global] render error:', error)
  }, [error])

  return (
    <html lang="fa" dir="rtl">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          background: '#000',
          color: '#fff',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <p style={{ fontSize: '14px', opacity: 0.7 }}>
          خطایی رخ داد. لطفاً دوباره تلاش کنید.
        </p>
        <button
          onClick={() => reset()}
          style={{
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'transparent',
            color: '#fff',
            borderRadius: '12px',
            padding: '8px 16px',
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          تلاش دوباره
        </button>
      </body>
    </html>
  )
}
