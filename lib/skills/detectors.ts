/**
 * Admin-only improvement skills — pure detectors.
 *
 * Every detector is a pure function over plain data shapes so the whole
 * diagnosis layer is unit-testable without a database. The engine
 * (lib/skills/engine.ts) is responsible for querying PostgreSQL, mapping rows
 * into these inputs, and persisting the returned drafts.
 *
 * Shared invariants:
 *  - Findings are diagnoses for the PLATFORM OWNER only; drafts never mutate
 *    workspace data and never touch user wallets.
 *  - `clean` lists dedupe keys whose problem demonstrably disappeared in this
 *    scan; the engine auto-resolves matching OPEN findings with a note.
 *  - Evidence is bounded (sliced quotes) — never whole transcripts.
 */

import { planProductRequest } from '@/lib/ai/conversation'
import type { SkillKey, SkillSeverity } from './registry'

export interface FindingDraft {
  skillKey: SkillKey
  dedupeKey: string
  workspaceId: string
  agentId?: string | null
  conversationId?: string | null
  contactId?: string | null
  severity: SkillSeverity
  title: string
  diagnosis: string
  evidence?: Record<string, unknown>
  suggestedAction?: Record<string, unknown>
  /** Timestamp of the freshest evidence — becomes lastSeenAt. */
  seenAt?: Date
  /** Positive confirmations (e.g. a metric improved) land already resolved. */
  initialStatus?: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED'
}

export interface DetectorResult {
  findings: FindingDraft[]
  clean: string[]
  cleanNote?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

const SEVERITY_RANK: Record<SkillSeverity, number> = { LOW: 1, MEDIUM: 2, HIGH: 3 }

export function maxSeverity(a: SkillSeverity, b: SkillSeverity): SkillSeverity {
  return SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b
}

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩'
const NUMBER_WORDS: Record<string, number> = {
  یک: 1, دو: 2, سه: 3, چهار: 4, پنج: 5, شش: 6, هفت: 7, هشت: 8, نه: 9, ده: 10,
  یازده: 11, دوازده: 12, سیزده: 13, چهارده: 14, پانزده: 15, بیست: 20,
}

/** Parse a Persian/Latin digit run or a small Persian number word. */
export function parseFaNumber(token: string): number | null {
  const latin = token
    .replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)))
  if (/^\d{1,3}$/.test(latin)) return Number.parseInt(latin, 10)
  return NUMBER_WORDS[token] ?? null
}

const PRODUCT_COUNT_NOUNS = 'محصول|کارت|مدل|گزینه|پیشنهاد|پیشنهادات|محصولات'
/** Markers that turn a numeric mention into a NEGATIVE claim (not a promise). */
const NEGATIVE_CONTEXT_RE = /ناموجود|تم[او]م\s?شد|تم[او]مش|اتمام|نشد|نمی\s?شود|نداریم|منتفی/i

/**
 * Highest product-count the assistant TEXT promises («۱۰ محصول…», «هشت مدل…»,
 * or a numbered list of at least 3 items). Used by the tool-failure skill to
 * compare the promise against the cards actually delivered.
 */
export function claimedProductCount(content: string): number | null {
  let best: number | null = null
  const claim = new RegExp(`(^|[\\s:،,(«"])([۰-۹0-9]{1,3}|یک|دو|سه|چهار|پنج|شش|هفت|هشت|نه|ده)\\s*(?:تا\\s+)?(?:${PRODUCT_COUNT_NOUNS})`, 'gu')
  for (const match of content.matchAll(claim)) {
    const at = match.index ?? 0
    const around = content.slice(Math.max(0, at - 30), at + 60)
    if (NEGATIVE_CONTEXT_RE.test(around)) continue // «۲ مدل ناموجود شد» is not a promise
    const n = parseFaNumber(match[2] ?? '')
    if (n !== null && (best === null || n > best)) best = n
  }
  const listItems = content.match(/(?:^|\n)\s*[۰-۹0-9]{1,2}[.)-]\s+\S/g)?.length ?? 0
  if (listItems >= 3 && (best === null || listItems > best)) best = listItems
  return best
}

export function receiptCount(receipts: Array<{ kind: string; count?: number }>, kind: string): number {
  for (const receipt of receipts) {
    if (receipt.kind === kind) return typeof receipt.count === 'number' ? receipt.count : 1
  }
  return 0
}

export function hasReceipt(receipts: Array<{ kind: string; count?: number }>, kind: string): boolean {
  return receipts.some((receipt) => receipt.kind === kind)
}

function slug(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[\u064A\u0643]/g, (c) => (c === '\u064A' ? '\u06CC' : '\u06A9'))
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

export function normalizedTopicKey(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/\u064A/g, '\u06CC')
    .replace(/\u0643/g, '\u06A9')
    .toLowerCase()
    .replace(/[\s\u200c_-]+/g, ' ')
    .trim()
}

// ─────────────────────────────────────────────────────────────────────────────
// Skill 1 — Knowledge Gap Curator (FREE)
// ─────────────────────────────────────────────────────────────────────────────

