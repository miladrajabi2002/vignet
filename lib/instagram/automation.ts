import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { InboundMessage, MessengerAdapter } from '@/lib/channels/types'
import type { ChatAgent } from '@/lib/ai/chat-engine'
import { generateReply } from '@/lib/ai/chat-engine'
import { startChannelTyping } from '@/lib/channels/typing'
import { captureError, captureWarning } from '@/lib/errors/capture'
import { isInstagram24hWindowError } from '@/lib/channels/delivery-errors'
import { checkWorkspaceActive } from '@/lib/billing/entitlements'
import { instagramPrivateReplyTarget, parsePrivateReplyTarget } from '@/lib/instagram/private-reply'
import {
        sendImage,
        sendAudio,
        sendVideo,
        sendProductCard,
        sendRichEntry,
        sendButtonMessage,
        sendInstagramText,
        pickTemplateImageUrl,
        type ProductShowcase,
        type ButtonAction,
} from '@/lib/instagram/media'
import {
        readAutomationPolicy,
        readUserToken,
        readPageToken,
        type InstagramReplyPolicy,
} from '@/lib/instagram/config'

/**
 * Instagram automation engine.
 *
 * Layered ON TOP of the default AI-reply flow. For every inbound Instagram
 * message the handler calls {@link runInstagramAutomation} BEFORE falling back
 * to the generic agent reply. If a scenario matches (or a pending follow-gate
 * is fulfilled), the engine sends the configured reply itself and returns
 * `handled: true` so the handler skips the default AI turn.
 *
 * Three scenario families, mirroring Vardast's panel:
 *
 *   DIRECT_MESSAGE — keyword auto-reply in DMs (with optional follow-gate)
 *   COMMENT        — keyword on a post/reel comment → public reply + optional DM
 *   STORY          — reply/mention of the account's story → static or AI reply
 *
 * Follow-gate flow (the "comment a word → follow us → tap 'I followed' → get
 * the link" funnel):
 *   1. user triggers a gated scenario (comment or DM keyword)
 *   2. we send `gatePrompt` ("follow @account and reply 'done'") with a tappable
 *      quick-reply button labelled `gateQuickReply`
 *   3. we create an InstagramFollowGate row (status PENDING, expires in 7 days)
 *   4. when the user replies `gateConfirmKeyword` (or taps the button), we look
 *      up their pending gate, mark it FULFILLED, and send `contentText`
 *
 * The Graph API does NOT expose a "is this user a follower" check, so the gate
 * is a SOFT trust gate by default. For a hard gate, set gateMode='STORY_MENTION'
 * — then the user must also mention the account in a story (which fires a
 * verifiable STORY_MENTION webhook) before the content is sent.
 */

export interface AutomationTrigger {
  keywords?: string[]
  matchMode?: 'EXACT' | 'CONTAINS' | 'STARTS_WITH'
  /** STORY only: 'ALL' (every story reply/mention) | 'KEYWORD' (match text)
   *  | 'SPECIFIC_STORY' (only replies to the picked stories). */
  storyScope?: 'ALL' | 'KEYWORD' | 'SPECIFIC_STORY'
  /** STORY + SPECIFIC_STORY: the picked stories' media ids. */
  storyIds?: string[]
  /** STORY + SPECIFIC_STORY: when the story disappears (timestamp + 24h).
   *  The scheduler sweep deactivates the scenario after this moment. */
  storyExpiresAt?: string
  /** COMMENT only: restrict to specific post/reel ids. */
  postIds?: string[]
}

export interface AutomationAction {
  replyMode?: 'STATIC' | 'AI' | 'SILENT' | 'STOP_AI' | 'MULTI_MESSAGE'
  /**
   * SILENT   — don't reply at all (skip; used for "no reply" comment scenarios).
   * STOP_AI  — pause AI for this conversation (sets conversation.metadata.aiPaused)
   *             and reply with `replyText` (or just ack silently when empty).
   * MULTI_MESSAGE — pick ONE entry from `messages[]` at random and send it.
   *             Mirrors Vardast's "یکی از پیام‌های زیر" (one of these messages).
   */
  replyText?: string
  /**
   * `messages[]` is used by STATIC (sent in order) and MULTI_MESSAGE (one
   * picked at random). Each entry is a typed payload that the media helpers
   * know how to send (TEXT/IMAGE/AUDIO/VIDEO/QUICK_REPLY/PRODUCT/PRODUCT_LIST).
   */
  messages?: Array<{
    type: 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'QUICK_REPLY' | 'PRODUCT' | 'PRODUCT_LIST'
    text?: string
    mediaUrl?: string
    productId?: string
    /** PRODUCT_LIST: ordered list of product ids (max 10). */
    productIds?: string[]
    /** QUICK_REPLY: up to 3 buttons. Accepts the new object form or legacy strings. */
    buttons?: Array<{ title: string; url?: string } | string>
    /** Button display style: 'button' (Button Template) or 'quick_reply' (chip). */
    buttonType?: 'button' | 'quick_reply'
  }>
  /**
   * For STATIC rich replies, the kind of media to send instead of plain text.
   *   TEXT    — send `replyText` (default; equivalent to v1 STATIC)
   *   IMAGE   — send `mediaUrl` (with optional `replyText` caption)
   *   AUDIO   — send `mediaUrl` as a voice note
   *   VIDEO   — send `mediaUrl` as a video
   *   PRODUCT — send a catalog card for `productId`
   */
  mediaType?: 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'PRODUCT'
  /** URL for IMAGE/AUDIO/VIDEO. */
  mediaUrl?: string
  /** Product id for PRODUCT (resolved via AgentCatalog at send time). */
  productId?: string
  /** COMMENT: also send a DM to the commenter. */
  dmOnComment?: boolean
  /**
   * COMMENT + dmOnComment: ALSO post a short public reply on the comment
   * itself (e.g. «تو دایرکت فرستادم 🌟») so the public comment isn't left
   * unanswered when the reply goes to DM. The DM body itself is never posted
   * publicly — only this operator-configured ack line.
   */
  commentAckEnabled?: boolean
  /** The public ack text posted on the comment when `commentAckEnabled`. */
  commentAckText?: string
  /** Up to 3 alternative ack texts; ONE is picked at random per comment
   *  (falls back to `commentAckText` when absent). */
  commentAckTexts?: string[]
  /** Require a follow before sending the content. */
  followGate?: boolean
  gateMode?: 'SOFT' | 'STORY_MENTION'
  gateButtonType?: 'button' | 'quick_reply'
  gatePrompt?: string
  gateConfirmKeyword?: string
  gateQuickReply?: string
  contentText?: string
  /** Route through the agent's AI engine (replyMode='AI'). */
  aiAgentEnabled?: boolean
  /** Story-only: send a delayed follow-up after `followUpDelayMin` minutes. */
  followUpEnabled?: boolean
  followUpDelayMin?: number
  followUpMessage?: string
}

/** Discriminated reader: the action's replyMode (default STATIC). */
type ReplyMode = NonNullable<AutomationAction['replyMode']>

const VALID_REPLY_MODES: ReplyMode[] = [
  'STATIC',
  'AI',
  'SILENT',
  'STOP_AI',
  'MULTI_MESSAGE',
]

function isReplyMode(v: unknown): v is ReplyMode {
  return typeof v === 'string' && (VALID_REPLY_MODES as string[]).includes(v)
}

/**
 * True when a media URL can never be fetched by Meta's crawler (or anything
 * outside the operator's browser tab): `blob:`/`data:` URLs are
 * session-local. Rows saved before the client-side upload-gate fix may still
 * carry them — skip delivery (with a warning) instead of sending a Graph API
 * attachment request that is guaranteed to fail.
 */
function isUnfetchableMediaUrl(url: string): boolean {
  return /^(blob|data):/i.test(url)
}

/**
 * DM target for a comment→DM funnel. A commenter who has never DMed the
 * account is unreachable via `recipient.id` (Meta error #100) — the one-time
 * Private Reply addressed by the comment id is the only delivery path, so the
 * majority of funnel entrants (new audiences) depend on it.
 */
function commentDmTarget(msg: InboundMessage): string {
  return msg.commentId
    ? instagramPrivateReplyTarget(msg.commentId, msg.senderId)
    : msg.senderId
}

/** One typed part of a scenario reply (`messages[]`). */
type RichEntry = NonNullable<AutomationAction['messages']>[number]

const RICH_ENTRY_TYPES = new Set<RichEntry['type']>([
  'TEXT', 'IMAGE', 'AUDIO', 'VIDEO', 'QUICK_REPLY', 'PRODUCT', 'PRODUCT_LIST',
])

/** Normalize a stored entry (gate payloads are untyped JSON). */
function toRichEntry(raw: Record<string, unknown>): RichEntry {
  const type = RICH_ENTRY_TYPES.has(raw.type as RichEntry['type'])
    ? (raw.type as RichEntry['type'])
    : 'TEXT'
  return {
    type,
    text: typeof raw.text === 'string' ? raw.text : undefined,
    mediaUrl: typeof raw.mediaUrl === 'string' ? raw.mediaUrl : undefined,
    productId: typeof raw.productId === 'string' ? raw.productId : undefined,
    productIds: Array.isArray(raw.productIds)
      ? raw.productIds.filter((id): id is string => typeof id === 'string')
      : undefined,
    buttons: Array.isArray(raw.buttons)
      ? (raw.buttons as Array<{ title: string; url?: string } | string>)
      : undefined,
    buttonType: raw.buttonType === 'quick_reply' ? 'quick_reply' : raw.buttonType === 'button' ? 'button' : undefined,
  }
}

function isPrivateReplyTarget(target: string): boolean {
  return parsePrivateReplyTarget(target) !== null
}

interface AutomationRow {
  id: string
  agentId: string
  channelId: string
  type: 'DIRECT_MESSAGE' | 'COMMENT' | 'STORY'
  name: string
  active: boolean
  priority: number
  trigger: Prisma.JsonValue
  action: Prisma.JsonValue
}

/** Normalize the JSON blobs on an automation row into typed shapes. */
function readTrigger(t: Prisma.JsonValue): AutomationTrigger {
  const o = (t && typeof t === 'object' ? t : {}) as Record<string, unknown>
  return {
    keywords: Array.isArray(o.keywords)
      ? o.keywords.filter((k): k is string => typeof k === 'string')
      : [],
    matchMode:
      o.matchMode === 'EXACT' || o.matchMode === 'STARTS_WITH'
        ? o.matchMode
        : 'CONTAINS',
    storyScope:
      o.storyScope === 'ALL'
        ? 'ALL'
        : o.storyScope === 'SPECIFIC_STORY'
          ? 'SPECIFIC_STORY'
          : 'KEYWORD',
    storyIds: Array.isArray(o.storyIds)
      ? o.storyIds.filter((k): k is string => typeof k === 'string')
      : [],
    storyExpiresAt: typeof o.storyExpiresAt === 'string' ? o.storyExpiresAt : undefined,
    postIds: Array.isArray(o.postIds)
      ? o.postIds.filter((k): k is string => typeof k === 'string')
      : [],
  }
}

