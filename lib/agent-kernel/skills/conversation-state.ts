import {
  detectConversationQuestionSlot,
  type ConversationWorkingState,
} from '@/lib/ai/conversation-state'

export type ConversationContinuityGuardCode =
  | 'REPEATED_GREETING'
  | 'RESTARTED_DISCOVERY'
  | 'REPEATED_FILLED_QUESTION'

const LEADING_GREETING_RE = /^(?:(?:سلام|درود|خوش\s*(?:آمدید|اومدید)|خوشحال\s*می\s*(?:شم|شوم)\s*(?:که\s*)?(?:کمک(?:تون|تان)?\s*(?:کنم|کنیم)|در\s*خدمتم)|ممنون\s*(?:که\s*)?(?:پیام\s*دادید|پیام\s*دادی|پیگیری\s*کردید|پیگیری\s*کردی|از\s*(?:پیام|پیگیری)(?:تون|تان|ت)?)|hi|hello|hey|welcome|happy\s+to\s+help|thanks?\s+for\s+(?:your\s+message|following\s+up|reaching\s+out))[\s!،,.؛:~-]*)/iu
const RESTART_DISCOVERY_RE = /(?:چطور\s*می\s*(?:تونم|توانم)\s*کمک|چه\s*کمکی\s*(?:می\s*)?(?:تونم|توانم)|دنبال\s*چه\s*(?:محصول|کالا|خدمت)|چه\s*(?:محصول|کالا|خدمتی)\s*(?:می\s*)?(?:خوای|خواهید|میخواهید)|از\s*اول\s*(?:بگید|بگو)|how\s+can\s+i\s+help|what\s+can\s+i\s+help\s+with|what\s+(?:product|item|service)\s+are\s+you\s+looking\s+for)/iu

function splitReply(reply: string): string[] {
  return reply
    .split(/(?<=[.!؟?])\s+|\n+/u)
    .map((part) => part.trim())
    .filter(Boolean)
}

function questionKey(part: string): string | null {
  if (!/[؟?]/u.test(part)) return null
  return detectConversationQuestionSlot(part)
}