export interface KnowledgeGapAgentInput {
  agentId: string
  workspaceId: string
  agentName?: string
  /** USER messages flagged unanswered inside the window. */
  unanswered: Array<{ messageId: string; conversationId: string; content: string; createdAt: Date }>
  /** Pending KNOWLEDGE suggestions from the improvement center. */
  pendingKnowledge: Array<{
    suggestionId: string
    topicKey: string
    title: string
    diagnosis: string
    draftQuestion: string
    draftAnswer: string
    evidenceConversations: number
  }>
  /** DONE reviews in window whose outcome was UNRESOLVED. */
  unresolvedReviews: number
}

export function detectKnowledgeGaps(agents: KnowledgeGapAgentInput[]): DetectorResult {
  const findings: FindingDraft[] = []
  const clean: string[] = []
  for (const agent of agents) {
    const dedupe = `gap:unanswered:${agent.agentId}`
    if (agent.unanswered.length >= 2) {
      const quotes = agent.unanswered
        .slice(0, 5)
        .map((m) => `• «${m.content.slice(0, 160).replace(/\s+/g, ' ')}»`)
        .join('\n')
      findings.push({
        skillKey: 'knowledge-gap',
        dedupeKey: dedupe,
        workspaceId: agent.workspaceId,
        agentId: agent.agentId,
        severity: agent.unanswered.length >= 8 ? 'HIGH' : 'MEDIUM',
        title: `${agent.unanswered.length} پیام مشتری بدون پاسخ (${agent.agentName ?? 'ایجنت'})`,
        diagnosis: [
          `در ۷ روز اخیر ${agent.unanswered.length} پیام مشتری بدون پاسخ ایجنت مانده است${agent.unresolvedReviews ? ` و ${agent.unresolvedReviews} گفتگوی بررسی‌شده نیز بدون نتیجه تمام شده` : ''}.`,
          'نمونه‌ها:',
          quotes,
          'این پیام‌ها معمولاً سوالی هستند که ایجنت پاسخش را در دانش‌نامه ندارد؛ با ثبت پاسخ، همین سوال دیگر بی‌جواب نمی‌ماند.',
        ].join('\n'),
        evidence: {
          unansweredCount: agent.unanswered.length,
          unresolvedReviews: agent.unresolvedReviews,
          samples: agent.unanswered.slice(0, 5).map((m) => ({ messageId: m.messageId, conversationId: m.conversationId, text: m.content.slice(0, 200), at: m.createdAt.toISOString() })),
        },
        suggestedAction: { type: 'answer_questions', description: 'پاسخ این سوال‌ها را در دانش‌نامه ایجنت ثبت کنید' },
        seenAt: agent.unanswered[0]?.createdAt,
      })
    } else {
      clean.push(dedupe)
    }
    for (const suggestion of agent.pendingKnowledge) {
      findings.push({
        skillKey: 'knowledge-gap',
        dedupeKey: `gap:kb:${suggestion.suggestionId}`,
        workspaceId: agent.workspaceId,
        agentId: agent.agentId,
        severity: suggestion.evidenceConversations >= 3 ? 'HIGH' : 'MEDIUM',
        title: `خلأ دانش باز: ${suggestion.title}`,
        diagnosis: [
          suggestion.diagnosis,
          suggestion.draftQuestion ? `سوال پیشنهادی برای دانش‌نامه: «${suggestion.draftQuestion.slice(0, 200)}»` : '',
          suggestion.draftAnswer ? 'پاسخ پیشنهادی آماده است و فقط تأیید صاحب کسب‌کار را می‌خواهد.' : 'پاسخ هنوز کامل نیست و نیازمند اطلاعات صاحب کسب‌کار است.',
          `شواهد از ${suggestion.evidenceConversations} گفتگوی متفاوت.`,
        ].filter(Boolean).join('\n'),
        evidence: {
          topicKey: suggestion.topicKey,
          question: suggestion.draftQuestion.slice(0, 400),
          hasDraftAnswer: suggestion.draftAnswer.trim().length > 0,
          evidenceConversations: suggestion.evidenceConversations,
        },
        suggestedAction: { type: 'knowledge_suggestion', suggestionId: suggestion.suggestionId, description: 'در مرکز بهبود ایجنت، این پیشنهاد را نهایی و اعمال کنید' },
      })
    }
  }
  return { findings, clean, cleanNote: 'همه پیام‌های اخیر پاسخ گرفته‌اند' }
}

// ─────────────────────────────────────────────────────────────────────────────
// Skill 2 — Tool Failure Investigator (FREE)
// ─────────────────────────────────────────────────────────────────────────────

export interface ReceiptTurnInput {
  messageId: string
  conversationId: string
  agentId: string
  workspaceId: string
  createdAt: Date
  /** Assistant reply text (already sliced by the engine). */
  content: string
  receipts: Array<{ kind: string; count?: number }>
  /** Immediately preceding customer message, when known. */
  userContent?: string
}