function readAction(a: Prisma.JsonValue): AutomationAction {
  const o = (a && typeof a === 'object' ? a : {}) as Record<string, unknown>
  // LEGACY FIX (v3.1): comment "ارسال در دایرکت" scenarios created by older
  // builds stored replyMode 'SILENT' + dmOnComment true. The engine's SILENT
  // branch returned before any DM was sent, so those funnels silently no-op'd
  // (the "commented the keyword but never got the DM" bug). SILENT+
  // dmOnComment is really a STATIC comment→DM sequence — normalize here so
  // legacy rows and newly saved rows execute identically.
  const dmOnComment = o.dmOnComment === true
  const storedReplyMode = isReplyMode(o.replyMode) ? o.replyMode : 'STATIC'
  const replyMode =
    dmOnComment && storedReplyMode === 'SILENT' ? 'STATIC' : storedReplyMode
  const contentText = typeof o.contentText === 'string' ? o.contentText : ''
  const parsedMessages: AutomationAction['messages'] = Array.isArray(o.messages)
    ? (o.messages
        .filter((m): m is Record<string, unknown> => !!m && typeof m === 'object')
        .map((m) => {
            const type = (
              m.type === 'IMAGE' ||
              m.type === 'AUDIO' ||
              m.type === 'VIDEO' ||
              m.type === 'QUICK_REPLY' ||
              m.type === 'PRODUCT' ||
              m.type === 'PRODUCT_LIST'
                ? m.type
                : 'TEXT'
            ) as 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'QUICK_REPLY' | 'PRODUCT' | 'PRODUCT_LIST'
            const entry: {
              type: 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'QUICK_REPLY' | 'PRODUCT' | 'PRODUCT_LIST'
              text?: string
              mediaUrl?: string
              productId?: string
              productIds?: string[]
              buttons?: Array<{ title: string; url?: string } | string>
            } = {
              type,
              text: typeof m.text === 'string' ? m.text : undefined,
              mediaUrl: typeof m.mediaUrl === 'string' ? m.mediaUrl : undefined,
              productId: typeof m.productId === 'string' ? m.productId : undefined,
            }
            // PRODUCT_LIST: ordered list of product ids (max 10).
            if (type === 'PRODUCT_LIST' && Array.isArray(m.productIds)) {
              entry.productIds = m.productIds
                .filter((id): id is string => typeof id === 'string' && !!id)
                .slice(0, 10)
            }
            // Preserve buttons for QUICK_REPLY entries. Accept the new object
            // form ({title, url?}) or legacy plain strings.
            if (type === 'QUICK_REPLY' && Array.isArray(m.buttons)) {
              entry.buttons = m.buttons
                .filter((b) => typeof b === 'string' || (!!b && typeof b === 'object'))
                .slice(0, 3) as Array<{ title: string; url?: string } | string>
            } else if (type === 'QUICK_REPLY' && Array.isArray(m.quickReplies)) {
              // Legacy alias: quickReplies as string[] → buttons as string[].
              entry.buttons = m.quickReplies
                .filter((b): b is string => typeof b === 'string')
                .slice(0, 3)
            }
            return entry
          })
          .filter((m) =>
            m.type === 'TEXT'
              ? !!m.text
              : m.type === 'QUICK_REPLY'
                ? !!m.text || !!m.buttons?.length
                : m.type === 'PRODUCT'
                  ? !!m.productId
                  : m.type === 'PRODUCT_LIST'
                    ? !!m.productIds?.length
                    : !!m.mediaUrl,
          ))
      : []
  // Legacy comment→DM rows stored the DM body in `contentText` (the old
  // single-textarea UI) — seed it as the message sequence so old scenarios
  // keep delivering after this fix instead of matching and staying silent.
  const messages =
    dmOnComment && parsedMessages.length === 0 && contentText
      ? [{ type: 'TEXT' as const, text: contentText }]
      : parsedMessages
  return {
    replyMode,
    replyText: typeof o.replyText === 'string' ? o.replyText : '',
    messages,
    mediaType:
      o.mediaType === 'IMAGE' ||
      o.mediaType === 'AUDIO' ||
      o.mediaType === 'VIDEO' ||
      o.mediaType === 'PRODUCT'
        ? o.mediaType
        : 'TEXT',
    mediaUrl: typeof o.mediaUrl === 'string' ? o.mediaUrl : '',
    productId: typeof o.productId === 'string' ? o.productId : '',
    dmOnComment,
    followGate: o.followGate === true,
    gateMode: o.gateMode === 'STORY_MENTION' ? 'STORY_MENTION' : 'SOFT',
    gatePrompt: typeof o.gatePrompt === 'string' ? o.gatePrompt : '',
    gateConfirmKeyword:
      typeof o.gateConfirmKeyword === 'string' ? o.gateConfirmKeyword : '',
    gateQuickReply: typeof o.gateQuickReply === 'string' ? o.gateQuickReply : '',
    contentText,
    commentAckEnabled: o.commentAckEnabled === true,
    commentAckText: typeof o.commentAckText === 'string' ? o.commentAckText : '',
    commentAckTexts: Array.isArray(o.commentAckTexts)
      ? (o.commentAckTexts as unknown[])
          .filter((t): t is string => typeof t === 'string')
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 3)
      : [],
    aiAgentEnabled: o.aiAgentEnabled === true,
    followUpEnabled: o.followUpEnabled === true,
    followUpDelayMin:
      typeof o.followUpDelayMin === 'number' && o.followUpDelayMin > 0
        ? o.followUpDelayMin
        : 60,
    followUpMessage:
      typeof o.followUpMessage === 'string' ? o.followUpMessage : '',
  }
}

/** Does `text` match the trigger's keyword set under its match mode? */
function matchKeywords(
  text: string,
  trigger: AutomationTrigger,
): boolean {
  const kws = trigger.keywords ?? []
  if (!kws.length) return false
  const hay = text.trim().toLowerCase()
  if (!hay) return false
  for (const kw of kws) {
    const needle = kw.trim().toLowerCase()
    if (!needle) continue
    switch (trigger.matchMode) {
      case 'EXACT':
        if (hay === needle) return true
        break
      case 'STARTS_WITH':
        if (hay.startsWith(needle)) return true
        break
      case 'CONTAINS':
      default:
        if (hay.includes(needle)) return true
        break
    }
  }
  return false
}

/** Map an inbound message kind to the automation type that handles it. */
function kindToType(
  kind: InboundMessage['kind'],
): 'DIRECT_MESSAGE' | 'COMMENT' | 'STORY' | null {
  switch (kind) {
    case 'COMMENT':
      return 'COMMENT'
    case 'STORY_REPLY':
    case 'STORY_REACTION':
    case 'STORY_MENTION':
      return 'STORY'
    case 'DM':
    default:
      return 'DIRECT_MESSAGE'
  }
}

/** Return the first active scenario whose trigger matches this inbound. */
async function findMatchingScenario(args: {
  agentId: string
  channelId: string
  msg: InboundMessage
}): Promise<AutomationRow | null> {
  const type = kindToType(args.msg.kind)
  if (!type) return null

  const scenarios = await prisma.instagramAutomation.findMany({
    where: { agentId: args.agentId, channelId: args.channelId, active: true, type },
    orderBy: { priority: 'desc' },
  })

  for (const row of scenarios as AutomationRow[]) {
    const trigger = readTrigger(row.trigger)
    let matched = false

    if (type === 'STORY') {
      if (trigger.storyScope === 'SPECIFIC_STORY') {
        // Only replies/reactions to the operator-picked story fire this
        // scenario. Stories vanish after 24h — a stale row whose story is
        // already gone must never match again (defense in depth on top of
        // the scheduler sweep that flips active=false at storyExpiresAt).
        const storyIds = trigger.storyIds ?? []
        const expired =
          trigger.storyExpiresAt !== undefined &&
          Date.now() >= new Date(trigger.storyExpiresAt).getTime()
        matched =
          !expired &&
          storyIds.length > 0 &&
          Boolean(args.msg.storyId && storyIds.includes(args.msg.storyId))
      } else {
        matched = trigger.storyScope === 'ALL' || matchKeywords(args.msg.text, trigger)
      }
    } else if (type === 'COMMENT') {
      if (
        trigger.postIds?.length &&
        args.msg.postId &&
        !trigger.postIds.includes(args.msg.postId)
      ) {
        continue
      }
      matched = matchKeywords(args.msg.text, trigger)
    } else {
      // Empty DM keywords represent the dashboard's "any message" option.
      const keywords = trigger.keywords ?? []
      matched = keywords.length === 0 || matchKeywords(args.msg.text, trigger)
    }

    if (matched) return row
  }

  return null
}

/**
 * Read-only routing probe used before creating a Conversation. It mirrors the
 * automation engine's gate/scenario matching but performs no delivery or
 * mutation, allowing AUTOMATION_ONLY traffic with no matching route to be
 * acknowledged without polluting the conversations inbox.
 */
export async function willInstagramAutomationHandle(args: {
  agentId: string
  channelId: string
  msg: InboundMessage
}): Promise<boolean> {
  if (args.msg.kind === 'DM' || args.msg.kind === undefined) {
    const gate = await prisma.instagramFollowGate.findFirst({
      where: {
        agentId: args.agentId,
        igSenderId: args.msg.senderId,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      select: { payload: true },
    })
    if (gate) {
      const payload = (gate.payload && typeof gate.payload === 'object'
        ? gate.payload
        : {}) as Record<string, unknown>
      const confirmKeyword = typeof payload.gateConfirmKeyword === 'string'
        ? payload.gateConfirmKeyword.trim().toLowerCase()
        : ''
      const gateMode = typeof payload.gateMode === 'string' ? payload.gateMode : 'SOFT'
      if (
        gateMode !== 'STORY_MENTION' &&
        confirmKeyword &&
        isGateConfirmText(confirmKeyword, args.msg.text)
      ) {
        return true
      }
    }
  }

  if (args.msg.kind === 'STORY_MENTION') {
    const gate = await prisma.instagramFollowGate.findFirst({
      where: {
        agentId: args.agentId,
        igSenderId: args.msg.senderId,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      select: { payload: true },
    })
    if (gate) {
      const payload = (gate.payload && typeof gate.payload === 'object'
        ? gate.payload
        : {}) as Record<string, unknown>
      if (payload.gateMode === 'STORY_MENTION') return true
    }
  }

  return (await findMatchingScenario(args)) !== null
}

/**
 * Read-only probe: the commenter's DM thread id when the matched COMMENT
 * scenario delivers its whole reply in the commenter's Direct («ارسال در
 * دایرکت»), else null. The channel handler files such a comment under the DM
 * conversation, so the inbox shows the exchange where it really happened
 * instead of a comment thread whose reply the customer never saw publicly.
 * AI-mode and STOP_AI scenarios still act on the public comment, so they keep
 * the comment thread.
 */
export async function instagramCommentDmThread(args: {
  agentId: string
  channelId: string
  msg: InboundMessage
}): Promise<string | null> {
  const { msg } = args
  // Without `from.id` the parser falls back to the comment id as sender.
  if (msg.kind !== 'COMMENT' || !msg.senderId || msg.senderId === msg.commentId) return null
  const row = await findMatchingScenario(args)
  if (!row) return null
  const action = readAction(row.action)
  if (!action.dmOnComment || action.aiAgentEnabled) return null
  return action.replyMode === 'STATIC' || action.replyMode === 'MULTI_MESSAGE'
    ? msg.senderId
    : null
}

/**
 * Read-only probe for a matched SILENT scenario. A brand-new thread handled by
 * SILENT has no customer-visible reply and no operator-visible history, so the
 * channel handler can settle the inbound ledger event without creating an
 * empty-looking Conversation. Existing conversations still retain the message.
 *
 * Pending follow-gate fulfillment takes precedence over ordinary scenarios in
 * runInstagramAutomation, so a confirmation/mention must never be classified
 * as silent even when another SILENT scenario matches the same text.
 */
export async function willInstagramAutomationSilentlyIgnore(args: {
  agentId: string
  channelId: string
  msg: InboundMessage
}): Promise<boolean> {
  if (args.msg.kind === 'DM' || args.msg.kind === undefined) {
    const gate = await prisma.instagramFollowGate.findFirst({
      where: {
        agentId: args.agentId,
        igSenderId: args.msg.senderId,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      select: { payload: true },
    })
    if (gate) {
      const payload = (gate.payload && typeof gate.payload === 'object'
        ? gate.payload
        : {}) as Record<string, unknown>
      const confirmKeyword = typeof payload.gateConfirmKeyword === 'string'
        ? payload.gateConfirmKeyword.trim().toLowerCase()
        : ''
      const gateMode = typeof payload.gateMode === 'string' ? payload.gateMode : 'SOFT'
      if (
        gateMode !== 'STORY_MENTION' &&
        confirmKeyword &&
        isGateConfirmText(confirmKeyword, args.msg.text)
      ) {
        return false
      }
    }
  }

  if (args.msg.kind === 'STORY_MENTION') {
    const gate = await prisma.instagramFollowGate.findFirst({
      where: {
        agentId: args.agentId,
        igSenderId: args.msg.senderId,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      select: { payload: true },
    })
    if (gate) {
      const payload = (gate.payload && typeof gate.payload === 'object'
        ? gate.payload
        : {}) as Record<string, unknown>
      if (payload.gateMode === 'STORY_MENTION') return false
    }
  }

  const row = await findMatchingScenario(args)
  return row !== null && readAction(row.action).replyMode === 'SILENT'
}

const GATE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

/**
 * Normalize Persian/Arabic free text for follow-gate confirm matching.
 * The confirm tap comes back as a postback title (exact echo of the button),
 * but customers often TYPE the confirm phrase instead — with Arabic ي/ك vs
 * Persian ی/ک, ZWNJ, diacritics, punctuation, emoji and sloppy spacing.
 * Exact string equality silently dropped all of those variants: the customer
 * tapped/typed, we matched nothing, and the gate looked completely dead.
 */
function normalizeGateText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\u064A\u0649]/g, '\u06CC') // Arabic yeh/alef maksura → Persian yeh
    .replace(/\u0643/g, '\u06A9') // Arabic kaf → Persian kaf
    .replace(/[\u200c-\u200f\u202a-\u202e]/g, ' ') // ZWNJ/marks → space
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '') // harakat/tanwin
    .replace(/[^\p{L}\p{N}\s]/gu, ' ') // punctuation + emoji → space
    .replace(/\s+/g, ' ')
    .trim()
}

