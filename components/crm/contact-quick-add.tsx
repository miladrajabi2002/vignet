'use client'

import { type FormEvent, useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Check, Loader2, UserPlus } from 'lucide-react'
import { MobileBottomSheet } from '@/components/ui/mobile-bottom-sheet'
import { MaterialSelect } from '@/components/ui/material-select'
import {
  CONTACT_STAGES,
  type ContactStage,
} from '@/components/crm/contact-stage-badge'

const STAGE_KEY: Record<ContactStage, string> = {
  lead: 'stageLead',
  qualified: 'stageQualified',
  customer: 'stageCustomer',
  lost: 'stageLost',
}

type CreateError =
  | 'DUPLICATE_PHONE'
  | 'INVALID_PHONE'
  | 'NAME_OR_PHONE_REQUIRED'
  | 'PLAN_BLOCKED'
  | 'UNKNOWN'

export function ContactQuickAdd({ locale }: { locale: 'fa' | 'en' }) {
  const t = useTranslations('contacts')
  const router = useRouter()
  const formId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<CreateError | null>(null)
  const [stage, setStage] = useState<ContactStage>('lead')
  const [marketingOptIn, setMarketingOptIn] = useState(false)

  function resetForm(form: HTMLFormElement) {
    form.reset()
    setStage('lead')
    setMarketingOptIn(false)
    setError(null)
  }

  async function createContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    const form = event.currentTarget
    const data = new FormData(form)
    const name = String(data.get('name') ?? '').trim()
    const phone = String(data.get('phone') ?? '').trim()
    if (!name && !phone) {
      setError('NAME_OR_PHONE_REQUIRED')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone,
          stage,
          tags: String(data.get('tags') ?? '')
            .split(/[,،]/)
            .map((tag) => tag.trim())
            .filter(Boolean),
          notes: String(data.get('notes') ?? '').trim(),
          marketingOptIn,
        }),
      })
      const body = (await response.json().catch(() => null)) as
        | { error?: string }
        | null
      if (!response.ok) {
        const knownErrors: CreateError[] = [
          'DUPLICATE_PHONE',
          'INVALID_PHONE',
          'NAME_OR_PHONE_REQUIRED',
          'PLAN_BLOCKED',
        ]
        setError(
          knownErrors.includes(body?.error as CreateError)
            ? (body?.error as CreateError)
            : 'UNKNOWN',
        )
        return
      }

      resetForm(form)
      setSaved(true)
      setOpen(false)
      router.refresh()
      window.setTimeout(() => setSaved(false), 2200)
    } catch {
      setError('UNKNOWN')
    } finally {
      setSubmitting(false)
    }
  }

  const errorLabel = error
    ? t(`quickAdd.errors.${error}`)
    : null

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setError(null)
          setOpen(true)
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="spatial-press inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-black px-3.5 text-xs font-bold text-white shadow-[var(--shadow-control)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60 focus-visible:ring-offset-2 sm:px-4 sm:text-sm"
      >
        {saved ? (
          <Check className="h-4 w-4" aria-hidden="true" />
        ) : (
          <UserPlus className="h-4 w-4" aria-hidden="true" />
        )}
        {saved ? t('quickAdd.saved') : t('quickAdd.button')}
      </button>

      <MobileBottomSheet
        open={open}
        onClose={() => setOpen(false)}
        triggerRef={triggerRef}
        title={t('quickAdd.title')}
        description={t('quickAdd.description')}
        closeLabel={t('quickAdd.close')}
        mobileOnly={false}
        contentClassName="bg-[var(--bg-base)]/60"
        footer={
          <div className="grid grid-cols-[auto_1fr] gap-2 md:flex md:justify-end">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={submitting}
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[var(--border-default)] bg-white px-4 text-xs font-semibold text-[var(--text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60 disabled:opacity-50"
            >
              {t('quickAdd.cancel')}
            </button>
            <button
              type="submit"
              form={formId}
              disabled={submitting}
              className="inline-flex min-h-12 min-w-32 items-center justify-center gap-2 rounded-xl bg-black px-5 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting && (
                <Loader2
                  className="h-4 w-4 animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
              )}
              {submitting ? t('quickAdd.saving') : t('quickAdd.save')}
            </button>
          </div>
        }
      >
        <form id={formId} onSubmit={createContact} className="space-y-4">
          {errorLabel && (
            <p
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm leading-6 text-red-700"
            >
              {errorLabel}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">
                {t('quickAdd.name')}
              </span>
              <input
                name="name"
                type="text"
                autoComplete="name"
                maxLength={120}
                className="input min-h-11 w-full text-base sm:text-sm"
                placeholder={t('quickAdd.namePlaceholder')}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">
                {t('quickAdd.phone')}
              </span>
              <input
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                dir="ltr"
                maxLength={32}
                className="input min-h-11 w-full text-start text-base sm:text-sm"
                placeholder={locale === 'fa' ? '۰۹۱۲۱۲۳۴۵۶۷' : '+98 912 123 4567'}
              />
            </label>
          </div>

          <div>
            <span className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">
              {t('stage')}
            </span>
            <MaterialSelect
              value={stage}
              onValueChange={(value) => setStage(value as ContactStage)}
              ariaLabel={t('stage')}
              options={CONTACT_STAGES.map((value) => ({
                value,
                label: t(STAGE_KEY[value]),
              }))}
            />
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">
              {t('detail.tags')}
            </span>
            <input
              name="tags"
              type="text"
              maxLength={420}
              className="input min-h-11 w-full text-base sm:text-sm"
              placeholder={t('detail.tagsPlaceholder')}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">
              {t('detail.notes')}
            </span>
            <textarea
              name="notes"
              maxLength={5000}
              rows={4}
              className="input w-full resize-y py-3 text-base sm:text-sm"
              placeholder={t('detail.notesPlaceholder')}
            />
          </label>

          <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border border-[var(--border-default)] bg-white p-3">
            <input
              type="checkbox"
              checked={marketingOptIn}
              onChange={(event) => setMarketingOptIn(event.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 accent-black"
            />
            <span className="min-w-0">
              <span className="block text-xs font-semibold text-[var(--text-primary)]">
                {t('detail.consentLabel')}
              </span>
              <span className="mt-1 block text-[11px] leading-5 text-[var(--text-muted)]">
                {t('detail.consentHint')}
              </span>
            </span>
          </label>
        </form>
      </MobileBottomSheet>
    </>
  )
}