export function detectToolFailures(
  agents: Array<{ agentId: string; workspaceId: string; agentName?: string }>,
  turns: ReceiptTurnInput[],
  pendingToolSuggestions: Array<{
    suggestionId: string
    agentId: string
    workspaceId: string
    title: string
    diagnosis: string
    evidenceConversations: number
  }>,
): DetectorResult {
  const findings: FindingDraft[] = []
  const clean: string[] = []
  const agentById = new Map(agents.map((a) => [a.agentId, a]))

  // (a) model_error receipts aggregated per agent
  for (const agent of agents) {
    const errors = turns.filter((t) => t.agentId === agent.agentId && hasReceipt(t.receipts, 'model_error'))
    const dedupe = `tool:modelerror:${agent.agentId}`
    if (errors.length >= 1) {
      findings.push({
        skillKey: 'tool-failure',
        dedupeKey: dedupe,
        workspaceId: agent.workspaceId,
        agentId: agent.agentId,
        severity: errors.length >= 3 ? 'HIGH' : 'MEDIUM',
        title: `${errors.length} خطای سرویس مدل در پاسخ‌های ایجنت (${agent.agentName ?? 'ایجنت'})`,
        diagnosis: [
          `در ۷ روز اخیر ${errors.length} بار مدل پاسخ نهایی نداده و مشتری متن عذرخواهی فنی دریافت کرده است.`,
          errors.slice(0, 3).map((e) => `• ${e.createdAt.toISOString().slice(0, 16).replace('T', ' ')} — گفتگو ${e.conversationId}`).join('\n'),
          'اگر تکرار شود، مدل یا تأمین‌کننده را در «مدل‌ها و سیاست AI» بررسی کنید؛ تایم‌اوت‌ها معمولاً از کندی یا قطعی تأمین‌کننده می‌آیند.',
        ].join('\n'),
        evidence: {
          count: errors.length,
          samples: errors.slice(0, 5).map((e) => ({ messageId: e.messageId, conversationId: e.conversationId, at: e.createdAt.toISOString() })),
        },
        suggestedAction: { type: 'inspect_provider', description: 'سلامت مدل و تأمین‌کننده را در صفحه مدل‌ها بررسی کنید' },
        seenAt: errors[0]?.createdAt,
      })
    } else {
      clean.push(dedupe)
    }
  }

  // (b) per-agent aggregation: promise-vs-delivered mismatches, and explicit
  // showcase requests where the catalog was consulted but nothing was shown.
  // Per-agent (not per-message) keeps the board curated even when a routing
  // defect fires on every turn; occurrences accumulate on the same finding.
  interface MismatchSample { messageId: string; conversationId: string; claimed: number; presented: number; userContent: string; at: Date }
  interface NoshowSample { messageId: string; conversationId: string; catalogChecked: number; userContent: string; at: Date }
  const mismatchesByAgent = new Map<string, MismatchSample[]>()
  const noshowByAgent = new Map<string, NoshowSample[]>()
  for (const turn of turns) {
    const agent = agentById.get(turn.agentId)
    if (!agent) continue
    const presented = receiptCount(turn.receipts, 'products_presented') + receiptCount(turn.receipts, 'products_compared')
    const catalogChecked = receiptCount(turn.receipts, 'catalog_checked')

    if (presented > 0) {
      const claimed = claimedProductCount(turn.content)
      if (claimed !== null && claimed - presented >= 2) {
        const list = mismatchesByAgent.get(turn.agentId) ?? []
        list.push({ messageId: turn.messageId, conversationId: turn.conversationId, claimed, presented, userContent: (turn.userContent ?? '').slice(0, 160), at: turn.createdAt })
        mismatchesByAgent.set(turn.agentId, list)
      }
    }

    if (catalogChecked > 0 && presented === 0 && turn.userContent) {
      // Only an EXPLICIT request to see products ("کاتالوگ بفرست", "شومیز دارین؟")
      // proves the customer expected cards; a passing product mention may be
      // answered in text legitimately. This also avoids vocabulary quirks like
      // «کلاه برداری» tripping a bare product noun.
      const plan = planProductRequest(turn.userContent, [])
      if (plan.explicitShowcase) {
        const list = noshowByAgent.get(turn.agentId) ?? []
        list.push({ messageId: turn.messageId, conversationId: turn.conversationId, catalogChecked, userContent: turn.userContent.slice(0, 160), at: turn.createdAt })
        noshowByAgent.set(turn.agentId, list)
      }
    }
  }
  for (const agent of agents) {
    const mismatches = mismatchesByAgent.get(agent.agentId) ?? []
    const mismatchDedupe = `tool:countmismatch:${agent.agentId}`
    if (mismatches.length) {
      const worstGap = Math.max(...mismatches.map((m) => m.claimed - m.presented))
      findings.push({
        skillKey: 'tool-failure',
        dedupeKey: mismatchDedupe,
        workspaceId: agent.workspaceId,
        agentId: agent.agentId,
        severity: worstGap >= 3 ? 'HIGH' : 'MEDIUM',
        title: `${mismatches.length} پاسخ با تعداد وعده‌داده‌شدهٔ ناسازگار (${agent.agentName ?? 'ایجنت'})`,
        diagnosis: [
          `${mismatches.length} پاسخ ایجنت در متن به تعداد محصولی بیش از کارت‌های واقعاً ارسال‌شده اشاره کرده است.`,
          mismatches.slice(0, 4).map((m) => `• گفتگو ${m.conversationId}: متن ${m.claimed} محصول، کارت ${m.presented}${m.userContent ? ` — درخواست: «${m.userContent.replace(/\s+/g, ' ')}»` : ''}`).join('\n'),
          'این ناسازگاری معمولاً از فیلتر رتبه‌بندی کاتالوگ یا نمایش ناقص کارت‌ها می‌آید؛ گفتگوها را باز کنید تا دقیق‌تر بررسی شود.',
        ].join('\n'),
        evidence: {
          count: mismatches.length,
          samples: mismatches.slice(0, 5).map((m) => ({ messageId: m.messageId, conversationId: m.conversationId, claimed: m.claimed, presented: m.presented, at: m.at.toISOString() })),
        },
        suggestedAction: { type: 'inspect_conversation', conversationId: mismatches[0].conversationId, description: 'گفتگوها را در پنل ادمین باز کنید' },
        seenAt: mismatches[mismatches.length - 1]?.at,
      })
    } else {
      clean.push(mismatchDedupe)
    }

    const noshows = noshowByAgent.get(agent.agentId) ?? []
    const noshowDedupe = `tool:noshow:${agent.agentId}`
    if (noshows.length) {
      findings.push({
        skillKey: 'tool-failure',
        dedupeKey: noshowDedupe,
        workspaceId: agent.workspaceId,
        agentId: agent.agentId,
        severity: noshows.length >= 5 ? 'HIGH' : 'MEDIUM',
        title: `${noshows.length} درخواست صریح محصول بدون ارائهٔ کارت (${agent.agentName ?? 'ایجنت'})`,
        diagnosis: [
          `مشتری صریحاً خواستار دیدن محصولات بوده و ایجنت کاتالوگ را بررسی کرده، اما هیچ کارت محصولی ارسال نشده است.`,
          noshows.slice(0, 4).map((n) => `• «${n.userContent.replace(/\s+/g, ' ')}» — ${n.catalogChecked} ردیف بررسی‌شده، گفتگو ${n.conversationId}`).join('\n'),
          'احتمالاً جستجوی کاتالوگ نتیجهٔ بی‌ربطی داده یا آستانهٔ انتخاب محصول بیش از حد سخت است.',
        ].join('\n'),
        evidence: {
          count: noshows.length,
          samples: noshows.slice(0, 5).map((n) => ({ messageId: n.messageId, conversationId: n.conversationId, catalogChecked: n.catalogChecked, userContent: n.userContent, at: n.at.toISOString() })),
        },
        suggestedAction: { type: 'inspect_conversation', conversationId: noshows[0].conversationId, description: 'گفتگوها را در پنل ادمین باز کنید' },
        seenAt: noshows[noshows.length - 1]?.at,
      })
    } else {
      clean.push(noshowDedupe)
    }
  }

  // (c) open TOOL suggestions from the improvement center — cross-workspace visibility
  for (const suggestion of pendingToolSuggestions) {
    findings.push({
      skillKey: 'tool-failure',
      dedupeKey: `tool:pending:${suggestion.suggestionId}`,
      workspaceId: suggestion.workspaceId,
      agentId: suggestion.agentId,
      severity: 'MEDIUM',
      title: `مشکل ابزار باز: ${suggestion.title}`,
      diagnosis: [
        suggestion.diagnosis,
        `این مورد در مرکز بهبود به‌عنوان مشکل TOOL ثبت شده و هنوز توسط صاحب کسب‌کار رسیدگی نشده است (${suggestion.evidenceConversations} گفتگوی شاهد).`,
      ].join('\n'),
      evidence: { suggestionId: suggestion.suggestionId, evidenceConversations: suggestion.evidenceConversations },
      suggestedAction: { type: 'tool_suggestion', suggestionId: suggestion.suggestionId, description: 'مشکل ابزار را در مرکز بهبود ایجنت رسیدگی کنید' },
    })
  }

  return { findings, clean, cleanNote: 'در پنجرهٔ اخیر خطای سرویس دیده نشد' }
}

