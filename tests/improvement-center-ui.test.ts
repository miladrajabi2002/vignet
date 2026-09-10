import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'components/agents/improvement-center.tsx'), 'utf8')

describe('improvement center interaction contract', () => {
  it('keeps analysis in one flow with an automatic live estimate', () => {
    expect(source).toContain("body: JSON.stringify({ action: 'estimate', selection })")
    expect(source).toContain("t('برآورد زندهٔ تحلیل', 'Live analysis estimate')")
    expect(source).toContain("t(`شروع تحلیل ${number(estimate.count)} گفتگو`")
    expect(source).not.toContain("t('بررسی انتخاب و مصرف', 'Review selection and usage')")
  })

  it('uses a touch-friendly range and removes duplicate conversation navigation', () => {
    expect(source).toContain('type="range" min={10} max={500} step={5}')
    expect(source).toContain("['suggestions', 'history'] as const")
    expect(source).not.toContain('analysis-panel-conversations')
    expect(source).not.toContain('تحلیل دوبارهٔ گفتگوی بدون تغییر')
  })

  it('shows functional search feedback and live run usage', () => {
    expect(source).toContain("t('پاک کردن جستجو', 'Clear search')")
    expect(source).toContain("t('گفتگوهای پردازش‌شده', 'Processed conversations')")
    expect(source).toContain("t('درخواست‌های موفق', 'Successful requests')")
    expect(source).toContain("t('مصرف تا این لحظه', 'Usage so far')")
    expect(source).not.toContain("t('انجام شد.', 'Done.')")
  })

  it('shows animated evaluation feedback and keeps tested suggestions identifiable', () => {
    expect(source).toContain("t('در حال تست و ارزیابی…', 'Testing & evaluating…')")
    expect(source).toContain("t('در حال تست و ارزیابی', 'Testing & evaluating')")
    expect(source).toContain("t('تست‌شده · بهتر', 'Tested · improved')")
    expect(source).toContain("t('تست‌شده · نیاز به اصلاح', 'Tested · needs revision')")
    expect(source).toContain('isTesting && !preview')
  })

  it('uses channel profile images in manual selection and a compact desktop analysis dialog', () => {
    expect(source).toContain('contactAvatarSrc({')
    expect(source).toContain('<ContactAvatar src={avatarSrc}')
    expect(source).toContain("compact={selection.mode === 'latest'}")
    expect(source).toContain("compact && 'md:space-y-3 md:px-4 md:py-3'")
  })

  it('keeps the primary suggestion action beside delete with readable mobile labels', () => {
    expect(source).toContain("grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]")
    expect(source).toContain("sm:grid-cols-[minmax(12rem,1fr)_auto]")
    expect(source).toContain("t('تست و ارزیابی', 'Test & evaluate')")
    expect(source).toContain('whitespace-normal px-2 py-2 text-xs leading-5')
    expect(source).toContain('<span>{t(\'حذف پیشنهاد\', \'Delete suggestion\')}</span>')
  })

  it('presents change history clearly with a direct, confirmed restore action', () => {
    expect(source).toContain("t('تغییرهای انجام‌شده', 'Changes made')")
    expect(source).toContain("t('اکنون فعال است', 'Active now')")
    expect(source).toContain("t('بازگردانی تغییر', 'Restore previous state')")
    expect(source).toContain("title={t('این تغییر بازگردانده شود؟', 'Restore the previous state?')}")
    expect(source).toContain("t('گزارش‌های تحلیل', 'Analysis reports')")
    expect(source).not.toContain("t('تغییرهای بررسی‌شده', 'Reviewed changes')")
  })
})
