import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('simplified onboarding flow', () => {
  it('starts business names empty and resets scroll between phases', () => {
    const flow = read('components/onboarding/onboarding-flow.tsx')

    expect(flow).toContain("initialProfile?.businessName ?? ''")
    expect(flow).toContain('setDetailsFromTypeSelection(true)')
    expect(flow).toContain('initialProfile={detailsFromTypeSelection ? null : businessProfile}')
    expect(flow).toContain("window.scrollTo({ top: 0, behavior: 'auto' })")
  })

  it('scrolls to, focuses, and explains the empty business-name field inline', () => {
    const flow = read('components/onboarding/onboarding-flow.tsx')

    expect(flow).toContain("field?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' })")
    expect(flow).toContain('field?.focus({ preventScroll: true })')
    expect(flow).toContain('aria-invalid={nameInvalid}')
    expect(flow).toContain("nameInvalid && 'border-red-500")
    expect(flow).toContain('این فیلد خالی است؛ لطفاً نام کسب‌وکار را وارد کنید.')
    expect(flow).toContain('role="alert"')
    expect(flow).not.toContain('id="business-name-error" className="sr-only"')
    expect(flow).not.toContain("setError('نام کسب‌وکار را وارد کنید')")
  })

  it('offers recommended and customized agents without the AI draft builder', () => {
    const flow = read('components/onboarding/onboarding-flow.tsx')
    const wizard = read('components/agent-builder/agent-wizard.tsx')

    // One screen: name, tone and greeting with a live preview; the full
    // wizard stays one link away for owners who want to customize.
    expect(flow).toContain("setupMode: 'recommended'")
    expect(flow).toContain('ساخت ایجنت و ادامه')
    expect(flow).toContain('تنظیمات بیشتر: نقش، قوانین و تحویل به اپراتور')
    expect(flow).not.toContain('انتخاب و ساخت خودکار')
    expect(flow).toContain('href={customHref}')
    expect(wizard).toContain('const TOTAL = 2')
    expect(wizard).toContain('بازگشت به راه‌اندازی')
    expect(wizard).toContain("router.push('/onboarding')")
    expect(wizard).not.toContain('آمادگی RAG و دانش')
    expect(wizard).not.toContain('<ModelSelect')
    expect(wizard).not.toContain("t('description')")
    expect(existsSync(join(process.cwd(), 'components/agent-builder/agent-builder-entry.tsx'))).toBe(false)
    expect(existsSync(join(process.cwd(), 'components/agent-builder/vigento-composer.tsx'))).toBe(false)
    expect(existsSync(join(process.cwd(), 'app/api/agents/draft/route.ts'))).toBe(false)
  })

  it('keeps products optional and uses plain-language connected apps', () => {
    const flow = read('components/onboarding/onboarding-flow.tsx')
    const shell = read('components/onboarding/onboarding-shell.tsx')

    expect(flow).not.toContain('/products/new?onboarding=1')
    // Products stay optional: three ways to give the agent something to
    // answer from, each skippable, then the apps as tiles in the same screen.
    expect(flow).toContain('سایت وردپرس یا ووکامرس دارم')
    expect(flow).toContain('چند محصول را همین‌جا وارد می‌کنم')
    expect(flow).toContain('فایل یا متن معرفی دارم')
    expect(flow).toContain('فعلاً رد می‌کنم')
    expect(flow).toContain('مشتری از کجا پیام بدهد؟')
    expect(flow).toContain('ساخت لینک')
    expect(shell).toContain("label: 'اتصال برنامه'")
  })

  it('orders remaining dashboard work before completed onboarding tasks', () => {
    const checklist = read('components/dashboard/completion-checklist.tsx')

    expect(checklist).toContain('knowledgePostponed')
    expect(checklist).toContain('channelPostponed')
    expect(checklist).toContain('...items.filter((item) => !item.done)')
    expect(checklist).toContain('کارهایی که در آنبوردینگ انجام دادید تکمیل شده‌اند')
  })
})