// ─────────────────────────────────────────────────────────────────────────────
// Skills 3+4 — Post-change Monitor & Before/After Evaluation (FREE)
// ─────────────────────────────────────────────────────────────────────────────

export interface MetricWindow {
  reviews: number
  resolved: number
  userMessages: number
  unanswered: number
  assistantMessages: number
  modelErrors: number
}

export function metricRates(window: MetricWindow) {
  return {
    resolutionRate: window.reviews > 0 ? window.resolved / window.reviews : null,
    unansweredRate: window.userMessages > 0 ? window.unanswered / window.userMessages : null,
    modelErrorRate: window.assistantMessages > 0 ? window.modelErrors / window.assistantMessages : null,
  }
}

export interface PostChangeInput {
  changeId: string
  suggestionId: string
  agentId: string
  workspaceId: string
  agentName?: string
  kind: string
  topicKey: string
  title: string
  appliedAt: Date
  /** DONE reviews created after appliedAt (bounded), with the topics they evidenced. */
  reviewsAfter: Array<{ reviewId: string; conversationId: string; createdAt: Date; topics: Array<{ kind: string; topicKey: string }> }>
  before?: MetricWindow
  after?: MetricWindow
}

export function detectPostChanges(changes: PostChangeInput[]): DetectorResult {
  const findings: FindingDraft[] = []
  const clean: string[] = []
  for (const change of changes) {
    const agentLabel = change.agentName ?? 'ایجنت'
    const topic = normalizedTopicKey(change.topicKey)
    const recurring = change.reviewsAfter.filter((r) =>
      r.topics.some((t) => t.kind === change.kind && normalizedTopicKey(t.topicKey) === topic),
    )
    const reviewed = change.reviewsAfter.length

    if (recurring.length > 0) {
      findings.push({
        skillKey: 'post-change',
        dedupeKey: `fix:${change.changeId}`,
        workspaceId: change.workspaceId,
        agentId: change.agentId,
        severity: recurring.length >= 2 ? 'HIGH' : 'MEDIUM',
        title: `تکرار مشکل پس از اصلاح: ${change.title}`,
        diagnosis: [
          `اصلاح «${change.title}» در ${change.appliedAt.toISOString().slice(0, 10)} اعمال شده، اما همان موضوع در ${recurring.length} گفتگوی بررسی‌شدهٔ بعدی دوباره دیده شده است.`,
          `موضوع: ${change.topicKey} (نوع ${change.kind})`,
          'یعنی فیکس ریشه‌ای نبوده یا رگرسیون کرده؛ بازبینی مجدد لازم است.',
        ].join('\n'),
        evidence: {
          appliedAt: change.appliedAt.toISOString(),
          recurringConversations: recurring.map((r) => r.conversationId),
          reviewed,
        },
        suggestedAction: { type: 'revisit_fix', suggestionId: change.suggestionId, description: 'اصلاح را دوباره بررسی کنید' },
        seenAt: recurring[recurring.length - 1]?.createdAt,
      })
    } else if (reviewed >= 2) {
      clean.push(`fix:${change.changeId}`)
    }

    if (change.before && change.after) {
      const before = metricRates(change.before)
      const after = metricRates(change.after)
      const comparisons: Array<{ metric: string; labelFa: string; delta: number | null; worseWhenPositive: boolean; minReviews: number; severity: SkillSeverity }> = [
        { metric: 'resolution', labelFa: 'نرخ حل گفتگو', delta: after.resolutionRate !== null && before.resolutionRate !== null ? after.resolutionRate - before.resolutionRate : null, worseWhenPositive: false, minReviews: 3, severity: 'HIGH' },
        { metric: 'unanswered', labelFa: 'نرخ بی‌پاسخی پیام‌ها', delta: after.unansweredRate !== null && before.unansweredRate !== null ? after.unansweredRate - before.unansweredRate : null, worseWhenPositive: true, minReviews: 0, severity: 'MEDIUM' },
        { metric: 'modelerror', labelFa: 'نرخ خطای مدل', delta: after.modelErrorRate !== null && before.modelErrorRate !== null ? after.modelErrorRate - before.modelErrorRate : null, worseWhenPositive: true, minReviews: 0, severity: 'MEDIUM' },
      ]
      for (const comparison of comparisons) {
        if (comparison.delta === null || Math.abs(comparison.delta) < 0.15) continue
        if (comparison.metric === 'resolution' && (change.before.reviews < comparison.minReviews || change.after.reviews < comparison.minReviews)) continue
        if (comparison.metric === 'unanswered' && (change.before.userMessages < 30 || change.after.userMessages < 30)) continue
        if (comparison.metric === 'modelerror' && (change.before.assistantMessages < 20 || change.after.assistantMessages < 20)) continue
        const worsened = comparison.worseWhenPositive ? comparison.delta > 0 : comparison.delta < 0
        const dedupe = `ba:${change.changeId}:${comparison.metric}`
        if (worsened) {
          findings.push({
            skillKey: 'before-after',
            dedupeKey: dedupe,
            workspaceId: change.workspaceId,
            agentId: change.agentId,
            severity: comparison.severity,
            title: `افت ${comparison.labelFa} پس از تغییر: ${change.title}`,
            diagnosis: [
              `پس از اعمال «${change.title}»، ${comparison.labelFa} از ${(before.resolutionRate !== null && comparison.metric === 'resolution' ? before.resolutionRate : comparison.metric === 'unanswered' ? before.unansweredRate : before.modelErrorRate)!.toLocaleString('fa-IR', { style: 'percent' })} به ${(after.resolutionRate !== null && comparison.metric === 'resolution' ? after.resolutionRate : comparison.metric === 'unanswered' ? after.unansweredRate : after.modelErrorRate)!.toLocaleString('fa-IR', { style: 'percent' })} تغییر کرده است (پنجرهٔ ۷ روز قبل و بعد از تغییر).`,
              comparison.metric === 'resolution'
                ? `بر اساس ${change.before.reviews} و ${change.after.reviews} گفتگوی بررسی‌شده.`
                : comparison.metric === 'unanswered'
                  ? `بر اساس ${change.before.userMessages} و ${change.after.userMessages} پیام مشتری.`
                  : `بر اساس ${change.before.assistantMessages} و ${change.after.assistantMessages} پاسخ ایجنت.`,
              'این افت لزوماً علّی نیست، اما هم‌زمانی‌اش با تغییر ارزش بررسی دارد.',
            ].join('\n'),
            evidence: {
              appliedAt: change.appliedAt.toISOString(),
              metric: comparison.metric,
              before: comparison.metric === 'resolution' ? before.resolutionRate : comparison.metric === 'unanswered' ? before.unansweredRate : before.modelErrorRate,
              after: comparison.metric === 'resolution' ? after.resolutionRate : comparison.metric === 'unanswered' ? after.unansweredRate : after.modelErrorRate,
            },
            suggestedAction: { type: 'revisit_fix', suggestionId: change.suggestionId, description: 'اثر این تغییر را بازبینی کنید' },
            seenAt: change.appliedAt,
          })
        } else {
          // Confirmed improvement — recorded as an already-resolved confirmation.
          findings.push({
            skillKey: 'before-after',
            dedupeKey: dedupe,
            workspaceId: change.workspaceId,
            agentId: change.agentId,
            severity: 'LOW',
            initialStatus: 'RESOLVED',
            title: `بهبود تأیید شد — ${comparison.labelFa} (${agentLabel})`,
            diagnosis: `پس از اعمال «${change.title}»، ${comparison.labelFa} به میزان ${Math.abs(comparison.delta).toLocaleString('fa-IR', { style: 'percent' })} بهتر شده است. این عدد از مقایسهٔ ۷ روز قبل و بعد از تغییر به دست آمده.`,
            evidence: {
              appliedAt: change.appliedAt.toISOString(),
              metric: comparison.metric,
              before: comparison.metric === 'resolution' ? before.resolutionRate : comparison.metric === 'unanswered' ? before.unansweredRate : before.modelErrorRate,
              after: comparison.metric === 'resolution' ? after.resolutionRate : comparison.metric === 'unanswered' ? after.unansweredRate : after.modelErrorRate,
            },
            suggestedAction: { type: 'none', description: 'نیازی به اقدام نیست؛ تغییر اثر مثبت داشته' },
            seenAt: change.appliedAt,
          })
        }
      }
    }
  }
  return { findings, clean, cleanNote: 'پس از اصلاح، در گفتگوهای بررسی‌شده تکرار نشد' }
}