/** Casual Persian phrasings that all mean «I followed» — matched as contains. */
const GATE_CONFIRM_SYNONYMS = [
  'فالو کردم',
  'دنبال کردم',
  'فالو شدم',
  'فالو کردیم',
  'دنبال کردیم',
]

/**
 * Does this inbound text confirm a follow-gate? Fuzzy on purpose:
 * exact-normalized equality OR a contained keyword/synonym (length-guarded so
 * long unrelated DMs can never hijack the gate).
 */
function isGateConfirmText(confirmKeyword: string, text: string): boolean {
  // A button tap echoes the title verbatim. Compare the raw strings first so
  // an emoji-only keyword («✅») still matches — normalization strips it to ''.
  const rawKw = confirmKeyword.trim().toLowerCase()
  if (rawKw && rawKw === text.trim().toLowerCase()) return true
  const kw = normalizeGateText(confirmKeyword)
  const msg = normalizeGateText(text)
  if (!kw || !msg) return false
  if (msg === kw) return true
  if (msg.length > 60) return false
  // Whole-word containment: a short keyword like «ok» must not match «book».
  if (` ${msg} `.includes(` ${kw} `)) return true
  return GATE_CONFIRM_SYNONYMS.some((syn) => msg.includes(normalizeGateText(syn)))
}

export interface AutomationContext {
  agent: ChatAgent & { workspaceId: string }
  channelId: string
  /** Raw channel config — used by the media helpers to resolve the IG token. */
  channelConfig?: Prisma.JsonValue
  adapter: MessengerAdapter
  msg: InboundMessage
  contactId: string | null
  contactName: string | null
  quickReplies: string[]
  /** Durable inbound turn already persisted by the channel handler. */
  conversationId?: string
  inboundEventId?: string
  /** Write-ahead provider-delivery marker; called immediately before a send. */
  beforeDispatch?: () => Promise<void>
  /** v3.1: receipt collector — every outbound piece the engine actually sent
   *  (text bodies + `[[product:{…}]]` markers + media notes) so the operator
   *  sees the scenario reply in the CRM inbox, including the showcase rail. */
  receipt?: string[]
  /** v3.2: structured media the scenario actually delivered (IMAGE/AUDIO/VIDEO
   *  entries with a durable HTTPS URL). Persisted on the receipt message as
   *  metadata.vigentoOutbound.media so the CRM inbox renders the REAL media
   *  above the bubble instead of the bare «[تصویر]» text note. */
  receiptMedia?: Array<{ kind: 'photo' | 'video' | 'audio'; mediaUrl: string }>
  /** Filled while an action runs: the person was asked to follow first. */
  outcome?: { gated: boolean }
}

/**
 * One row per automation execution for one person (the automation report).
 * Never allowed to fail the reply: before the migration lands the table
 * does not exist and the row is simply skipped.
 */
async function logAutomationRun(
  ctx: AutomationContext,
  automationId: string,
  trigger: AutomationRow['type'],
  outcome: 'SENT' | 'GATED' | 'FOLLOW_CONFIRMED' | 'FAILED',
): Promise<void> {
  if (!ctx.msg.senderId) return
  try {
    await prisma.instagramAutomationRun.create({
      data: {
        automationId,
        agentId: ctx.agent.id,
        workspaceId: ctx.agent.workspaceId,
        igUserId: ctx.msg.senderId,
        igUsername: ctx.msg.senderUsername ?? null,
        trigger,
        outcome,
        conversationId: ctx.conversationId ?? null,
      },
    })
  } catch {
    // Reporting only; the reply already went out.
  }
}

/** The gate a fulfillment just closed, for the run log. */
async function justFulfilledGate(ctx: AutomationContext) {
  if (!ctx.msg.senderId) return null
  return Promise.resolve().then(() => prisma.instagramFollowGate.findFirst({
    where: {
      agentId: ctx.agent.id,
      igSenderId: ctx.msg.senderId,
      status: 'FULFILLED',
      fulfilledAt: { gte: new Date(Date.now() - 60_000) },
    },
    orderBy: { fulfilledAt: 'desc' },
    select: { automationId: true, payload: true, automation: { select: { type: true } } },
  })).catch(() => null)
}

/**
 * Atomically move a gate PENDING → FULFILLED. False when another event (a
 * second tap, the sweep) already claimed it — the caller must not deliver.
 */
async function claimPendingGate(gateId: string): Promise<boolean> {
  const claimed = await prisma.instagramFollowGate.updateMany({
    where: { id: gateId, status: 'PENDING' },
    data: { status: 'FULFILLED', fulfilledAt: new Date() },
  })
  return claimed.count === 1
}

/**
 * Merge bookkeeping keys into a gate's payload. Re-reads the row so a payload
 * refreshed in the meantime (the customer commented again) is not overwritten
 * with a stale snapshot. Best-effort — never fails the caller.
 */
async function patchGatePayload(
  gateId: string,
  patch: Record<string, unknown>,
  extra: { status?: 'PENDING'; fulfilledAt?: null } = {},
): Promise<void> {
  try {
    const fresh = await prisma.instagramFollowGate.findUnique({
      where: { id: gateId },
      select: { payload: true },
    })
    const current = (fresh?.payload && typeof fresh.payload === 'object' && !Array.isArray(fresh.payload)
      ? fresh.payload
      : {}) as Record<string, unknown>
    await prisma.instagramFollowGate.update({
      where: { id: gateId },
      data: { ...extra, payload: { ...current, ...patch } as Prisma.InputJsonValue },
    })
  } catch {
    // Bookkeeping only.
  }
}

/** Build the inbox-visible `[[product:{…}]]` marker from a showcase snapshot
 * (same shape `parseProductShowcaseContent` in the CRM thread parses). */
function productMarker(p: ProductShowcase): string {
  return `[[product:${JSON.stringify({
    id: p.id,
    name: p.name,
    price: p.price == null ? '' : p.price.toLocaleString('fa-IR') + ' تومان',
    desc: cleanReceiptDescription(p.description),
    badge: 'موجود',
    image: p.imageUrl ?? '',
    url: p.productUrl ?? '',
    specs: [],
  })}]]`
}

/** Strip WooCommerce HTML from a product description before it goes into a
 * receipt marker (mirrors `cleanProductDescription` in presentation.ts). */
function cleanReceiptDescription(value: string | null | undefined): string {
  if (!value) return ''
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240)
}

/** v3.1 receipt: media entries (IMAGE/AUDIO/VIDEO) can't be replayed in the
 * inbox as binary, so the receipt records a compact Persian note per part. */
function pushMediaNote(
  receipt: string[],
  entry: { type?: string },
): void {
  if (entry.type === 'IMAGE') receipt.push('[تصویر]')
  else if (entry.type === 'AUDIO') receipt.push('[وویس]')
  else if (entry.type === 'VIDEO') receipt.push('[ویدیو]')
}

/** v3.2: structured record for the receipt message metadata — the durable
 *  HTTPS URL the scenario actually delivered, so the inbox can render the
 *  real media instead of the «[تصویر]» placeholder. Returns null for text /
 *  product entries and for session-local (blob:/data:) URLs that were skipped
 *  at send time. */
