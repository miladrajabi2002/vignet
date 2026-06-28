'use client'

import { useEffect, useRef, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { toEnglishDigits } from '@/lib/phone'

type Step = 'phone' | 'otp'
const OTP_LENGTH = 6
const RESEND_SECONDS = 120

export function PhoneOtpForm() {
  const t = useTranslations('auth')

  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState<string[]>(Array(OTP_LENGTH).fill(''))
  const [name, setName] = useState('')
  const [isNewUser, setIsNewUser] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resendIn, setResendIn] = useState(0)

  const otpRefs = useRef<(HTMLInputElement | null)[]>([])

  // Resend countdown
  useEffect(() => {
    if (resendIn <= 0) return
    const id = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [resendIn])

  const errorText = (key: string | null) =>
    key ? t(`errors.${key}` as 'errors.GENERIC') : null

  async function requestOtp() {
    setError(null)
    const normalized = toEnglishDigits(phone).replace(/\D/g, '')
    if (normalized.length < 10) {
      setError('INVALID_PHONE')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'GENERIC')
        return
      }
      setIsNewUser(!!data.isNewUser)
      setStep('otp')
      setResendIn(RESEND_SECONDS)
      setTimeout(() => otpRefs.current[0]?.focus(), 50)
    } catch {
      setError('GENERIC')
    } finally {
      setLoading(false)
    }
  }

  async function verify() {
    setError(null)
    const fullCode = code.join('')
    if (fullCode.length !== OTP_LENGTH) {
      setError('INVALID_CODE')
      return
    }
    setLoading(true)
    try {
      const res = await signIn('credentials', {
        phone,
        code: fullCode,
        name: isNewUser ? name : undefined,
        redirect: false,
      })
      if (res?.error) {
        setError('INVALID_CODE')
        setCode(Array(OTP_LENGTH).fill(''))
        otpRefs.current[0]?.focus()
        return
      }
      // Full-page navigation (not router.push) so middleware + server layouts
      // see the freshly-set session cookie and can run the onboarding redirect.
      // A soft navigation here lands on a blank page until manual refresh.
      window.location.assign('/overview')
    } catch {
      setError('GENERIC')
    } finally {
      setLoading(false)
    }
  }

  function handleOtpChange(index: number, raw: string) {
    const digits = toEnglishDigits(raw).replace(/\D/g, '')
    if (!digits) {
      setCode((prev) => {
        const next = [...prev]
        next[index] = ''
        return next
      })
      return
    }
    // Support paste of full code
    if (digits.length > 1) {
      const chars = digits.slice(0, OTP_LENGTH).split('')
      const next = Array(OTP_LENGTH).fill('')
      chars.forEach((c, i) => (next[i] = c))
      setCode(next)
      const last = Math.min(chars.length, OTP_LENGTH) - 1
      otpRefs.current[last]?.focus()
      return
    }
    setCode((prev) => {
      const next = [...prev]
      next[index] = digits
      return next
    })
    if (index < OTP_LENGTH - 1) otpRefs.current[index + 1]?.focus()
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      otpRefs.current[index - 1]?.focus()
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-8 shadow-2xl">
      <AnimatePresence mode="wait" initial={false}>
        {step === 'phone' ? (
          <motion.div
            key="phone"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <h1 className="text-2xl font-light text-white">{t('title')}</h1>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              {t('subtitle')}
            </p>

            <div className="mt-6">
              <label className="mb-2 block text-sm text-[var(--text-secondary)]">
                {t('phoneLabel')}
              </label>
              <input
                dir="ltr"
                inputMode="numeric"
                autoFocus
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && requestOtp()}
                placeholder={t('phonePlaceholder')}
                className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] px-4 py-3 text-center font-mono text-lg tracking-wider text-white outline-none transition-colors placeholder:text-[var(--text-hint)] focus:border-[var(--border-strong)]"
              />
            </div>

            {error && (
              <p className="mt-3 text-sm text-danger">{errorText(error)}</p>
            )}

            <button
              onClick={requestOtp}
              disabled={loading}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 font-medium text-black transition-transform hover:scale-[1.01] disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? t('sending') : t('sendCode')}
            </button>

            <p className="mt-6 text-center text-xs text-[var(--text-muted)]">
              {t('noCard')}
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="otp"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <button
              onClick={() => {
                setStep('phone')
                setError(null)
                setCode(Array(OTP_LENGTH).fill(''))
              }}
              className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] transition-colors hover:text-white"
            >
              <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
              {t('changeNumber')}
            </button>

            <h1 className="text-2xl font-light text-white">{t('otpTitle')}</h1>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              {t('otpSubtitle', { phone })}
            </p>

            <div dir="ltr" className="mt-6 flex justify-center gap-2">
              {code.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    otpRefs.current[i] = el
                  }}
                  inputMode="numeric"
                  maxLength={OTP_LENGTH}
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  className="h-12 w-11 rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] text-center font-mono text-xl text-white outline-none transition-colors focus:border-[var(--border-strong)]"
                />
              ))}
            </div>

            {isNewUser && (
              <div className="mt-5">
                <label className="mb-2 block text-sm text-[var(--text-secondary)]">
                  {t('nameLabel')}
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('namePlaceholder')}
                  className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] px-4 py-3 text-white outline-none transition-colors placeholder:text-[var(--text-hint)] focus:border-[var(--border-strong)]"
                />
              </div>
            )}

            {error && (
              <p className="mt-3 text-sm text-danger">{errorText(error)}</p>
            )}

            <button
              onClick={verify}
              disabled={loading}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 font-medium text-black transition-transform hover:scale-[1.01] disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? t('verifying') : t('verify')}
            </button>

            <div className="mt-4 text-center text-sm">
              {resendIn > 0 ? (
                <span className="text-[var(--text-muted)]">
                  {t('resendIn', { seconds: resendIn })}
                </span>
              ) : (
                <button
                  onClick={requestOtp}
                  disabled={loading}
                  className="text-[var(--text-secondary)] underline-offset-4 transition-colors hover:text-white hover:underline"
                >
                  {t('resend')}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