// ─────────────────────────────────────────────────────────────────────────────
// Skill 7 — Customer Preference Guard (FREE, heuristic)
// ─────────────────────────────────────────────────────────────────────────────

const COLOR_TERMS = [
  'خاکستری', 'مشکی', 'سفید', 'سرمه‌ای', 'قرمز', 'کرم', 'صورتی', 'آبی', 'سبز', 'زرد',
  'بنفش', 'طوسی', 'دودی', 'نارنجی', 'قهوه‌ای', 'شیری', 'لبویی', 'گلبهی', 'فیروزه‌ای', 'زرشکی', 'کلیمی',
]
const SIZE_TERM_RE = /سایز\s?([۰-۹0-9]{2})/gu

function parseFaDigits(value: string): string {
  return value.replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
}

/** Extract an exclusivity preference: «فقط خاکستری», «بدون صورتی», «فقط سایز ۴۵». */
function parseExclusions(text: string): { only?: string; without?: string; onlySize?: string } {
  const result: { only?: string; without?: string; onlySize?: string } = {}
  const onlyColor = COLOR_TERMS.find((color) => new RegExp(`فقط\\s+${color}`, 'u').test(text))
  const withoutColor = COLOR_TERMS.find((color) => new RegExp(`(?:بدون|به\\s?جز|جز)\\s+${color}`, 'u').test(text))
  if (onlyColor) result.only = onlyColor
  if (withoutColor) result.without = withoutColor
  const onlySize = /فقط\s+سایز\s?([۰-۹0-9]{2})/u.exec(text)
  if (onlySize) result.onlySize = parseFaDigits(onlySize[1])
  return result
}