function structuredMediaEntry(
  entry: { type?: string; mediaUrl?: string },
): { kind: 'photo' | 'video' | 'audio'; mediaUrl: string } | null {
  if (!entry.mediaUrl || !/^https:\/\//i.test(entry.mediaUrl)) return null
  if (entry.type === 'IMAGE') return { kind: 'photo', mediaUrl: entry.mediaUrl }
  if (entry.type === 'VIDEO') return { kind: 'video', mediaUrl: entry.mediaUrl }
  if (entry.type === 'AUDIO') return { kind: 'audio', mediaUrl: entry.mediaUrl }
  return null
}

/**
 * v3.1: persist what a scenario actually sent as the conversation's assistant
 * message (idempotent via resultForInboundEventId, same pattern the fixed-reply
 * and AI paths use). Text bodies + product markers — the CRM inbox renders the
 * markers as the showcase rail with images, so "what did the bot send?" is
 * answerable from the conversation itself instead of only from Instagram.
 */
async function persistScenarioReceipt(
  ctx: AutomationContext,
  receipt: string[],
  receiptMedia: Array<{ kind: 'photo' | 'video' | 'audio'; mediaUrl: string }> = [],
): Promise<void> {
  const text = receipt.filter(Boolean).join('\n\n').trim()
  if (!text || !ctx.conversationId || !ctx.inboundEventId) return
  // v3.2: cap the persisted media list so a pathological scenario can't
  // bloat the message row.
  const media = receiptMedia.slice(0, 10)
  try {
    await prisma.$transaction(async (tx) => {
      const inserted = await tx.message.createMany({
        data: [{
          conversationId: ctx.conversationId!,
          role: 'ASSISTANT',
          content: text,
          resultForInboundEventId: ctx.inboundEventId!,
          ...(media.length ? { metadata: { vigentoOutbound: { media } } as Prisma.InputJsonValue } : {}),
        }],
        skipDuplicates: true,
      })
      if (inserted.count === 1) {
        await tx.conversation.update({
          where: { id: ctx.conversationId! },
          data: { messageCount: { increment: 1 }, lastMessageAt: new Date() },
        })
      }
    })
  } catch (e) {
    // Receipt persistence must never fail the reply itself — the outbound send
    // already happened on the provider side.
    captureError('instagram:automation:receipt', e, {
      workspaceId: ctx.agent.workspaceId,
      metadata: { automationConversationId: ctx.conversationId },
    })
  }
}

/**
 * Run `deliver` with a receipt collector and persist what really went out as
 * the conversation's assistant message — gate content released by a confirm
 * tap is a scenario reply too, and used to be invisible in the CRM inbox.
 */
async function deliverWithReceipt(
  ctx: AutomationContext,
  deliver: (tracked: AutomationContext) => Promise<void>,
): Promise<void> {
  const receipt: string[] = []
  const receiptMedia: NonNullable<AutomationContext['receiptMedia']> = []
  const tracked: AutomationContext = {
    ...ctx,
    receipt,
    receiptMedia,
    adapter: {
      ...ctx.adapter,
      async sendText(chatId, text, opts) {
        await ctx.adapter.sendText(chatId, text, opts)
        receipt.push(text)
      },
    },
  }
  try {
    await deliver(tracked)
  } finally {
    // Persist even when a later part threw — the earlier parts did go out.
    if (receipt.length > 0) await persistScenarioReceipt(ctx, receipt, receiptMedia)
  }
}

/**
 * Try to handle an inbound Instagram message via an automation scenario.
 * Returns `handled: true` when the engine sent a reply itself (so the caller
 * must NOT run the default AI turn). Returns `handled: false` when no scenario
 * matched and the caller should fall back to the agent AI.
 */
export async function runInstagramAutomation(
  ctx: AutomationContext,
): Promise<{ handled: boolean; replied: boolean }> {
  const { agent, channelId, msg } = ctx

  // ─── 1. Follow-gate fulfillment (DM only) ───────────────────────────
  // When the user replies with the gate confirm keyword, look up their pending
  // gate and deliver the gated content. This runs BEFORE keyword matching so a
  // confirm keyword like "done" can't be hijacked by another scenario.
  if (msg.kind === 'DM' || msg.kind === undefined) {
    const gateResult = await tryFulfillFollowGate(ctx)
    if (gateResult) {
      if (gateResult === 'fulfilled') {
        const gate = await justFulfilledGate(ctx)
        if (gate) await logAutomationRun(ctx, gate.automationId, gate.automation.type, 'FOLLOW_CONFIRMED')
      }
      return { handled: true, replied: true }
    }
  }

  // ─── 2. STORY_MENTION hard-gate fulfillment ────────────────────────
  // A STORY_MENTION event for a sender with a pending STORY_MENTION gate
  // fulfills the gate (the user proved engagement by mentioning the account).
  if (msg.kind === 'STORY_MENTION') {
    const fulfilled = await tryFulfillGateByMention(ctx)
    if (fulfilled) {
      const gate = await justFulfilledGate(ctx)
      if (gate) await logAutomationRun(ctx, gate.automationId, gate.automation.type, 'FOLLOW_CONFIRMED')
      return { handled: true, replied: true }
    }
  }

  // ─── 3. Scenario matching ──────────────────────────────────────────
  const row = await findMatchingScenario({ agentId: agent.id, channelId, msg })
  if (!row) return { handled: false, replied: false }
  const action = readAction(row.action)

  // ─── Matched. Execute the action. ───
  const outcome = { gated: false }
  const receipt: string[] = []
  const receiptMedia: NonNullable<AutomationContext['receiptMedia']> = []
  try {
    let sent = false
    const beforeDispatch = async () => {
      await ctx.beforeDispatch?.()
      sent = true
    }
    const trackingAdapter: MessengerAdapter = {
      ...ctx.adapter,
      async sendText(chatId, text, opts) {
        await beforeDispatch()
        await ctx.adapter.sendText(chatId, text, opts)
        // Receipt: plain-text sends are recorded verbatim (one entry per send).
        receipt.push(text)
      },
    }
    await executeAction(
      { ...ctx, adapter: trackingAdapter, beforeDispatch, receipt, receiptMedia, outcome },
      row,
      action,
    )
    if (receipt.length > 0) await persistScenarioReceipt(ctx, receipt, receiptMedia)
    if (outcome.gated) await logAutomationRun(ctx, row.id, row.type, 'GATED')
    else if (sent) await logAutomationRun(ctx, row.id, row.type, 'SENT')
    return { handled: true, replied: sent }
  } catch (e) {
    await logAutomationRun(ctx, row.id, row.type, 'FAILED')
    captureError(`instagram:automation:${row.id}`, e, {
      workspaceId: agent.workspaceId,
      metadata: { agentId: agent.id, automationId: row.id },
    })
    // A closed 24-hour window is terminal and non-retryable, but by product
    // decision it is LOGGED ONLY — no operator handoff, no notification. The
    // conversation stays with the automation and the delivery succeeds again
    // on the customer's next DM.
    // The parts sent BEFORE the failure did reach the customer (typically the
    // private reply that opens a comment→DM sequence) — receipt them, or the
    // inbox shows nothing for a message the customer is looking at.
    if (receipt.length > 0) await persistScenarioReceipt(ctx, receipt, receiptMedia)
  }
  return { handled: true, replied: false }
}

/**
 * Post the public "sent you a DM" ack on the commenter's comment.
 *
 * COMMENT scenarios with `dmOnComment` deliver their content in the
 * commenter's DM — which leaves the public comment itself unanswered (the
 * operator's #1 complaint: "این کامنت بدون جواب می‌مونه"). When the operator
 * enables `commentAckEnabled`, we additionally post one of `commentAckTexts` as a
 * public reply ON the comment: for comments `msg.chatId` is
 * `comment:<commentId>`, which the adapter routes to `/{comment-id}/replies`.
 *
 * Best-effort by design: a failed ack must never break (or retry) the DM
 * delivery that already happened, so errors are captured and swallowed.
 */
async function postCommentAck(
  ctx: AutomationContext,
  action: AutomationAction,
): Promise<void> {
  if (ctx.msg.kind !== 'COMMENT' || !action.dmOnComment) return
  if (!action.commentAckEnabled) return
  // Up to 3 operator-written variants; ONE is picked at random per comment so
  // the public replies look human (e.g. «تو دایرکت فرستادم 🌟» / «فرستادم برات»).
  const variants = action.commentAckTexts?.length
    ? action.commentAckTexts
    : action.commentAckText
      ? [action.commentAckText]
      : []
  const ackText = variants.length
    ? variants[Math.floor(Math.random() * variants.length)].trim()
    : ''
  if (!ackText) return
  try {
    await ctx.adapter.sendText(ctx.msg.chatId, ackText)
  } catch (e) {
    captureError('instagram:automation:comment-ack', e, {
      workspaceId: ctx.agent.workspaceId,
      metadata: { commentId: ctx.msg.commentId },
    })
  }
}

/** Send the configured reply for a matched scenario. */
/**
 * Send `entries` in order to `target`, receipting product cards for the inbox.
 * QUICK_REPLY entries honour their `buttonType`; every other type goes through
 * `sendRichEntry` (text, media, product card, product carousel).
 */
async function deliverEntries(
  ctx: AutomationContext,
  target: string,
  entries: RichEntry[],
): Promise<void> {
  const { adapter, agent, msg, quickReplies, channelConfig } = ctx
  const isComment = msg.kind === 'COMMENT'
  const capturedProducts: ProductShowcase[] = []
  const captureResolveProduct = async (productId: string) => {
    const p = await resolveProduct(agent.id, productId)
    if (p) capturedProducts.push(p)
    return p
  }
  const captureResolveProducts = async (productIds: string[]) => {
    const list = await resolveProducts(agent.id, productIds)
    capturedProducts.push(...list)
    return list
  }
  for (const entry of entries) {
    if (entry.mediaUrl && isUnfetchableMediaUrl(entry.mediaUrl)) {
      captureWarning('instagram:automation:media-url-unfetchable', new Error(
        `skipping ${entry.type} with session-local mediaUrl`,
      ), { workspaceId: agent.workspaceId, metadata: { entryType: entry.type, mediaUrl: entry.mediaUrl } })
      continue
    }
    // QUICK_REPLY entries carry `buttons`. The `buttonType` field controls
    // how they're rendered:
    //   'button' (default) → Button Template (inside the bubble)
    //   'quick_reply'      → Quick Reply chips (above the input)
    if (entry.type === 'QUICK_REPLY' && entry.buttons?.length && channelConfig) {
      const buttonActions: ButtonAction[] = entry.buttons.slice(0, 3).map((b) =>
        typeof b === 'string'
          ? { title: b }
          : { title: b.title, url: b.url },
      )
      await ctx.beforeDispatch?.()
      try {
        if (entry.buttonType === 'quick_reply') {
          // Quick Reply chips — sent as quick_replies with the text message.
          await adapter.sendText(target, entry.text || '', {
            quickReplies: buttonActions.map((b) => b.title),
          })
        } else {
          // Button Template — inside the bubble (default).
          await sendButtonMessage(channelConfig, target, entry.text || '', buttonActions)
          if (ctx.receipt && entry.text) ctx.receipt.push(entry.text)
        }
      } catch (e) {
        // A closed 24-hour window is terminal — the plain-text fallback would fail
        // the same way. Re-throw so the run stops here and is logged as FAILED.
        if (isInstagram24hWindowError(e)) throw e
        captureError('instagram:automation:quick-reply', e, {
          workspaceId: agent.workspaceId,
          metadata: { chatId: target },
        })
        // Fallback: send the text body so the user isn't left hanging.
        if (entry.text) {
          await adapter.sendText(target, entry.text).catch(() => undefined)
        }
      }
      continue
    }
    await ctx.beforeDispatch?.()
    const resolvedBefore = capturedProducts.length
    const result = await sendRichEntry(
      channelConfig ?? null,
      target,
      entry,
      async (cid, text) =>
        adapter.sendText(cid, text, {
          quickReplies: isComment ? undefined : quickReplies,
        }),
      captureResolveProduct,
      captureResolveProducts,
      agent.workspaceId,
    )
    // sendRichEntry captures a rejected part instead of throwing. Receipt only
    // what Meta accepted — the inbox must not show a card that never arrived.
    if (result === 'failed' || result === 'skipped') {
      capturedProducts.length = resolvedBefore
      continue
    }
    if (ctx.receipt) pushMediaNote(ctx.receipt, entry)
    const structured = structuredMediaEntry(entry)
    if (structured) (ctx.receiptMedia ??= []).push(structured)
  }
  if (ctx.receipt) {
    for (const p of capturedProducts) ctx.receipt.push(productMarker(p))
  }
}

/**
 * Deliver a comment→DM reply.
 *
 * The former «ادامه» continue-button gate is gone: every part of the reply
 * is delivered immediately, in order. The first part claims the ONE private
 * reply each comment allows; the remaining parts go straight to the
 * commenter's IGSID as best-effort DMs — each part is sent independently so
 * one failed send never blocks the rest (errors are captured in the ErrorLog).
 * Other targets get every part right away.
 */
async function deliverToCommenter(
  ctx: AutomationContext,
  target: string,
  entries: RichEntry[],
): Promise<void> {
  if (!isPrivateReplyTarget(target) || !ctx.msg.senderId || entries.length <= 1) {
    await deliverEntries(ctx, target, entries)
    return
  }
  const [first, ...rest] = entries
  await deliverEntries(ctx, target, [first])
  for (const entry of rest) {
    try {
      await deliverEntries(ctx, ctx.msg.senderId, [entry])
    } catch (e) {
      // A closed 24-hour window is different: every remaining part fails the same
      // way, so stop instead of burning one rejected call per part.
      if (isInstagram24hWindowError(e)) throw e
      // Best-effort: Meta rejects DMs to commenters with no open thread.
      // Capture and move on so later parts (and the receipt) still go out.
      captureWarning('instagram:automation:multipart-rest', e as Error, {
        workspaceId: ctx.agent.workspaceId,
        metadata: { chatId: ctx.msg.senderId, entryType: entry.type },
      })
    }
  }
}

async function executeAction(
  ctx: AutomationContext,
  row: AutomationRow,
  action: AutomationAction,
): Promise<void> {
  const {
    adapter,
    msg,
    agent,
    contactId,
    contactName,
    quickReplies,
    channelConfig,
  } = ctx
  const isComment = msg.kind === 'COMMENT'

  // ─── SILENT: skip the reply entirely ("no reply" comment scenario) ───
  // We still mark the inbound as handled so the AI fallback doesn't fire.
  if (action.replyMode === 'SILENT') return

  // ─── STOP_AI: pause the agent AI for this conversation, then ack ───
  // Sets conversation.metadata.aiPaused = true. The handler's
  // shouldAgentReply() reads this flag and refuses to invoke the AI engine
  // until the operator resumes it (clears the flag) from the inbox.
  if (action.replyMode === 'STOP_AI') {
    await pauseAiForConversation(agent.id, msg.chatId)
    if (action.replyText) {
      await adapter.sendText(msg.chatId, action.replyText, {
        quickReplies: isComment ? undefined : quickReplies,
      })
    }
    return
  }

  // ─── Follow-gate: check follow status FIRST, then decide ──────────
  // If the user already follows → skip the gate entirely and send content.
  // If the user does NOT follow → send the gate prompt + create a pending gate.
  // If the check fails (API error) → send the gate prompt as a safety net.
  if (action.followGate) {
    const gatePrompt =
      action.gatePrompt ||
      `لطفاً ابتدا صفحه ما را دنبال کنید\n\nبعد از دنبال کردن، بر روی دکمه زیر کلیک کنید`
    const gateQuickReply = action.gateQuickReply || 'دنبال کردم'
    const gateConfirmKeyword =
      action.gateConfirmKeyword || gateQuickReply || 'دنبال کردم'
    const contentMessages: Array<{
      type?: string; text?: string; mediaUrl?: string; productId?: string;
      buttons?: Array<{ title: string; url?: string } | string>;
      buttonType?: string;
    }> = action.messages?.length
      ? action.messages
      : action.contentText || action.replyText
        ? [{ type: 'TEXT', text: action.contentText || action.replyText || '' }]
        : []
    const gateButtonType = action.gateButtonType ?? 'button'
    const target = isComment && action.dmOnComment ? commentDmTarget(msg) : msg.chatId

    // ── STEP 1: Check if the user already follows the account ──
    if (channelConfig) {
      const alreadyFollows = await checkUserFollows(channelConfig, msg.senderId)
      if (alreadyFollows === true) {
        // User already follows → skip the gate, deliver content directly.
        console.log(`[ig-gate] user ${msg.senderId} ALREADY follows — skipping gate, delivering content`)
        if (contentMessages.length > 0) {
          await deliverToCommenter(
            ctx,
            target,
            contentMessages.map((entry) => toRichEntry(entry as Record<string, unknown>)),
          )
        }
        // The content went to the commenter's DM — acknowledge the public
        // comment too so it isn't left unanswered.
        await postCommentAck(ctx, action)
        return // Gate skipped — content delivered, done.
      }
      // follows === false → send gate prompt (below)
      // follows === null → API failed, send gate prompt as safety net
    }

    // ── STEP 2: User does NOT follow (or check failed) → send gate prompt ──
    // For comments with dmOnComment, target is the sender's DM — so Button
    // Template works. For public comment replies (no dmOnComment), only text.
    const isDM = !isComment || action.dmOnComment
    await ctx.beforeDispatch?.()
    if (!isDM) {
      // Public comment reply — no buttons (Button Template is DM-only).
      await adapter.sendText(target, gatePrompt)
    } else if (gateButtonType === 'quick_reply') {
      await adapter.sendText(target, gatePrompt, {
        quickReplies: [gateQuickReply],
      })
    } else if (channelConfig) {
      try {
        await sendButtonMessage(channelConfig, target, gatePrompt, [
          { title: gateQuickReply },
        ])
      } catch {
        await adapter.sendText(target, gatePrompt, {
          quickReplies: [gateQuickReply],
        })
      }
    } else {
      await adapter.sendText(target, gatePrompt, {
        quickReplies: [gateQuickReply],
      })
    }

    if (ctx.outcome) ctx.outcome.gated = true
    // Dedupe: the customer commenting again while a gate is already pending
    // used to stack a NEW gate row per comment (one user hit 7 rows). Refresh
    // the existing PENDING gate for this automation+sender instead — the
    // parked content and TTL stay current, the table stays clean.
    const gatePayload = {
      kind: msg.kind,
      commentId: msg.commentId,
      postId: msg.postId,
      storyId: msg.storyId,
      gateMode: action.gateMode,
      gateButtonType,
      gateConfirmKeyword,
      gatePrompt,
      gateQuickReply,
      contentMessages,
    } as Prisma.InputJsonValue
    const existingGate = await prisma.instagramFollowGate.findFirst({
      where: {
        automationId: row.id,
        igSenderId: msg.senderId,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    })
    if (existingGate) {
      await prisma.instagramFollowGate.update({
        where: { id: existingGate.id },
        data: { payload: gatePayload, expiresAt: new Date(Date.now() + GATE_TTL_MS) },
      })
    } else {
      await prisma.instagramFollowGate.create({
        data: {
          automationId: row.id,
          agentId: agent.id,
          contactId: contactId ?? null,
          igSenderId: msg.senderId,
          chatId: msg.senderId,
          status: 'PENDING',
          expiresAt: new Date(Date.now() + GATE_TTL_MS),
          payload: gatePayload,
        },
      })
    }
    // The gate prompt went to the commenter's DM — acknowledge the public
    // comment as well so it isn't left unanswered.
    await postCommentAck(ctx, action)
    return
  }

  // ─── MULTI_MESSAGE: pick one of `messages[]` at random and send it ───
  if (action.replyMode === 'MULTI_MESSAGE' && action.messages?.length) {
    const entry = action.messages[
      Math.floor(Math.random() * action.messages.length)
    ]
    const target = isComment && action.dmOnComment ? commentDmTarget(msg) : msg.chatId
    await deliverToCommenter(ctx, target, [entry])
    // NOTE (v3.1): the comment→DM funnel no longer posts the DM body back as
    // a public comment reply — "ارسال در دایرکت" means INSTEAD of the public
    // reply, and posting it would leak DM content (links, prices) publicly.
    // v3.2: an optional short ack (commentAck*) is posted on the comment.
    await postCommentAck(ctx, action)
    return
  }

  // ─── STATIC rich reply: send the ordered messages[] sequence ───
  // When the operator builds a sequence of messages (text, image, voice,
  // video, quick-reply buttons, product card) in the form, we send them all
  // in order here. This is the fix for "multi-message doesn't work for
  // DM/STORY STATIC" — previously only `replyText` was sent and `messages[]`
  // was silently ignored.
  if (action.replyMode === 'STATIC' && action.messages?.length && channelConfig) {
    const target = isComment && action.dmOnComment ? commentDmTarget(msg) : msg.chatId
    await deliverToCommenter(ctx, target, action.messages)
    // NOTE (v3.1): no public ack on comment→DM funnels — see the note in the
    // MULTI_MESSAGE branch above.
    // v3.2: optional commentAck — post the short public ack on the comment.
    await postCommentAck(ctx, action)

    // ─── Follow-up message (delayed) ───
    // Per-scenario follow-up: send `followUpMessage` after `followUpDelayMin`
    // minutes. Implemented as an in-process setTimeout — if the server
    // restarts within the delay window the follow-up is lost (acceptable for
    // the MVP; a durable BullMQ job would be the production-grade version).
    scheduleFollowUp(ctx, action, target)
    return
  }

  // ─── STATIC rich reply (single IMAGE / AUDIO / VIDEO / PRODUCT) ───
  // Legacy path: a single media reply configured via action.mediaType /
  // action.mediaUrl (kept for rows created before the messages[] builder).
  if (
    action.replyMode === 'STATIC' &&
    action.mediaType &&
    action.mediaType !== 'TEXT' &&
    !action.messages?.length &&
    channelConfig
  ) {
    const target = isComment && action.dmOnComment ? commentDmTarget(msg) : msg.chatId
    if (isPrivateReplyTarget(target)) {
      // A private reply is one message: lead with the text, park the media.
      const media: RichEntry = action.mediaType === 'PRODUCT'
        ? { type: 'PRODUCT', productId: action.productId }
        : { type: action.mediaType as RichEntry['type'], mediaUrl: action.mediaUrl }
      const entries: RichEntry[] = action.replyText
        ? [{ type: 'TEXT', text: action.replyText }, media]
        : [media]
      await deliverToCommenter(ctx, target, entries)
      await postCommentAck(ctx, action)
      return
    }
    if (action.mediaUrl && isUnfetchableMediaUrl(action.mediaUrl)) {
      captureWarning('instagram:automation:media-url-unfetchable', new Error(
        `skipping legacy ${action.mediaType} reply with session-local mediaUrl`,
      ), { workspaceId: agent.workspaceId, metadata: { mediaType: action.mediaType, mediaUrl: action.mediaUrl } })
    }
    const legacyMediaDeliverable =
      action.mediaUrl && !isUnfetchableMediaUrl(action.mediaUrl) ? action.mediaUrl : ''
    await ctx.beforeDispatch?.()
    if (action.mediaType === 'IMAGE' && legacyMediaDeliverable) {
      await sendImage(channelConfig, target, legacyMediaDeliverable, action.replyText || undefined)
      if (ctx.receipt) pushMediaNote(ctx.receipt, { type: 'IMAGE' })
      const structured = structuredMediaEntry({ type: 'IMAGE', mediaUrl: legacyMediaDeliverable })
      if (structured && ctx.receiptMedia) ctx.receiptMedia.push(structured)
    } else if (action.mediaType === 'AUDIO' && legacyMediaDeliverable) {
      await sendAudio(channelConfig, target, legacyMediaDeliverable)
      if (ctx.receipt) pushMediaNote(ctx.receipt, { type: 'AUDIO' })
      const structured = structuredMediaEntry({ type: 'AUDIO', mediaUrl: legacyMediaDeliverable })
      if (structured && ctx.receiptMedia) ctx.receiptMedia.push(structured)
    } else if (action.mediaType === 'VIDEO' && legacyMediaDeliverable) {
      await sendVideo(channelConfig, target, legacyMediaDeliverable)
      if (ctx.receipt) pushMediaNote(ctx.receipt, { type: 'VIDEO' })
      const structured = structuredMediaEntry({ type: 'VIDEO', mediaUrl: legacyMediaDeliverable })
      if (structured && ctx.receiptMedia) ctx.receiptMedia.push(structured)
    } else if (action.mediaType === 'PRODUCT' && action.productId) {
      const product = await resolveProduct(agent.id, action.productId)
      if (product) {
        await sendProductCard(channelConfig, target, product)
        if (ctx.receipt) ctx.receipt.push(productMarker(product))
      }
    }
    // NOTE (v3.1): no public ack on comment→DM funnels — see the note in the
    // MULTI_MESSAGE branch above.
    // v3.2: optional commentAck — post the short public ack on the comment.
    await postCommentAck(ctx, action)
    // Per-scenario follow-up applies to single-media STATIC replies too —
    // previously this branch skipped it, so media scenarios couldn't nudge.
    scheduleFollowUp(ctx, action, target)
    return
  }

  // ─── STATIC reply (text) ───
  if (action.replyMode === 'STATIC' && action.replyText) {
    if (isComment && action.dmOnComment) {
      // v1 fallback (messages[] empty): deliver the DM body only — no public
      // comment ack, per the v3.1 "ارسال در دایرکت" semantics (see the note
      // in the MULTI_MESSAGE branch).
      await adapter.sendText(commentDmTarget(msg), action.contentText || action.replyText, {
        quickReplies,
      })
      // v3.2: optional commentAck — acknowledge the public comment too.
      await postCommentAck(ctx, action)
      scheduleFollowUp(ctx, action, msg.senderId)
      return
    }
    await adapter.sendText(msg.chatId, action.replyText, {
      quickReplies: isComment ? undefined : quickReplies,
    })
    scheduleFollowUp(ctx, action, msg.chatId)
    return
  }

  // ─── AI reply (route through the agent's AI engine) ───
  if (action.replyMode === 'AI' || action.aiAgentEnabled) {
    let stopTyping: (() => void) | undefined
    // Start typing BEFORE the engine call so the indicator also covers the
    // retrieval/turn-preparation phase, not just the model round-trip.
    // onGenerationStart below is a no-op via the ??= guard.
    if (adapter.sendTyping) {
      stopTyping = startChannelTyping(adapter, msg.chatId, (error) =>
        console.error('[instagram] automation typing failed:', error),
      )
    }
    let result: Awaited<ReturnType<typeof generateReply>>
    try {
      result = await generateReply(
        {
          workspaceId: agent.workspaceId,
          agent,
          message: msg.text,
          channel: 'INSTAGRAM',
          contactId: contactId ?? undefined,
          contactName: contactName ?? undefined,
          conversationId: ctx.conversationId,
          externalId: msg.chatId,
          inboundEventId: ctx.inboundEventId,
          inboundAlreadyPersisted: !!ctx.inboundEventId,
        },
        {
          onGenerationStart: adapter.sendTyping
            ? () => {
                stopTyping ??= startChannelTyping(adapter, msg.chatId, (error) =>
                  console.error('[instagram] automation typing failed:', error),
                )
              }
            : undefined,
        },
      )
    } finally {
      stopTyping?.()
    }
    if ('error' in result) return
    await adapter.sendText(msg.chatId, result.reply, {
      quickReplies: isComment ? undefined : quickReplies,
    })
    return
  }

  // ─── Fallback: static contentText (used after gateless comment→DM) ───
  if (action.contentText) {
    await adapter.sendText(
      isComment ? commentDmTarget(msg) : msg.chatId,
      action.contentText,
      { quickReplies: isComment ? undefined : quickReplies },
    )
    if (isComment) {
      // v3.2: optional commentAck — acknowledge the public comment too.
      await postCommentAck(ctx, action)
    }
  }
}

/**
 * Schedule a per-scenario follow-up message.
 *
 * Sends `action.followUpMessage` to `target` after `action.followUpDelayMin`
 * minutes. In-process setTimeout — NOT durable across server restarts. A
 * production-grade version would enqueue a BullMQ job (the project already
 * uses BullMQ for knowledge indexing), but the MVP keeps it simple: most
 * follow-ups fire within minutes-to-an-hour, well within a single server
 * uptime window.
 *
 * Silently no-ops when the follow-up isn't enabled or has no message body.
 */
function scheduleFollowUp(
  ctx: AutomationContext,
  action: AutomationAction,
  target: string,
): void {
  if (!action.followUpEnabled || !action.followUpMessage?.trim()) return
  const { adapter, agent } = ctx
  const delayMs = Math.max(
    1,
    action.followUpDelayMin ?? 60,
  ) * 60 * 1000
  setTimeout(async () => {
    try {
      const access = await checkWorkspaceActive(agent.workspaceId)
      if (!access.allowed) return
      await adapter.sendText(target, action.followUpMessage!, {
        quickReplies: undefined,
      })
      await prisma.conversation.updateMany({
        where: { agentId: agent.id, externalId: target },
        data: { lastMessageAt: new Date() },
      })
    } catch (e) {
      console.error('[instagram] follow-up send failed:', e)
    }
  }, delayMs)
}

/**
 * Check if a user actually follows the connected Instagram account.
 *
 * Uses the correct Meta Graph API endpoint:
 *   GET https://graph.facebook.com/v22.0/{sender_igsid}
 *       ?fields=is_user_follow_business,is_business_follow_user
 *       &access_token={token}
 *
 * - `is_user_follow_business` → boolean: does the user follow our business?
 * - `is_business_follow_user` → boolean: does our business follow the user?
 *
 * The request goes to graph.instagram.com (Instagram-Login user tokens) and
 * queries the SENDER's node directly, NOT the business account's /accounts edge.
 * Legacy FB-Login page tokens would need graph.facebook.com instead —
 * resolveToken() picks the host that matches the stored token type.
 *
 * Returns true if following, false if not, null if the check failed
 * (treat as following — best-effort, don't block the user).
 */
async function checkUserFollows(
  channelConfig: Prisma.JsonValue,
  senderId: string,
): Promise<boolean | null> {
  const token = readUserToken(channelConfig) ?? readPageToken(channelConfig)
  if (!token || !senderId) return null
  try {
    const url = `https://graph.instagram.com/v22.0/${senderId}?fields=is_user_follow_business,is_business_follow_user&access_token=${token}`
    console.log(`[ig-gate] checking follow status for sender=${senderId}`)
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    const text = await res.text().catch(() => '')
    if (!res.ok) {
      console.warn(`[ig-gate] follow check failed (${res.status}): ${text.slice(0, 300)}`)
      // If the API call fails (permissions, rate limit), treat as "following"
      // so we don't block the user — the gate is best-effort.
      return null
    }
    const json = JSON.parse(text) as {
      is_user_follow_business?: boolean
      is_business_follow_user?: boolean
    }
    // Meta omits the field when it cannot tell (permissions, private state).
    // That is a failed check, not «does not follow» — reading it as false
    // locked the gate forever for those users.
    if (typeof json.is_user_follow_business !== 'boolean') {
      console.warn(`[ig-gate] follow check returned no is_user_follow_business for sender=${senderId}`)
      return null
    }
    const follows = json.is_user_follow_business
    console.log(
      `[ig-gate] follow check result: is_user_follow_business=${json.is_user_follow_business} → follows=${follows}`,
    )
    return follows
  } catch (e) {
    console.warn(`[ig-gate] follow check error: ${(e as Error).message}`)
    return null
  }
}

/**
 * Try to fulfill a pending SOFT follow-gate when the user sends the confirm keyword.
 * `'fulfilled'` — this event released the content; `'handled'` — the tap was
 * answered (retry prompt, or another event already claimed the gate).
 */
async function tryFulfillFollowGate(
  ctx: AutomationContext,
): Promise<false | 'handled' | 'fulfilled'> {
  const { adapter, msg, agent, channelConfig } = ctx
  const text = msg.text?.trim().toLowerCase()
  if (!text || !msg.senderId) return false

  const gate = await prisma.instagramFollowGate.findFirst({
    where: {
      agentId: agent.id,
      igSenderId: msg.senderId,
      status: 'PENDING',
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  })
  if (!gate) return false

  const payload = (gate.payload && typeof gate.payload === 'object'
    ? gate.payload
    : {}) as Record<string, unknown>
  const confirmKw = typeof payload.gateConfirmKeyword === 'string'
    ? payload.gateConfirmKeyword
    : ''
  const gateMode = typeof payload.gateMode === 'string' ? payload.gateMode : 'SOFT'
  if (gateMode === 'STORY_MENTION') return false

  if (!confirmKw || !isGateConfirmText(confirmKw, text)) return false

  // ── VERIFY the user actually follows the account ──
  // Before fulfilling the gate, check if the user is really a follower.
  // If they're NOT following, re-send the gate prompt (don't deliver content).
  if (channelConfig) {
    const follows = await checkUserFollows(channelConfig, msg.senderId)
    if (follows === false) {
      console.log(`[ig-gate] user ${msg.senderId} clicked "${text}" but does NOT follow — re-sending gate prompt, sweep will auto-verify`)
      // The user tapped before following (or Meta's follow state had not
      // propagated yet). Tell them the content arrives AUTOMATICALLY once the
      // follow is visible — the scheduler sweep re-checks pending gates every
      // few minutes and delivers the parked content without another tap.
      const gateQuickReply = typeof payload.gateQuickReply === 'string'
        ? payload.gateQuickReply
        : 'دنبال کردم'
      const gateButtonType = typeof payload.gateButtonType === 'string'
        ? payload.gateButtonType
        : 'button'
      const retryPrompt =
        'هنوز فالو ثبت نشده 🙂\n\nاگر تازه فالو کردی، چند لحظه صبر کن — محتوای پیام به‌صورت خودکار ارسال می‌شود. اگر نیامد، دوباره روی دکمه بزن.'
      // The tap just (re)opened the messaging window and tells the sweep this
      // customer is actively trying — restart its fast re-check cadence.
      await patchGatePayload(gate.id, { lastTapAt: Date.now(), lastAutoCheckAt: 0 })
      await ctx.beforeDispatch?.()
      try {
        if (gateButtonType === 'quick_reply') {
          await adapter.sendText(gate.chatId, retryPrompt, {
            quickReplies: [gateQuickReply],
          })
        } else if (channelConfig) {
          await sendButtonMessage(channelConfig, gate.chatId, retryPrompt, [
            { title: gateQuickReply },
          ])
        } else {
          await adapter.sendText(gate.chatId, retryPrompt, {
            quickReplies: [gateQuickReply],
          })
        }
      } catch {
        await adapter.sendText(gate.chatId, retryPrompt, {
          quickReplies: [gateQuickReply],
        })
      }
      return 'handled' // gate handled (but not fulfilled) — don't fall through to AI
    }
  }

  // User follows (or check failed = treat as following) → fulfill the gate.
  // Claim it atomically: a double tap, or a tap racing the sweep, must not
  // deliver the parked content twice.
  if (!(await claimPendingGate(gate.id))) return 'handled'

  // Deliver the gated content — the FULL messages[] array. Gates created by
  // older builds stored only `contentText` — honor that too so a pending gate
  // never fulfills into silence.
  const contentMessages = Array.isArray(payload.contentMessages)
    ? (payload.contentMessages as Array<Record<string, unknown>>)
    : typeof payload.contentText === 'string' && payload.contentText.trim()
      ? [{ type: 'TEXT', text: payload.contentText }]
      : []

  if (contentMessages.length > 0 && channelConfig) {
    try {
      await deliverWithReceipt(ctx, (tracked) =>
        deliverEntries(tracked, gate.chatId, contentMessages.map(toRichEntry)),
      )
    } catch (e) {
      captureError('instagram:gate:deliver', e, {
        workspaceId: agent.workspaceId,
        metadata: { gateId: gate.id, gateMode },
      })
    }
  }
  return 'fulfilled'
}

/** Fulfill a pending STORY_MENTION gate when the mention webhook arrives. */
async function tryFulfillGateByMention(
  ctx: AutomationContext,
): Promise<boolean> {
  const { adapter, msg, agent, quickReplies } = ctx
  if (!msg.senderId) return false

  const gate = await prisma.instagramFollowGate.findFirst({
    where: {
      agentId: agent.id,
      igSenderId: msg.senderId,
      status: 'PENDING',
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  })
  if (!gate) return false

  const payload = (gate.payload && typeof gate.payload === 'object'
    ? gate.payload
    : {}) as Record<string, unknown>
  const gateMode = typeof payload.gateMode === 'string' ? payload.gateMode : 'SOFT'
  if (gateMode !== 'STORY_MENTION') return false
  const contentText = typeof payload.contentText === 'string'
    ? payload.contentText
    : ''

  if (!(await claimPendingGate(gate.id))) return true

  if (contentText) {
    try {
      await ctx.beforeDispatch?.()
      await adapter.sendText(gate.chatId, contentText, { quickReplies })
    } catch (e) {
      captureError('instagram:gate:deliver', e, {
        workspaceId: agent.workspaceId,
        metadata: { gateId: gate.id },
      })
    }
  }
  return true
}

// ─── FOLLOW-GATE AUTO-RECHECK SWEEP ─────────────────────────────────────
//
// WHY: Instagram sends NO webhook when a user starts following the account,
// and Meta's `is_user_follow_business` state lags a few seconds behind the
// actual tap. So a customer who taps «دنبال کردم» BEFORE following (very
// common — they react to the button instantly) gets "هنوز فالو ثبت نشده"
// and then… nothing, because the flow only re-checked on the NEXT tap.
//
// This sweep closes that hole: every few minutes, re-check recent PENDING
// follow-gates against the Graph API and, as soon as the follow is visible,
// deliver the parked content automatically — no second tap required.
//
// Bounds (operator request: «بدون فشار»):
//   - only gates created in the last 48 h — the customer may follow hours
//     after commenting (tap delivery is not guaranteed by Meta), so a short
//     window silently abandoned recoverable gates
//   - backoff: a gate is re-checked every cycle right after it was created or
//     tapped, then ever more rarely (up to once per 2 h) — ~50 Graph calls
//     over the whole window instead of one every cycle
//   - at most 25 checks per cycle, least-recently-checked first, so a busy
//     account can never starve everyone else's gates
//   - STORY_MENTION gates are skipped (no follow rule to verify), and so are
//     gates of a paused scenario or an expired workspace
//   - a gate is consumed only when content really went out: if Meta rejects
//     the first part (typically a closed 24-hour window) the gate goes back to
//     PENDING for the customer's next tap; after 3 such rejections the sweep
//     stops retrying it

/** How long after creation a gate stays eligible for auto-rechecks. */
const GATE_AUTO_CHECK_WINDOW_MS = 48 * 60 * 60 * 1000
/** Shortest spacing between two auto-checks — just under the 5-min cycle. */
const GATE_AUTO_CHECK_MIN_GAP_MS = 4 * 60 * 1000
/** Longest spacing once a gate has been quiet for many hours. */
const GATE_AUTO_CHECK_MAX_GAP_MS = 2 * 60 * 60 * 1000
/** Rows scanned per cycle; the due ones are then ranked and capped. */
const GATE_SWEEP_SCAN_LIMIT = 300
/** Graph follow-checks per cycle. */
const GATE_SWEEP_CHECKS_PER_CYCLE = 25
/** Rejected deliveries after which the sweep leaves a gate to manual taps. */
const GATE_AUTO_DELIVER_MAX_FAILURES = 3

/**
 * Spacing between auto-checks for a gate whose last activity (creation or
 * confirm tap) was `sinceActivityMs` ago: every cycle for the first ~25 min,
 * then one sixth of the gate's quiet time, capped at 2 h.
 */
export function gateAutoCheckGapMs(sinceActivityMs: number): number {
  return Math.min(
    GATE_AUTO_CHECK_MAX_GAP_MS,
    Math.max(GATE_AUTO_CHECK_MIN_GAP_MS, Math.floor(sinceActivityMs / 6)),
  )
}

/** Re-verify pending follow-gates; deliver content when the follow landed. */
export async function sweepInstagramFollowGates(): Promise<number> {
  const now = Date.now()
  const candidates = await prisma.instagramFollowGate.findMany({
    where: {
      status: 'PENDING',
      expiresAt: { gt: new Date(now) },
      createdAt: { gte: new Date(now - GATE_AUTO_CHECK_WINDOW_MS) },
    },
    orderBy: { createdAt: 'desc' },
    take: GATE_SWEEP_SCAN_LIMIT,
    select: {
      id: true,
      agentId: true,
      automationId: true,
      igSenderId: true,
      chatId: true,
      createdAt: true,
      payload: true,
      automation: { select: { type: true, active: true } },
    },
  })

  const due = candidates
    .map((gate) => {
      const payload = (gate.payload && typeof gate.payload === 'object' && !Array.isArray(gate.payload)
        ? gate.payload
        : {}) as Record<string, unknown>
      const lastCheck = typeof payload.lastAutoCheckAt === 'number' ? payload.lastAutoCheckAt : 0
      const lastTap = typeof payload.lastTapAt === 'number' ? payload.lastTapAt : 0
      const failures = typeof payload.autoDeliverFailures === 'number' ? payload.autoDeliverFailures : 0
      return { gate, payload, lastCheck, failures, lastActivity: Math.max(gate.createdAt.getTime(), lastTap) }
    })
    .filter(({ gate, payload, lastCheck, failures, lastActivity }) => {
      if (gate.automation?.active === false) return false
      const gateMode = typeof payload.gateMode === 'string' ? payload.gateMode : 'SOFT'
      if (gateMode === 'STORY_MENTION') return false
      if (failures >= GATE_AUTO_DELIVER_MAX_FAILURES) return false
      const hasRichContent = Array.isArray(payload.contentMessages) && payload.contentMessages.length > 0
      const hasLegacyContent =
        typeof payload.contentText === 'string' && payload.contentText.trim().length > 0
      if (!hasRichContent && !hasLegacyContent) return false
      return now - lastCheck >= gateAutoCheckGapMs(now - lastActivity)
    })
    .sort((x, y) => x.lastCheck - y.lastCheck)
    .slice(0, GATE_SWEEP_CHECKS_PER_CYCLE)

  // One agent/channel/entitlement lookup per agent, not per gate.
  const routes = new Map<string, { workspaceId: string; config: Prisma.JsonValue } | null>()
  const routeFor = async (agentId: string) => {
    if (routes.has(agentId)) return routes.get(agentId) ?? null
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: { workspaceId: true },
    })
    const channel = agent
      ? await prisma.agentChannel.findFirst({
          where: { agentId, type: 'INSTAGRAM', active: true },
          select: { config: true },
        })
      : null
    const access = agent && channel ? await checkWorkspaceActive(agent.workspaceId) : null
    const route = agent && channel && access?.allowed
      ? { workspaceId: agent.workspaceId, config: channel.config }
      : null
    routes.set(agentId, route)
    return route
  }

  let fulfilledCount = 0
  for (const { gate, payload, failures } of due) {
    const route = await routeFor(gate.agentId)
    if (!route) continue

    const follows = await checkUserFollows(route.config, gate.igSenderId)

    // Not following yet (or the check itself failed) — stamp the backoff
    // marker and wait for a later cycle. Never deliver on a failed check.
    if (follows !== true) {
      await patchGatePayload(gate.id, { lastAutoCheckAt: Date.now() })
      continue
    }

    // The follow is visible. Claim the gate first — a confirm tap landing at
    // this very moment must not deliver the same content a second time.
    if (!(await claimPendingGate(gate.id))) continue
    console.log(`[ig-gate] sweep: user ${gate.igSenderId} now follows — delivering gated content (gate ${gate.id})`)

    const contentMessages: RichEntry[] =
      Array.isArray(payload.contentMessages) && payload.contentMessages.length > 0
        ? (payload.contentMessages as Array<Record<string, unknown>>).map(toRichEntry)
        : [{ type: 'TEXT', text: payload.contentText as string }]
    const receipt: string[] = []
    const receiptMedia: NonNullable<AutomationContext['receiptMedia']> = []
    const products: ProductShowcase[] = []
    let sentParts = 0
    let rejected: unknown = null
    for (const entry of contentMessages) {
      const resolvedBefore = products.length
      let result: Awaited<ReturnType<typeof sendRichEntry>>
      try {
        result = await sendRichEntry(
          route.config,
          gate.chatId,
          entry,
          async (chatId, text) => {
            await sendInstagramText(route.config, chatId, text)
          },
          async (productId) => {
            const p = await resolveProduct(gate.agentId, productId)
            if (p) products.push(p)
            return p
          },
          async (productIds) => {
            const list = await resolveProducts(gate.agentId, productIds)
            products.push(...list)
            return list
          },
          route.workspaceId,
        )
      } catch (e) {
        // A closed 24-hour window is the one failure sendRichEntry re-throws.
        result = 'failed'
        rejected = e
      }
      if (result === 'sent') {
        sentParts += 1
        if ((entry.type === 'TEXT' || entry.type === 'QUICK_REPLY') && entry.text) receipt.push(entry.text)
        pushMediaNote(receipt, entry)
        const structured = structuredMediaEntry(entry)
        if (structured) receiptMedia.push(structured)
        continue
      }
      products.length = resolvedBefore
      if (result === 'failed') {
        rejected ??= new Error(`gate part ${entry.type} rejected`)
        // Nothing reached the customer yet → stop and hand the gate back.
        // After a partial delivery keep going: the rest may still land.
        if (sentParts === 0 || isInstagram24hWindowError(rejected)) break
      }
    }

    if (sentParts === 0 && rejected) {
      // Meta refused the very first part — the customer got nothing. Keep the
      // content parked so their next tap (which reopens the window) delivers it.
      await patchGatePayload(
        gate.id,
        { lastAutoCheckAt: Date.now(), autoDeliverFailures: failures + 1 },
        { status: 'PENDING', fulfilledAt: null },
      )
      captureWarning('instagram:gate:sweep:deliver', rejected, {
        workspaceId: route.workspaceId,
        metadata: { gateId: gate.id, attempt: failures + 1 },
      })
      continue
    }
    if (sentParts === 0) continue // nothing deliverable (e.g. products deleted)
    fulfilledCount += 1
    for (const p of products) receipt.push(productMarker(p))

    const conversationId = await persistSweepReceipt(gate.agentId, gate.chatId, receipt, receiptMedia)

    // The run report stays consistent with a manual confirm: same outcome tag.
    try {
      await prisma.instagramAutomationRun.create({
        data: {
          automationId: gate.automationId,
          agentId: gate.agentId,
          workspaceId: route.workspaceId,
          igUserId: gate.igSenderId,
          trigger: (gate.automation as { type?: 'DIRECT_MESSAGE' | 'COMMENT' | 'STORY' } | null)?.type
            ?? 'COMMENT',
          outcome: 'FOLLOW_CONFIRMED',
          conversationId,
        },
      })
    } catch {
      // Reporting only — the content already went out.
    }
  }
  return fulfilledCount
}

/**
 * Record what the sweep delivered as the conversation's assistant message, so
 * the operator sees the released content in the CRM inbox like any other
 * scenario reply. Returns the conversation id (null when the customer has no
 * thread yet — e.g. a commenter who never opened the DM).
 */
async function persistSweepReceipt(
  agentId: string,
  chatId: string,
  receipt: string[],
  receiptMedia: NonNullable<AutomationContext['receiptMedia']>,
): Promise<string | null> {
  try {
    const conversation = await prisma.conversation.findFirst({
      where: { agentId, channel: 'INSTAGRAM', externalId: chatId, deletedAt: null },
      select: { id: true },
    })
    if (!conversation) return null
    const text = receipt.filter(Boolean).join('\n\n').trim()
    if (!text) return conversation.id
    const media = receiptMedia.slice(0, 10)
    await prisma.$transaction([
      prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: 'ASSISTANT',
          content: text,
          ...(media.length ? { metadata: { vigentoOutbound: { media } } as Prisma.InputJsonValue } : {}),
        },
      }),
      prisma.conversation.update({
        where: { id: conversation.id },
        data: { messageCount: { increment: 1 }, lastMessageAt: new Date() },
      }),
    ])
    return conversation.id
  } catch (e) {
    captureError('instagram:gate:sweep:receipt', e, { metadata: { agentId, chatId } })
    return null
  }
}

