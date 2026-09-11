/**
 * Admin-only improvement skills — registry.
 *
 * The seven post-hoc analysis skills that turn the improvement center into a
 * measurable learning loop. This module is intentionally dependency-free so
 * both the server engine and the admin client components can import it.
 *
 * Visibility contract: every finding these skills produce is stored in
 * SkillFinding and surfaced ONLY under /admin/skills (platform owner).
 * Workspace users never see them and are never billed for them.
 */

export type SkillKey =
  | 'knowledge-gap'
  | 'tool-failure'
  | 'post-change'
  | 'before-after'
  | 'tone-coach'
  | 'knowledge-conflict'
  | 'preference-guard'

/** FREE = deterministic database analysis (zero AI cost, scheduler-safe).
 *  DEEP = sampled LLM analysis paid from the platform AI budget, manual runs only. */
export type SkillCostClass = 'FREE' | 'DEEP'

export interface SkillMeta {
  key: SkillKey
  nameFa: string
  nameEn: string
  cost: SkillCostClass
  phase: 1 | 2 | 3
  descFa: string
  version: string
}

export const SKILLS_VERSION = '2026.09.11'

export const SKILL_REGISTRY: readonly SkillMeta[] = Object.freeze([
  {
    key: 'knowledge-gap',
    nameFa: 'شکارچی سوال‌های بی‌جواب',
    nameEn: 'Knowledge Gap Curator',
    cost: 'FREE',
    phase: 1,
    descFa: 'پیام‌های مشتری که بدون پاسخ ماندند و موضوع‌های دانش‌نامه‌ای که ایجنت جوابشان را نمی‌داند را جمع می‌کند تا پاسخشان ثبت شود.',
    version: '1.0.0',
  },
  {
    key: 'tool-failure',
    nameFa: 'کارآگاه خطاها',
    nameEn: 'Tool Failure Investigator',
    cost: 'FREE',
    phase: 1,
    descFa: 'خطاهای مدل، ادعای متن با تعداد کارت‌های ارسالی ناسازگار، و بررسی کاتالوگ بدون ارائه محصول را از رسیدهای پیام‌ها کشف می‌کند.',
    version: '1.0.0',
  },
  {
    key: 'post-change',
    nameFa: 'نگهبان بعد از فیکس',
    nameEn: 'Post-change Monitor',
    cost: 'FREE',
    phase: 1,
    descFa: 'بعد از هر اصلاح اعمال‌شده، گفتگوهای بعدی را می‌سنجد؛ اگر همان مشکل تکرار شد هشدار رگرسیون می‌دهد و اگر پاک بود یافته را خودکار می‌بندد.',
    version: '1.0.0',
  },
  {
    key: 'before-after',
    nameFa: 'ترازوی قبل/بعد',
    nameEn: 'Before/After Evaluation',
    cost: 'FREE',
    phase: 2,
    descFa: 'نرخ حل گفتگو، بی‌پاسخی و خطای مدل را در ۷ روز قبل و بعد از هر تغییر می‌سنجد و افت یا بهبود واقعی را با عدد اعلام می‌کند.',
    version: '1.0.0',
  },
  {
    key: 'tone-coach',
    nameFa: 'مربی لحن',
    nameEn: 'Tone & Conversation Flow Coach',
    cost: 'DEEP',
    phase: 3,
    descFa: 'نمونه‌ای از گفتگوهای اخیر را با هوش مصنوعی بررسی می‌کند؛ لحن سرد یا خشک و پرش‌های نامنظم گفتگو را با پیشنهاد بازنویسی گزارش می‌دهد.',
    version: '1.0.0',
  },
  {
    key: 'knowledge-conflict',
    nameFa: 'حل‌کننده تناقض دانش',
    nameEn: 'Knowledge Conflict Resolver',
    cost: 'DEEP',
    phase: 3,
    descFa: 'مدخل‌های دانش‌نامه هر ایجنت را دوبه‌دو مقایسه می‌کند و جفت‌هایی که به یک سوال پاسخ‌های متفاوت می‌دهند را با نقل‌قول هر دو پاسخ گزارش می‌کند.',
    version: '1.0.0',
  },
  {
    key: 'preference-guard',
    nameFa: 'حافظه سلیقه مشتری',
    nameEn: 'Customer Preference Guard',
    cost: 'FREE',
    phase: 3,
    descFa: 'ترجیحات صریح مشتری (مثل «فقط خاکستری») را در برابر پیشنهادهای بعدی ایجنت می‌سنجد و نقض احتمالی را برای بررسی شما علامت می‌زند.',
    version: '1.0.0',
  },
])

export const FREE_SKILL_KEYS: readonly SkillKey[] = SKILL_REGISTRY.filter((s) => s.cost === 'FREE').map((s) => s.key)
export const DEEP_SKILL_KEYS: readonly SkillKey[] = SKILL_REGISTRY.filter((s) => s.cost === 'DEEP').map((s) => s.key)

export function skillMeta(key: string): SkillMeta | undefined {
  return SKILL_REGISTRY.find((s) => s.key === key)
}

/** Persian display name for a raw skill key (findings store the key only). */
export function skillNameFa(key: string): string {
  return skillMeta(key)?.nameFa ?? key
}

export const SKILL_FINDING_STATUSES = ['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED'] as const
export type SkillFindingStatus = (typeof SKILL_FINDING_STATUSES)[number]

export const SEVERITIES = ['HIGH', 'MEDIUM', 'LOW'] as const
export type SkillSeverity = (typeof SEVERITIES)[number]