function colorsIn(text: string): Set<string> {
  return new Set(COLOR_TERMS.filter((color) => text.includes(color)))
}

function sizesIn(text: string): Set<string> {
  return new Set([...text.matchAll(SIZE_TERM_RE)].map((m) => parseFaDigits(m[1])))
}

export interface PreferenceContactInput {
  contactId: string
  workspaceId: string
  agentId: string
  contactName?: string
  preferences: Array<{ id: string; text: string; createdAt: Date }>
  /** Assistant messages containing product cards, sent AFTER the preference existed. */
  productMessages: Array<{ messageId: string; conversationId: string; content: string; createdAt: Date }>
}

export function detectPreferenceViolations(contacts: PreferenceContactInput[]): DetectorResult {
  const findings: FindingDraft[] = []
  for (const contact of contacts) {
    for (const preference of contact.preferences) {
      const exclusions = parseExclusions(preference.text)
      if (!exclusions.only && !exclusions.without && !exclusions.onlySize) continue
      const violations: Array<{ messageId: string; conversationId: string; detail: string; at: Date }> = []
      for (const message of contact.productMessages) {
        if (message.createdAt < preference.createdAt) continue
        const colors = colorsIn(message.content)
        const sizes = sizesIn(message.content)
        if (exclusions.only && colors.size > 0 && !colors.has(exclusions.only)) {
          violations.push({ messageId: message.messageId, conversationId: message.conversationId, at: message.createdAt, detail: `ترجیح «فقط ${exclusions.only}» بود اما محصول پیشنهادی ${[...colors].slice(0, 3).join('، ')} معرفی شد.` })
        } else if (exclusions.without && colors.has(exclusions.without)) {
          violations.push({ messageId: message.messageId, conversationId: message.conversationId, at: message.createdAt, detail: `ترجیح «بدون ${exclusions.without}» بود اما در پیشنهاد ${exclusions.without} دیده می‌شود.` })
        }
        if (exclusions.onlySize && sizes.size > 0 && !sizes.has(exclusions.onlySize)) {
          violations.push({ messageId: message.messageId, conversationId: message.conversationId, at: message.createdAt, detail: `ترجیح «فقط سایز ${exclusions.onlySize}» بود اما سایز ${[...sizes].slice(0, 2).join('، ')} پیشنهاد شد.` })
        }
      }
      if (!violations.length) continue
      findings.push({
        skillKey: 'preference-guard',
        dedupeKey: `pref:${contact.contactId}:${preference.id}`,
        workspaceId: contact.workspaceId,
        agentId: contact.agentId,
        contactId: contact.contactId,
        severity: 'MEDIUM',
        title: `نقض احتمالی ترجیح مشتری: «${preference.text.slice(0, 60)}»`,
        diagnosis: [
          `ترجیح ثبت‌شدهٔ مشتری ${contact.contactName ? `(${contact.contactName}) ` : ''}«${preference.text}» است، اما ${violations.length} پیشنهاد بعدی ایجنت با آن هم‌خوان نیست:`,
          violations.slice(0, 3).map((v) => `• ${v.detail}`).join('\n'),
          'این تشخیص اکتشافی است؛ کارت محصول را باز کنید و در صورت تأیید، ترجیح را در CRM مشتری کامل‌تر ثبت کنید.',
        ].join('\n'),
        evidence: {
          preferenceId: preference.id,
          preferenceText: preference.text,
          violations: violations.slice(0, 5).map((v) => ({ messageId: v.messageId, conversationId: v.conversationId, at: v.at.toISOString(), detail: v.detail })),
        },
        suggestedAction: { type: 'review_contact', contactId: contact.contactId, description: 'گفتگو و پروفایل مشتری را بررسی کنید' },
        seenAt: violations[violations.length - 1]?.at,
      })
    }
  }
  return { findings, clean: [] }
}