// ─── CHANNEL REPLY POLICY + STOP-WORD / STOP_AI EVALUATION ────────────
//
// The handler (lib/channels/handler.ts) calls `shouldAgentReply()` AFTER
// running the automation engine. The decision combines:
//   1. the channel-level reply policy (default AGENT_EXCEPT_SCENARIOS)
//   2. the master AI toggle on InstagramAutomationSettings
//   3. the per-conversation `metadata.aiPaused` flag (set by STOP_AI scenarios)
//   4. whether the inbound text matches a stop-word (also pauses AI)
//
// When this returns false, the handler normally records the inbound but skips
// the AI turn. The one deliberate exception is an unmatched AUTOMATION_ONLY
// event: the handler now rejects that before creating a Conversation because
// neither a scenario nor the AI owns it.

/** Snapshot of the per-(agent × channel) automation policy + toggles. */
export interface AutomationPolicy {
  replyPolicy: InstagramReplyPolicy
  dmReplyPolicy: InstagramReplyPolicy
  storyReplyPolicy: InstagramReplyPolicy
  commentReplyPolicy: InstagramReplyPolicy
  stopWords: string[]
  aiEnabled: boolean
  storyReactionReplyEnabled: boolean
  storyReactionReplyText: string | null
  commentEmojiReplyEnabled: boolean
  commentEmojiReplyText: string | null
  likeDmAfterReply: boolean
  likeStoryReplyAfterReply: boolean
  likeStoryReactionAfterReply: boolean
  likeCommentAfterReply: boolean
}