function plainlyReasksFilledSlot(part: string, key: string): boolean {
  const patterns: Record<string, RegExp> = {
    style: /(?:چه|کدام|کدوم)\s*(?:نوع\s*)?(?:سبک|استایل)|سبک\s*(?:مدنظر|مورد\s*نظر)|مدرن\s*یا\s*کلاسیک|what\s+style|which\s+style/iu,
    color: /(?:چه|کدام|کدوم)\s*رنگ|رنگ\s*(?:مدنظر|مورد\s*نظر|دلخواه)|what\s+colou?r|which\s+colou?r/iu,
    size: /(?:چه|کدام|کدوم)\s*(?:سایز|اندازه|ابعاد|قد)|(?:سایز|اندازه|ابعاد|قد)(?:تون|تان|ت)\s*(?:چند|چقد)|what\s+(?:size|dimensions?)|which\s+(?:size|dimensions?)/iu,
    budget: /بودجه(?:تون|تان|ت)?\s*(?:چند|چقد)|حدود\s*قیمت\s*(?:مدنظر|مورد\s*نظر)|what(?:'s|\s+is)?\s+your\s+budget|price\s+range/iu,
    location: /(?:کدام|کدوم|چه)\s*(?:شهر|منطقه|محله)|(?:شهر|منطقه|محله)(?:تون|تان|ت)?\s*(?:کجاست|چیه)|where\s+are\s+you|what\s+city|which\s+(?:city|district)/iu,
    date: /(?:چه|کدام|کدوم)\s*(?:روز|تاریخ)|چه\s*زمانی|what\s+(?:day|date)|which\s+(?:day|date)|when\s+(?:works|is\s+good)/iu,
    time: /(?:چه|کدام|کدوم)\s*(?:ساعت|بازه)|چه\s*وقتی|what\s+time|which\s+time/iu,
    quantity: /چند\s*(?:تا|عدد|دونه|نفر)|چه\s*تعداد|how\s+many|what\s+quantity/iu,
    material: /(?:چه|کدام|کدوم)\s*(?:جنس|پارچه|متریال)|what\s+material|which\s+(?:material|fabric)/iu,
    use_case: /برای\s*(?:چه|چی)|چه\s*کاربرد|کجا\s*استفاده|what\s+for|use\s+case/iu,
    product: /(?:چه|کدام|کدوم)\s*(?:محصول|کالا)|دنبال\s*چه|what\s+(?:product|item)/iu,
    service: /(?:چه|کدام|کدوم)\s*(?:خدمت|سرویس)|what\s+service|which\s+service/iu,
    order_number: /(?:شماره|کد)\s*(?:سفارش|پیگیری)(?:تون|تان|ت)?\s*(?:چیه|چند)|what(?:'s|\s+is)?\s+(?:the|your)\s+(?:order|tracking)\s*(?:number|code)/iu,
  }
  return patterns[key]?.test(part) ?? false
}

function recoveryReply(state: ConversationWorkingState, isFa: boolean): string {
  const subject = state.searchAnchors[0]
    || state.activeEntity?.label
    || state.activeGoal?.label
    || ''
  const answer = state.lastAnswer?.value || state.constraints.at(-1)?.value || ''
  if (isFa) {
    if (answer && subject) return `متوجه شدم؛ «${answer}» را برای ${subject} در نظر گرفتم`
    if (answer) return `متوجه شدم؛ «${answer}» را در ادامهٔ همان درخواست در نظر گرفتم`
    return 'متوجه شدم؛ با همین اطلاعات ادامه می‌دم'
  }
  if (answer && subject) return `Got it — I’ll use “${answer}” for ${subject}`
  if (answer) return `Got it — I’ll carry “${answer}” into the same request`
  return 'Got it — I’ll continue with the details already provided'
}

/**
 * Conservative final-response guard. It only edits unmistakable continuity
 * failures and returns byte-for-byte identical text for normal replies.
 */
export function enforceConversationContinuity(params: {
  reply: string
  state?: ConversationWorkingState | null
  isFa: boolean
}): { reply: string; codes: ConversationContinuityGuardCode[] } {
  const state = params.state
  const relation = state?.lastTurn?.relation
  if (!state?.activeGoal || !relation
    || !['ANSWER', 'REFINEMENT', 'REFERENCE', 'CORRECTION'].includes(relation)) {
    return { reply: params.reply, codes: [] }
  }

  const original = params.reply
  let output = original.trim()
  const codes: ConversationContinuityGuardCode[] = []
  let withoutGreeting = output
  // Models occasionally stack two openings («سلام! ممنون که پیام دادید.»).
  // Remove the whole opening run, with a small hard bound for safety.
  for (let index = 0; index < 3; index += 1) {
    const next = withoutGreeting.replace(LEADING_GREETING_RE, '').trimStart()
    if (next === withoutGreeting) break
    withoutGreeting = next
  }
  if (withoutGreeting !== output && withoutGreeting) {
    output = withoutGreeting
    codes.push('REPEATED_GREETING')
  }

  const filledKeys = new Set(Object.keys(state.slots))
  const kept: string[] = []
  let dropRestartOptions = false
  for (const part of splitReply(output)) {
    if (RESTART_DISCOVERY_RE.test(part)) {
      if (!codes.includes('RESTARTED_DISCOVERY')) codes.push('RESTARTED_DISCOVERY')
      dropRestartOptions = true
      continue
    }
    if (dropRestartOptions && /[؟?]/u.test(part) && /(?:یا|or)/iu.test(part) && part.length <= 180) {
      continue
    }
    dropRestartOptions = false
    const key = questionKey(part)
    if (key && key !== 'answer' && filledKeys.has(key) && plainlyReasksFilledSlot(part, key)) {
      if (!codes.includes('REPEATED_FILLED_QUESTION')) codes.push('REPEATED_FILLED_QUESTION')
      continue
    }
    kept.push(part)
  }
  if (codes.length === 0) return { reply: original, codes: [] }
  output = kept.join(' ').trim()
  if (!output) output = recoveryReply(state, params.isFa)
  return { reply: output, codes }
}
