import { evaluateLearningEligibility } from '@/lib/ai/learning-policy'

export const LEARNING_REVIEW_VERSION = 'intent-review-v1'

export function learningRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {}
}

export function normalizeLearningText(value: string): string {
  return value.normalize('NFKC').replace(/[۰-۹٠-٩]/g, (digit) =>
    String('۰۱۲۳۴۵۶۷۸۹'.includes(digit) ? '۰۱۲۳۴۵۶۷۸۹'.indexOf(digit) : '٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[\s\u200c]+/g, ' ').trim().toLowerCase()
}

/** A cheap display gate. Ambiguous requests still go to contextual AI review. */
export function isLearningNoise(question: string, answer = ''): boolean {
  const text = normalizeLearningText(question)
  if (!text || /^(سلام|درود|مرسی|ممنون|سپاس|باشه|بله|نه|اوکی|ok|thanks|thank you|hello|hi)[!?.؟\s]*$/iu.test(text)) return true
  if (/^(?:قیمت(?:\s+لطفا)?|مدل(?:ه)?\s+(?:اول|دوم|سوم|چهارم|پنجم)|کد(?:\s+کالا)?\s*\d+|بله\s+لطفا\s+کاتالوگ)[!?.؟\s]*$/u.test(text)) return true
  if (answer && (/^[a-z\s]{1,8}$/i.test(answer.trim()) && !/[aeiou]/i.test(answer))) return true
  if (!answer && /(?:کد\s*\d+.*موجود|قیمت\s+(?:این|اون)\s+\S+|\d+\s*(?:تومن|تومان|ریال)|همون\s+سایز|این\s+مدل\s+باشه)/u.test(text)) return true
  return false
}

export interface LearningQueueItem {
  id: string
  question: string
  originalQuestion: string
  summary?: string
  conversationId: string
  operatorAnswer?: string
  analyzed: boolean
}

export function learningItemFromMessage(row: {
  id: string; metadata: unknown; conversationId: string
}): LearningQueueItem | null {
  const meta = learningRecord(row.metadata)
  const review = learningRecord(meta.learningReview)
  const originalQuestion = typeof meta.question === 'string' ? meta.question.trim() : ''
  const analyzed = review.version === LEARNING_REVIEW_VERSION
  if (analyzed && review.eligible !== true) return null
  const question = analyzed && typeof review.question === 'string' ? review.question.trim() : originalQuestion
  const operatorAnswer = analyzed && typeof review.answer === 'string'
    ? review.answer.trim() : typeof meta.operatorAnswer === 'string' ? meta.operatorAnswer.trim() : undefined
  if (!question || isLearningNoise(question, operatorAnswer)) return null
  if (!evaluateLearningEligibility(question, operatorAnswer ?? '').eligible) return null
  return {
    id: row.id, question, originalQuestion, conversationId: row.conversationId,
    summary: analyzed && typeof review.summary === 'string' ? review.summary : undefined,
    operatorAnswer, analyzed,
  }
}

export function uniqueLearningItems(rows: Parameters<typeof learningItemFromMessage>[0][]): LearningQueueItem[] {
  const seen = new Set<string>()
  return rows.flatMap((row) => {
    const item = learningItemFromMessage(row)
    if (!item) return []
    const key = normalizeLearningText(item.question)
    if (seen.has(key)) return []
    seen.add(key)
    return [item]
  })
}