/** Default policy when no InstagramAutomationSettings row exists yet. */
export const DEFAULT_AUTOMATION_POLICY: AutomationPolicy = {
  replyPolicy: 'AGENT_EXCEPT_SCENARIOS',
  dmReplyPolicy: 'AGENT_EXCEPT_SCENARIOS',
  storyReplyPolicy: 'AGENT_EXCEPT_SCENARIOS',
  commentReplyPolicy: 'AGENT_EXCEPT_SCENARIOS',
  stopWords: [],
  aiEnabled: true,
  storyReactionReplyEnabled: false,
  storyReactionReplyText: null,
  commentEmojiReplyEnabled: false,
  commentEmojiReplyText: null,
  likeDmAfterReply: false,
  likeStoryReplyAfterReply: false,
  likeStoryReactionAfterReply: false,
  likeCommentAfterReply: false,
}

function isReplyPolicy(v: unknown): v is InstagramReplyPolicy {
  return (
    v === 'ALL_AGENT' ||
    v === 'AGENT_EXCEPT_SCENARIOS' ||
    v === 'AUTOMATION_ONLY'
  )
}

/**
 * Load the automation policy for a channel. Reads the canonical
 * InstagramAutomationSettings row first; falls back to the inline snapshot
 * in AgentChannel.config.automationSettings (legacy channels); finally falls
 * back to the v1 default (AGENT_EXCEPT_SCENARIOS, AI on).
 */
