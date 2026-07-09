'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowLeft, CheckCircle2, Loader2, Sparkles } from 'lucide-react'
import { toEnglishDigits } from '@/lib/phone'

type Step = 'phone' | 'otp'
const OTP_LENGTH = 6
const RESEND_SECONDS = 120

const EASE = [0.16, 1, 0.3, 1] as const

// Minimal typing for the WebOTP API (not yet in lib.dom for our TS target).
type OTPCredentialLike = { code?: string }

export function PhoneOtpForm() {
  const t = useTranslations('auth')
  const reduce = useReducedMotion()

  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState<string[]>(Array(OTP_LENGTH).fill(''))
  const [name, setName] = useState('')
  const [isNewUser, setIsNewUser] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Bumped on every failed verify so the shake animation replays.
  const [shakeKey, setShakeKey] = useState(0)
  const [resendIn, setResendIn] = useState(0)

  const otpRefs = useRef<(HTMLInputElement | null)[]>([])
  // Guards the auto-verify effect from double-submitting the same code.
  const submittingRef = useRef(false)

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
      setCode(Array(OTP_LENGTH).fill(''))
      submittingRef.current = false
      setTimeout(() => otpRefs.current[0]?.focus(), 350)
    } catch {
      setError('GENERIC')
    } finally {
      setLoading(false)
    }
  }

  const verify = useCallback(
    async (fullCode: string) => {
      if (submittingRef.current) return
      // Name is required for new users — block the verify call before it
      // reaches the backend so the user gets an inline error instead of a
      // generic "INVALID_CODE" from a null authorize().
      if (isNewUser && !name.trim()) {
        setError('NAME_REQUIRED')
        return
      }
      submittingRef.current = true
      setError(null)
      setLoading(true)
      try {
        const res = await signIn('credentials', {
          phone,
          code: fullCode,
          name: isNewUser ? name.trim() : undefined,
          redirect: false,
        })
        if (res?.error) {
          setError('INVALID_CODE')
          setShakeKey((k) => k + 1)
          setCode(Array(OTP_LENGTH).fill(''))
          submittingRef.current = false
          otpRefs.current[0]?.focus()
          return
        }
        setSuccess(true)
        // Full-page navigation (not router.push) so middleware + server layouts
        // see the freshly-set session cookie and can run the onboarding redirect.
        // A soft navigation here lands on a blank page until manual refresh.
        setTimeout(() => window.location.assign('/overview'), 700)
      } catch {
        setError('GENERIC')
        submittingRef.current = false
      } finally {
        setLoading(false)
      }
    },
    [phone, isNewUser, name],
  )

  // Auto-verify the moment the last digit lands (typed, pasted or autofilled).
  useEffect(() => {
    const fullCode = code.join('')
    if (step === 'otp' && fullCode.length === OTP_LENGTH && !success) {
      verify(fullCode)
    }
  }, [code, step, success, verify])

  // WebOTP: on Android Chrome the browser reads the incoming SMS (its last
  // line carries "@domain #code") and offers the code with one tap.
  useEffect(() => {
    if (step !== 'otp' || typeof window === 'undefined') return
    if (!('OTPCredential' in window)) return
    const ac = new AbortController()
    navigator.credentials
      .get({
        // @ts-expect-error — `otp` is a WebOTP extension not in lib.dom yet
        otp: { transport: ['sms'] },
        signal: ac.signal,
      })
      .then((cred) => {
        const otp = (cred as OTPCredentialLike | null)?.code
        if (!otp) return
        const digits = toEnglishDigits(otp).replace(/\D/g, '').slice(0, OTP_LENGTH)
        if (digits.length === OTP_LENGTH) setCode(digits.split(''))
      })
      .catch(() => {
        // Aborted or dismissed — user types manually.
      })
    return () => ac.abort()
  }, [step])

  function distributeDigits(digits: string) {
    const chars = digits.slice(0, OTP_LENGTH).split('')
    const next = Array(OTP_LENGTH).fill('')
    chars.forEach((c, i) => (next[i] = c))
    setCode(next)
    const last = Math.min(chars.length, OTP_LENGTH) - 1
    otpRefs.current[last]?.focus()
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
    // Full-code paste or keyboard OTP suggestion (iOS one-time-code)
    if (digits.length > 1) {
      distributeDigits(digits)
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

  const stepMotion = {
    initial: reduce ? { opacity: 0 } : { opacity: 0, x: 24 },
    animate: { opacity: 1, x: 0 },
    exit: reduce ? { opacity: 0 } : { opacity: 0, x: -24 },
    transition: { duration: 0.3, ease: EASE },
  }

  return (
    <div className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-8 shadow-[0_20px_60px_rgba(var(--ink-rgb),0.08)]">
      {/* "Easy sign-in" badge — mirrors the hero eyebrow pill */}
      <div className="mb-6 flex justify-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-default)] bg-[var(--bg-base)] px-3.5 py-1.5 text-xs tracking-wide text-[var(--text-secondary)]">
          <Sparkles className="h-3.5 w-3.5" />
          {t('badge')}
        </span>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {step === 'phone' ? (
          <motion.div key="phone" {...stepMotion}>
            <h1 className="text-center text-2xl font-light tracking-tight text-[var(--text-primary)]">
              {t('title')}
            </h1>
            <p className="mt-2 text-center text-sm text-[var(--text-secondary)]">
              {t('subtitle')}
            </p>

            <div className="mt-7">
              <label className="mb-2 block text-sm text-[var(--text-secondary)]">
                {t('phoneLabel')}
              </label>
              <input
                dir="ltr"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                autoFocus
                value={phone}
                onChange={(e) => setPhone(toEnglishDigits(e.target.value))}
                onKeyDown={(e) => e.key === 'Enter' && requestOtp()}
                placeholder={t('phonePlaceholder')}
                className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] px-4 py-3 text-center font-mono text-lg tracking-wider text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-hint)] focus:border-[var(--border-strong)]"
              />
            </div>

            {error && (
              <p className="mt-3 text-sm text-danger">{errorText(error)}</p>
            )}

            <button
              onClick={requestOtp}
              disabled={loading}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-[var(--white)] py-3.5 text-sm font-medium text-[var(--bg-base)] shadow-[0_8px_30px_rgba(var(--ink-rgb),0.12)] transition-all duration-300 ease-smooth hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(var(--ink-rgb),0.2)] disabled:translate-y-0 disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? t('sending') : t('sendCode')}
            </button>

            <p className="mt-6 text-center text-xs text-[var(--text-muted)]">
              {t('noCard')}
            </p>
          </motion.div>
        ) : (
          <motion.div key="otp" {...stepMotion}>
            <button
              onClick={() => {
                setStep('phone')
                setError(null)
                setCode(Array(OTP_LENGTH).fill(''))
                submittingRef.current = false
              }}
              className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
            >
              <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
              {t('changeNumber')}
            </button>

            <h1 className="text-2xl font-light tracking-tight text-[var(--text-primary)]">
              {t('otpTitle')}
            </h1>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              {t('otpSubtitle', { phone })}
            </p>

            {isNewUser && (
              <div className="mt-5">
                <label className="mb-2 block text-sm text-[var(--text-secondary)]">
                  {t('nameLabel')} <span className="text-danger">*</span>
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && name.trim()) {
                      otpRefs.current[0]?.focus()
                    }
                  }}
                  placeholder={t('namePlaceholder')}
                  autoFocus
                  required
                  className={`w-full rounded-xl border bg-[var(--bg-base)] px-4 py-3 text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-hint)] focus:border-[var(--border-strong)] ${
                    error === 'NAME_REQUIRED'
                      ? 'border-danger'
                      : 'border-[var(--border-default)]'
                  }`}
                />
                {error === 'NAME_REQUIRED' && (
                  <p className="mt-1.5 text-xs text-danger">{t('errors.NAME_REQUIRED')}</p>
                )}
              </div>
            )}

            {/* Digit boxes — shake replays on every wrong code via shakeKey */}
            <motion.div
              key={shakeKey}
              dir="ltr"
              animate={
                shakeKey > 0 && !reduce
                  ? { x: [0, -8, 8, -6, 6, -3, 3, 0] }
                  : undefined
              }
              transition={{ duration: 0.4 }}
              className="mt-6 flex justify-center gap-2.5"
            >
              {code.map((digit, i) => (
                <motion.input
                  key={i}
                  ref={(el) => {
                    otpRefs.current[i] = el
                  }}
                  initial={reduce ? false : { opacity: 0, y: 12 }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    scale: !reduce && digit ? [1.12, 1] : 1,
                  }}
                  transition={{
                    duration: 0.35,
                    delay: reduce ? 0 : 0.05 * i,
                    ease: EASE,
                  }}
                  type="text"
                  inputMode="numeric"
                  autoComplete={i === 0 ? 'one-time-code' : 'off'}
                  maxLength={OTP_LENGTH}
                  disabled={success}
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  aria-label={`digit ${i + 1}`}
                  className={`h-14 w-12 rounded-2xl border text-center font-mono text-2xl outline-none transition-colors ${
                    success
                      ? 'border-success text-success'
                      : error
                        ? 'border-danger text-[var(--text-primary)]'
                        : digit
                          ? 'border-[var(--border-strong)] text-[var(--text-primary)]'
                          : 'border-[var(--border-default)] text-[var(--text-primary)]'
                  } bg-[var(--bg-base)] focus:border-[var(--border-strong)]`}
                />
              ))}
            </motion.div>

            {/* Status line: verifying spinner → success check → error */}
            <div className="mt-4 flex min-h-6 items-center justify-center text-sm">
              <AnimatePresence mode="wait">
                {success ? (
                  <motion.span
                    key="ok"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    className="inline-flex items-center gap-1.5 text-success"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {t('success')}
                  </motion.span>
                ) : loading ? (
                  <motion.span
                    key="busy"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="inline-flex items-center gap-1.5 text-[var(--text-secondary)]"
                  >
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('verifying')}
                  </motion.span>
                ) : error && error !== 'NAME_REQUIRED' ? (
                  <motion.span
                    key="err"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-danger"
                  >
                    {errorText(error)}
                  </motion.span>
                ) : (
                  <motion.span
                    key="hint"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-xs text-[var(--text-muted)]"
                  >
                    {t('autoVerifyHint')}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>

            <div className="mt-4 text-center text-sm">
              {resendIn > 0 ? (
                <span className="text-[var(--text-muted)]">
                  {t('resendIn', { seconds: resendIn })}
                </span>
              ) : (
                <button
                  onClick={requestOtp}
                  disabled={loading || success}
                  className="text-[var(--text-secondary)] underline-offset-4 transition-colors hover:text-[var(--text-primary)] hover:underline"
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
