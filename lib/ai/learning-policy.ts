export const LEARNING_POLICY_VERSION = 'learning-eligibility-v1'

export type LearningBlockReason =
  | 'PERSONAL_DATA'
  | 'ORDER_SPECIFIC'
  | 'TIME_SENSITIVE'
  | 'VOLATILE_COMMERCIAL_DATA'
  | 'SECRET_OR_CREDENTIAL'

export interface LearningEligibility {
  eligible: boolean
  reasonCodes: LearningBlockReason[]
  policyVersion: string
}

const RULES: Array<{ code: LearningBlockReason; pattern: RegExp }> = [
  {
    code: 'PERSONAL_DATA',
    pattern:
      /(?:\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|(?:\+?98|0)?9\d{9}\b|(?:\d[ -]?){16}\b|کد\s*ملی|شماره\s*(?:کارت|حساب|شبا|تماس)|(?:آدرس|نشانی)\s+(?:شما|من|مشتری)|(?:خیابان|کوچه|پلاک)\s+\S+|national\s+id|card\s+number|phone\s+number|your\s+address|customer\s+address)/iu,
  },
  {
    code: 'SECRET_OR_CREDENTIAL',
    pattern:
      /(?:رمز\s*(?:عبور|یکبار|پویا)?|کد\s*(?:ورود|تأیید|تایید)|توکن|کلید\s*API|password|passcode|one[ -]?time\s+code|otp|api\s*key|access\s*token)/iu,
  },
  {
    code: 'ORDER_SPECIFIC',
    pattern:
      /(?:(?:سفارش|مرسوله|فاکتور|تراکنش|پرداخت|استرداد|مرجوعی)\s*(?:من|شما|تان|تون|م|ت)|(?:سفارش|مرسوله|فاکتور|پیگیری)\s*(?:شماره|کد|#)\s*[A-Z0-9_-]+|کد\s*پیگیری|وضعیت\s+(?:سفارش|مرسوله|پرداخت)\s+(?:من|شما)|my\s+(?:order|shipment|invoice|payment|refund)|your\s+(?:order|shipment|invoice|payment|refund)|order\s*(?:id|number|#)\s*[:#-]?\s*[A-Z0-9_-]+)/iu,
  },
  {
    code: 'TIME_SENSITIVE',
    pattern:
      /(?:امروز|فردا|دیروز|همین\s+الان|فعلاً|در\s+حال\s+حاضر|این\s+هفته|today|tomorrow|yesterday|right\s+now|currently|this\s+week)/iu,
  },
  {
    code: 'VOLATILE_COMMERCIAL_DATA',
    pattern:
      /(?:(?:قیمت|هزینه|مبلغ)\s*(?:برای\s+شما|نهایی)|(?:\d[\d,.]*)\s*(?:تومان|ریال|دلار|یورو)|(?:تخفیف|کد\s*تخفیف)\s*(?:شما|اختصاصی)|(?:الان|فعلاً)\s+موجود|(?:price|total)\s+(?:for\s+you|is)\s*[$€£]?\d|[$€£]\s*\d|your\s+(?:discount|quote)|currently\s+in\s+stock)/iu,
  },
]

/**
 * Conservative gate for turning a human reply into reusable public knowledge.
 * It never decides that content is true; it only keeps clearly personal,
 * transactional or volatile content out of the Learning Center review queue.
 */
export function evaluateLearningEligibility(
  question: string,
  answer: string,
): LearningEligibility {
  const sample = `${question}\n${answer}`.normalize('NFKC')
  const reasonCodes = RULES
    .filter((rule) => rule.pattern.test(sample))
    .map((rule) => rule.code)

  return {
    eligible: reasonCodes.length === 0,
    reasonCodes: [...new Set(reasonCodes)],
    policyVersion: LEARNING_POLICY_VERSION,
  }
}

export function isEligibleOperatorLearningMetadata(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return false
  const learning = (metadata as Record<string, unknown>).learningCandidate
  return !!learning &&
    typeof learning === 'object' &&
    !Array.isArray(learning) &&
    (learning as Record<string, unknown>).eligible === true
}