export async function loadAutomationPolicy(
  agentId: string,
  channelConfig?: Prisma.JsonValue,
): Promise<AutomationPolicy> {
  const row = await prisma.instagramAutomationSettings.findUnique({
    where: { agentId },
    select: {
      replyPolicy: true,
      dmReplyPolicy: true,
      storyReplyPolicy: true,
      commentReplyPolicy: true,
      stopWords: true,
      aiEnabled: true,
      storyReactionReplyEnabled: true,
      storyReactionReplyText: true,
      commentEmojiReplyEnabled: true,
      commentEmojiReplyText: true,
      likeDmAfterReply: true,
      likeStoryReplyAfterReply: true,
      likeStoryReactionAfterReply: true,
      likeCommentAfterReply: true,
    },
  })
  if (row) {
    const policy = isReplyPolicy(row.replyPolicy)
      ? row.replyPolicy
      : 'AGENT_EXCEPT_SCENARIOS'
    return {
      replyPolicy: policy,
      dmReplyPolicy: isReplyPolicy(row.dmReplyPolicy) ? row.dmReplyPolicy : policy,
      storyReplyPolicy: isReplyPolicy(row.storyReplyPolicy) ? row.storyReplyPolicy : policy,
      commentReplyPolicy: isReplyPolicy(row.commentReplyPolicy) ? row.commentReplyPolicy : policy,
      stopWords: row.stopWords ?? [],
      aiEnabled: row.aiEnabled,
      storyReactionReplyEnabled: row.storyReactionReplyEnabled,
      storyReactionReplyText: row.storyReactionReplyText,
      commentEmojiReplyEnabled: row.commentEmojiReplyEnabled,
      commentEmojiReplyText: row.commentEmojiReplyText,
      likeDmAfterReply: row.likeDmAfterReply,
      likeStoryReplyAfterReply: row.likeStoryReplyAfterReply,
      likeStoryReactionAfterReply: row.likeStoryReactionAfterReply,
      likeCommentAfterReply: row.likeCommentAfterReply,
    }
  }
  // Legacy / pre-settings-table fallback.
  if (channelConfig !== undefined) {
    const snap = readAutomationPolicy(channelConfig)
    if (snap) return { ...DEFAULT_AUTOMATION_POLICY, ...snap }
  }
  return DEFAULT_AUTOMATION_POLICY
}

