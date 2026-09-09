import { normalizeSalesText } from '@/lib/ai/sales-intelligence'
import { draftSchema, normalizedTopic, type ReviewResult, type TranscriptMessage } from './types'

type KnowledgeSource = {
  id: string
  name: string
  chunks: { content: string }[]
}

/**
 * Detect a concrete routing defect without asking the model to infer it:
 * a configured handoff keyword caused a real handoff even though a ready
 * knowledge source containing that same topic was retrieved for the turn.
 * The result remains a manual TOOL action because removing a handoff rule can
 * change business escalation policy and must not be applied automatically.
 */
export function handoffKnowledgeConflictFindings(input: {
  language: 'fa' | 'en'
  messages: TranscriptMessage[]
  seenMessageIds: Set<string>
  handoffKeywords: string[]
  handoffReasons: string[]
  sources: KnowledgeSource[]
}): ReviewResult['findings'] {
  const findings: ReviewResult['findings'] = []
  for (const rawKeyword of input.handoffKeywords) {
    const keyword = rawKeyword.trim()
    const normalizedKeyword = normalizeSalesText(keyword)
    if (!normalizedKeyword) continue
    const causedHandoff = input.handoffReasons.some((reason) => normalizeSalesText(reason).includes(normalizedKeyword))
    if (!causedHandoff) continue
    const sources = input.sources.filter((source) => source.chunks.some((chunk) => normalizeSalesText(chunk.content).includes(normalizedKeyword)))
    if (!sources.length) continue
    const messageIndex = input.messages.findIndex((message) => message.role === 'USER' && input.seenMessageIds.has(message.id) && normalizeSalesText(message.content).includes(normalizedKeyword))
    if (messageIndex < 0) continue
    const customerMessage = input.messages[messageIndex]
    const followingReply = input.messages.slice(messageIndex + 1).find((message) => message.role === 'ASSISTANT' && input.seenMessageIds.has(message.id))
    const messageIds = [customerMessage.id, ...(followingReply ? [followingReply.id] : [])]
    const sourceNames = [...new Set(sources.map((source) => source.name))].slice(0, 3).join(input.language === 'fa' ? '، ' : ', ')
    findings.push({
      kind: 'TOOL',
      scope: 'AGENT',
      topicKey: normalizedTopic(`handoff knowledge conflict ${keyword}`),
      title: input.language === 'fa'
        ? `جلوگیری از انتقال زودهنگام موضوع «${keyword}»`
        : `Prevent premature handoff for “${keyword}”`,
      diagnosis: input.language === 'fa'
        ? `پیام مشتری با کلیدواژهٔ انتقال «${keyword}» منطبق شده، در حالی که دانش آمادهٔ مرتبط (${sourceNames}) برای پاسخ وجود داشته است. قانون انتقال پیش از استفاده از دانش اجرا شده؛ آن را محدود کنید تا ایجنت ابتدا از دانش پاسخ دهد و فقط در صورت نیاز واقعی یا درخواست صریح مشتری گفتگو را تحویل دهد.`
        : `The customer message matched the “${keyword}” handoff keyword even though relevant ready knowledge (${sourceNames}) was available. Routing ran before knowledge could be used; narrow the rule so the agent answers from knowledge first and hands off only when genuinely needed or explicitly requested.`,
      priority: 'HIGH',
      messageIds,
      draft: draftSchema.parse({
        missing: input.language === 'fa'
          ? `در تنظیمات ایجنت، کلیدواژهٔ انتقال «${keyword}» را حذف یا به عبارت صریح درخواست اپراتور محدود کنید؛ سپس یک سؤال مشابه را دوباره آزمایش کنید.`
          : `Remove the “${keyword}” handoff keyword in agent settings or narrow it to an explicit request for a human, then retest a similar question.`,
      }),
    })
    if (findings.length >= 8) break
  }
  return findings
}