// ─────────────────────────────────────────────────────────────────────────────
// Skills 5+6 — DEEP normalization (LLM output → validated findings)
// ─────────────────────────────────────────────────────────────────────────────

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function boundedString(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

export function parseModelJsonSafe(content: string): unknown {
  try {
    return JSON.parse(content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''))
  } catch {
    return null
  }
}

export interface ToneReviewContext {
  agentId: string
  workspaceId: string
  agentName?: string
  conversationId: string
  transcriptMessageIds: Set<string>
}

/** Model output for one sampled conversation → at most 5 evidence-backed findings. */
export function normalizeToneReview(raw: unknown, context: ToneReviewContext): FindingDraft[] {
  const input = asRecord(raw)
  const issues = Array.isArray(input.issues) ? input.issues : []
  const findings: FindingDraft[] = []
  for (const item of issues.slice(0, 5)) {
    const issue = asRecord(item)
    const title = boundedString(issue.title, 200)
    const diagnosis = boundedString(issue.diagnosis, 1600)
    const messageIds = Array.isArray(issue.messageIds)
      ? issue.messageIds.filter((id): id is string => typeof id === 'string' && context.transcriptMessageIds.has(id)).slice(0, 4)
      : []
    if (title.length < 3 || diagnosis.length < 3 || messageIds.length === 0) continue
    const severity: SkillSeverity = issue.severity === 'HIGH' ? 'HIGH' : issue.severity === 'LOW' ? 'LOW' : 'MEDIUM'
    const type = issue.type === 'flow' ? 'flow' : 'tone'
    findings.push({
      skillKey: 'tone-coach',
      dedupeKey: `tone:${context.agentId}:${type}:${slug(title)}`,
      workspaceId: context.workspaceId,
      agentId: context.agentId,
      conversationId: context.conversationId,
      severity,
      title: `${type === 'tone' ? 'لحن' : 'روند گفتگو'}: ${title}`,
      diagnosis: [
        diagnosis,
        boundedString(issue.suggestion, 800) ? `پیشنهاد مربی: ${boundedString(issue.suggestion, 800)}` : '',
      ].filter(Boolean).join('\n'),
      evidence: {
        messageIds,
        conversationId: context.conversationId,
        suggestion: boundedString(issue.suggestion, 800),
      },
      suggestedAction: issue.behaviorPath === 'conversation.empathy' || issue.behaviorPath === 'conversation.formality' || issue.behaviorPath === 'format.length'
        ? { type: 'behavior_hint', path: issue.behaviorPath, value: boundedString(issue.behaviorValue, 40) || undefined, description: 'این تنظیم را می‌توان از مرکز بهبود ایجنت اعمال کرد' }
        : { type: 'inspect_conversation', conversationId: context.conversationId, description: 'گفتگو را برای جزئیات باز کنید' },
    })
  }
  return findings
}

export function toneReviewPrompt(language: string): string {
  const fa = language !== 'en'
  return `You are a professional ${fa ? 'Persian' : 'English'} customer-service tone and conversation-flow coach. Review exactly ONE sampled conversation between a customer and an AI shop assistant. Return JSON only:
{"issues":[{"type":"tone|flow","title":"short actionable title","diagnosis":"what exactly felt cold, blunt, robotic, over-formal, repetitive, or broken in the flow; cite the customer's reaction when present","messageIds":["exact message id of the assistant message"],"suggestion":"concrete rewrite or instruction","severity":"HIGH|MEDIUM|LOW","behaviorPath":null,"behaviorValue":null}],"summary":"one line"}

Rules:
- Only report real issues a human coach would flag; do not invent problems for a pleasant conversation (then return an empty issues array).
- tone = how it is said (warmth, empathy, bluntness, robotic phrasing). flow = conversation structure (unnecessary repeated questions, asking several questions at once, ignoring the customer's last point, dead ends).
- Attach every issue to exact supplied ASSISTANT message IDs. Never invent IDs.
- "suggestion" must be a concrete improved reply sample (for tone) or a concrete flow rule (for flow), in ${fa ? 'Persian' : 'English'}.
- behaviorPath may be one of conversation.empathy, conversation.formality, format.length with an appropriate behaviorValue ONLY when the issue clearly maps to it; otherwise null.
- Write all prose in ${fa ? 'Persian' : 'English'}. No markdown fences.`
}