/**
 * Decide whether the AI agent should reply to this inbound Instagram message.
 *
 *   AUTOMATION_ONLY        → never (scenarios only; AI is OFF)
 *   ALL_AGENT              → yes, unless AI was paused per-conversation OR the
 *                            message matched a stop-word OR the master AI
 *                            toggle is off.
 *   AGENT_EXCEPT_SCENARIOS → same as ALL_AGENT, but the caller has ALREADY run
 *                            the scenarios and tells us via `scenarioHandled`.
 *                            When a scenario handled it, the AI must NOT reply
 *                            (we'd double-send). When no scenario matched, the
 *                            AI replies (subject to the stop-word / paused
 *                            checks).
 *
 * `conversationMetadata` is optional — when present, the per-conversation pause
 * flag is read from `Conversation.metadata.aiPaused`. When absent, only the
 * channel-level checks run.
 */
export async function shouldAgentReply(args: {
  policy: AutomationPolicy
  scenarioHandled: boolean
  text: string
  kind?: InboundMessage['kind']
  conversationMetadata?: Prisma.JsonValue
  conversationStatus?: string
}): Promise<boolean> {
  const { policy, scenarioHandled, text } = args
  const replyPolicy = args.kind === 'COMMENT'
    ? policy.commentReplyPolicy
    : args.kind === 'STORY_REPLY' || args.kind === 'STORY_REACTION' || args.kind === 'STORY_MENTION'
      ? policy.storyReplyPolicy
      : policy.dmReplyPolicy

  // Master toggle off → never.
  if (!policy.aiEnabled) return false

  // Automation-only channels never invoke the AI.
  if (replyPolicy === 'AUTOMATION_ONLY') return false

  // HANDED_OFF conversations are under operator control — the AI must NOT
  // interlope. The operator can resume AI via the dashboard "Resume AI" action
  // (which flips status back to OPEN). This preserves conversation context
  // (history, contact, customerInfoState) while preventing AI/operator overlap.
  if (args.conversationStatus === 'HANDED_OFF') return false

  // Per-conversation pause flag (set by STOP_AI scenarios, or by the operator).
  if (args.conversationMetadata !== undefined) {
    const m =
      args.conversationMetadata && typeof args.conversationMetadata === 'object'
        ? (args.conversationMetadata as Record<string, unknown>)
        : {}
    if (m.aiPaused === true) return false
  }

  // Stop-word match pauses AI for this single turn (we don't persist the flag
  // here — that's the STOP_AI scenario's job; stop-words just suppress one
  // reply so the operator can pick up the conversation manually).
  if (policy.stopWords.length && text) {
    const hay = text.trim().toLowerCase()
    if (hay) {
      for (const w of policy.stopWords) {
        const needle = w.trim().toLowerCase()
        if (needle && hay.includes(needle)) return false
      }
    }
  }

  // AGENT_EXCEPT_SCENARIOS: when a scenario already replied, the AI must not
  // double-send. ALL_AGENT: the AI ALWAYS replies in addition (use this for
  // "AI augments every message" flows).
  if (replyPolicy === 'AGENT_EXCEPT_SCENARIOS' && scenarioHandled) {
    return false
  }
  return true
}

/**
 * Clear `conversation.metadata.aiPaused` and flip status back to OPEN so the
 * AI agent resumes replying. Called by the dashboard "Resume AI" action. The
 * conversation row (history, contact, customerInfoState) is preserved — only
 * the pause flag is cleared. Returns true on success.
 */
export async function resumeAiForConversation(
  agentId: string,
  externalId: string,
): Promise<boolean> {
  const conv = await prisma.conversation.findFirst({
    where: { agentId, externalId, channel: 'INSTAGRAM' },
    orderBy: { createdAt: 'desc' },
    select: { id: true, metadata: true, status: true },
})
  if (!conv) return false
  const m =
    conv.metadata && typeof conv.metadata === 'object'
      ? (conv.metadata as Record<string, unknown>)
      : {}
  // Clear the pause flag + reopen the conversation in one update. History is
  // untouched — the AI continues with full context.
  const next: Record<string, unknown> = { ...m }
  delete next.aiPaused
  delete next.pausedAt
  delete next.pausedBy
  await prisma.conversation.update({
    where: { id: conv.id },
    data: {
      metadata: next as Prisma.InputJsonValue,
      status: 'OPEN',
      handedOff: false,
    },
  })
  return true
}

/**
 * Set `conversation.metadata.aiPaused = true` for the conversation identified
 * by (agentId, externalId). Used by the STOP_AI scenario mode. The metadata
 * blob is merged (so other fields are preserved) — and the unique constraint
 * on (agentId, channel, externalId) makes the lookup safe.
 */
export async function pauseAiForConversation(
  agentId: string,
  externalId: string,
): Promise<void> {
  const conv = await prisma.conversation.findFirst({
    where: { agentId, externalId, channel: 'INSTAGRAM' },
    select: { id: true, metadata: true },
  })
  if (!conv) return
  const existing =
    conv.metadata && typeof conv.metadata === 'object'
      ? (conv.metadata as Record<string, unknown>)
      : {}
  if (existing.aiPaused === true) return
  await prisma.conversation.update({
    where: { id: conv.id },
    data: {
      metadata: {
        ...existing,
        aiPaused: true,
        pausedAt: new Date().toISOString(),
      } as Prisma.InputJsonValue,
    },
  })
}

/**
 * Look up a product assigned to the agent's catalog and shape it as a
 * showcase card. Returns null when the product isn't in the agent's catalog
 * (so a misconfigured PRODUCT scenario degrades gracefully — we just skip).
 */
async function resolveProduct(
  agentId: string,
  productId: string,
): Promise<ProductShowcase | null> {
  // Try AgentCatalog first (products explicitly linked to this agent).
  const catalogRow = await prisma.agentCatalog.findFirst({
    where: { agentId, productId },
    select: {
      product: {
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          images: true,
          externalUrl: true,
        },
      },
    },
  })
  if (catalogRow) {
    const p = catalogRow.product
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      price: p.price,
      // v3.1: pick the first JPG/PNG/GIF over webp (Meta's Generic Template
      // silently drops webp) and percent-encode Persian path segments.
      imageUrl: pickTemplateImageUrl(p.images),
      productUrl: p.externalUrl ?? null,
    }
  }
  // Fallback: look up the product directly by id (it might not be in the
  // agent's catalog but still exists in the workspace's product table).
  // We verify workspace ownership via the agent.
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { workspaceId: true },
  })
  if (!agent) return null
  const product = await prisma.product.findFirst({
    where: { id: productId, workspaceId: agent.workspaceId },
    select: {
      id: true,
      name: true,
      description: true,
      price: true,
      images: true,
      externalUrl: true,
    },
  })
  if (!product) return null
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    price: product.price,
    // v3.1: same Meta-safe image selection as the catalog branch above.
    imageUrl: pickTemplateImageUrl(product.images),
    productUrl: product.externalUrl ?? null,
  }
}

/**
 * Resolve multiple products by id for the carousel (PRODUCT_LIST) reply mode.
 * Returns the showcase snapshots in the SAME ORDER as the input `productIds`,
 * skipping any ids that don't resolve (so a missing product doesn't break the
 * carousel — Meta would reject a card with an empty title).
 *
 * Caps the result at 10 entries — Meta's Generic Template Carousel limit.
 */
async function resolveProducts(
  agentId: string,
  productIds: string[],
): Promise<ProductShowcase[]> {
  // De-duplicate while preserving order so the carousel never shows the same
  // product twice even if the form accidentally stored a duplicate id.
  const seen = new Set<string>()
  const uniqueIds: string[] = []
  for (const id of productIds) {
    if (id && !seen.has(id)) {
      seen.add(id)
      uniqueIds.push(id)
    }
  }
  const capped = uniqueIds.slice(0, 10)

  const out: ProductShowcase[] = []
  for (const id of capped) {
    const p = await resolveProduct(agentId, id)
    if (p) out.push(p)
  }
  return out
}
