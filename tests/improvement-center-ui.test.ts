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
})