export interface ConflictPairInput {
  aId: string
  bId: string
  questionA: string
  answerA: string
  questionB: string
  answerB: string
}

export function conflictPrompt(pairs: ConflictPairInput[], language: string): string {
  const fa = language !== 'en'
  return `You are a knowledge-base consistency inspector. Decide which of the following ${fa ? 'APPROVED knowledge entries' : 'APPROVED knowledge entries'} contradict each other — i.e. they answer the same or equivalent question with materially different, incompatible answers. Return JSON only:
{"conflicts":[{"aId":"id of first entry","bId":"id of second entry","explanation":"why these two cannot both be true","correctHint":"what the owner must verify"}],"checked":N}

Pairs to judge:
${JSON.stringify(pairs.map((p) => ({ aId: p.aId, bId: p.bId, questionA: p.questionA.slice(0, 300), answerA: p.answerA.slice(0, 400), questionB: p.questionB.slice(0, 300), answerB: p.answerB.slice(0, 400) })), null, 1)}

Rules:
- Two entries conflict ONLY if giving a customer both answers would be contradictory (different prices, different delivery times, different policies for the same case). Different wording of the same fact is NOT a conflict.
- When unsure, do not report the pair.
- Write explanations in ${fa ? 'Persian' : 'English'}. No markdown fences.`
}

export function normalizeKnowledgeConflicts(
  raw: unknown,
  context: { agentId: string; workspaceId: string; sources: Map<string, { question: string; answer: string; name: string }> },
): FindingDraft[] {
  const input = asRecord(raw)
  const conflicts = Array.isArray(input.conflicts) ? input.conflicts : []
  const findings: FindingDraft[] = []
  for (const item of conflicts.slice(0, 8)) {
    const conflict = asRecord(item)
    const aId = typeof conflict.aId === 'string' ? conflict.aId : ''
    const bId = typeof conflict.bId === 'string' ? conflict.bId : ''
    const a = context.sources.get(aId)
    const b = context.sources.get(bId)
    if (!a || !b || aId === bId) continue
    const explanation = boundedString(conflict.explanation, 1200)
    if (!explanation) continue
    findings.push({
      skillKey: 'knowledge-conflict',
      dedupeKey: `kbx:${context.agentId}:${aId < bId ? `${aId}:${bId}` : `${bId}:${aId}`}`,
      workspaceId: context.workspaceId,
      agentId: context.agentId,
      severity: 'HIGH',
      title: 'تناقض در دانش‌نامه: دو پاسخ ناسازگار',
      diagnosis: [
        explanation,
        `مدخل ۱ — «${a.question.slice(0, 160)}»: ${a.answer.slice(0, 300)}`,
        `مدخل ۲ — «${b.question.slice(0, 160)}»: ${b.answer.slice(0, 300)}`,
        boundedString(conflict.correctHint, 500) ? `راهنما: ${boundedString(conflict.correctHint, 500)}` : '',
        'یکی از این دو پاسخ باید اصلاح یا حذف شود؛ در غیر این صورت ایجنت بسته به جستجو، جواب‌های متفاوت می‌دهد.',
      ].filter(Boolean).join('\n'),
      evidence: {
        aId, bId,
        questionA: a.question.slice(0, 400), answerA: a.answer.slice(0, 400),
        questionB: b.question.slice(0, 400), answerB: b.answer.slice(0, 400),
      },
      suggestedAction: { type: 'fix_knowledge', description: 'یکی از دو مدخل دانش‌نامه را در پنل کارفرما اصلاح کنید' },
    })
  }
  return findings
}

/** Pair up KB entries whose questions look equivalent (same normalized topic or ≥0.5 token overlap). */
export function candidateConflictPairs(
  sources: Array<{ id: string; question: string; answer: string }>,
  cap = 12,
): ConflictPairInput[] {
  const tokens = (q: string) => new Set(normalizedTopicKey(q).split(' ').filter((t) => t.length > 2))
  const pairs: ConflictPairInput[] = []
  for (let i = 0; i < sources.length && pairs.length < cap; i++) {
    for (let j = i + 1; j < sources.length && pairs.length < cap; j++) {
      const a = sources[i]
      const b = sources[j]
      const ta = tokens(a.question)
      const tb = tokens(b.question)
      if (!ta.size || !tb.size) continue
      let shared = 0
      for (const t of ta) if (tb.has(t)) shared++
      const overlap = shared / Math.min(ta.size, tb.size)
      if (overlap >= 0.5 || normalizedTopicKey(a.question) === normalizedTopicKey(b.question)) {
        pairs.push({ aId: a.id, bId: b.id, questionA: a.question, answerA: a.answer, questionB: b.question, answerB: b.answer })
      }
    }
  }
  return pairs
}
