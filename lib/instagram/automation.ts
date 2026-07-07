import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { InboundMessage, MessengerAdapter } from '@/lib/channels/types'
import type { ChatAgent } from '@/lib/ai/chat-engine'
import { generateReply } from '@/lib/ai/chat-engine'
import { captureError } from '@/lib/errors/capture'
import {
        sendImage,
        sendAudio,
        sendVideo,
        sendProductCard,
        sendRichEntry,
        type ProductShowcase,
} from '@/lib/instagram/media'
import {
        readAutomationPolicy,
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
  /** STORY only: 'ALL' (every story reply/mention) | 'KEYWORD' (match text). */
  storyScope?: 'ALL' | 'KEYWORD'
  /** COMMENT only: restrict to specific post/reel ids. */
  postIds?: string[]
}

export interface AutomationAction {
  replyMode?: 'STATIC' | 'AI' | 'FLOW' | 'SILENT' | 'STOP_AI' | 'MULTI_MESSAGE'
  /**
   * SILENT   — don't reply at all (skip; used for "no reply" comment scenarios).
   * STOP_AI  — pause AI for this conversation (sets conversation.metadata.aiPaused)
   *             and reply with `replyText` (or just ack silently when empty).
   * MULTI_MESSAGE — pick ONE entry from `messages[]` at random and send it.
   *             Mirrors Vardast's "یکی از پیام‌های زیر" (one of these messages).
   */
  replyText?: string
  /**
   * `messages[]` is used by MULTI_MESSAGE. Each entry is a typed payload that
   * the media helpers know how to send (TEXT/IMAGE/AUDIO/VIDEO/PRODUCT).
   */
  messages?: Array<{
    type: 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'PRODUCT'
    text?: string
    mediaUrl?: string
    productId?: string
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
  /** Require a follow before sending the content. */
  followGate?: boolean
  gateMode?: 'SOFT' | 'STORY_MENTION'
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
  'FLOW',
  'SILENT',
  'STOP_AI',
  'MULTI_MESSAGE',
]

function isReplyMode(v: unknown): v is ReplyMode {
  return typeof v === 'string' && (VALID_REPLY_MODES as string[]).includes(v)
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
    storyScope: o.storyScope === 'ALL' ? 'ALL' : 'KEYWORD',
    postIds: Array.isArray(o.postIds)
      ? o.postIds.filter((k): k is string => typeof k === 'string')
      : [],
  }
}

function readAction(a: Prisma.JsonValue): AutomationAction {
  const o = (a && typeof a === 'object' ? a : {}) as Record<string, unknown>
  return {
    replyMode: isReplyMode(o.replyMode) ? o.replyMode : 'STATIC',
    replyText: typeof o.replyText === 'string' ? o.replyText : '',
    messages: Array.isArray(o.messages)
      ? (o.messages
          .filter((m): m is Record<string, unknown> => !!m && typeof m === 'object')
          .map((m) => ({
            type: (
              m.type === 'IMAGE' ||
              m.type === 'AUDIO' ||
              m.type === 'VIDEO' ||
              m.type === 'PRODUCT'
                ? m.type
                : 'TEXT'
            ) as 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'PRODUCT',
            text: typeof m.text === 'string' ? m.text : undefined,
            mediaUrl: typeof m.mediaUrl === 'string' ? m.mediaUrl : undefined,
            productId: typeof m.productId === 'string' ? m.productId : undefined,
          }))
          .filter((m) =>
            m.type === 'TEXT'
              ? !!m.text
              : m.type === 'PRODUCT'
                ? !!m.productId
                : !!m.mediaUrl,
          ))
      : [],
    mediaType:
      o.mediaType === 'IMAGE' ||
      o.mediaType === 'AUDIO' ||
      o.mediaType === 'VIDEO' ||
      o.mediaType === 'PRODUCT'
        ? o.mediaType
        : 'TEXT',
    mediaUrl: typeof o.mediaUrl === 'string' ? o.mediaUrl : '',
    productId: typeof o.productId === 'string' ? o.productId : '',
    dmOnComment: o.dmOnComment === true,
    followGate: o.followGate === true,
    gateMode: o.gateMode === 'STORY_MENTION' ? 'STORY_MENTION' : 'SOFT',
    gatePrompt: typeof o.gatePrompt === 'string' ? o.gatePrompt : '',
    gateConfirmKeyword:
      typeof o.gateConfirmKeyword === 'string' ? o.gateConfirmKeyword : '',
    gateQuickReply: typeof o.gateQuickReply === 'string' ? o.gateQuickReply : '',
    contentText: typeof o.contentText === 'string' ? o.contentText : '',
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
    case 'STORY_MENTION':
      return 'STORY'
    case 'DM':
    default:
      return 'DIRECT_MESSAGE'
  }
}

const GATE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

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
}

/**
 * Try to handle an inbound Instagram message via an automation scenario.
 * Returns `handled: true` when the engine sent a reply itself (so the caller
 * must NOT run the default AI turn). Returns `handled: false` when no scenario
 * matched and the caller should fall back to the agent AI.
 */
export async function runInstagramAutomation(
  ctx: AutomationContext,
): Promise<{ handled: boolean }> {
  const { agent, channelId, msg } = ctx

  // ─── 1. Follow-gate fulfillment (DM only) ───────────────────────────
  // When the user replies with the gate confirm keyword, look up their pending
  // gate and deliver the gated content. This runs BEFORE keyword matching so a
  // confirm keyword like "done" can't be hijacked by another scenario.
  if (msg.kind === 'DM' || msg.kind === undefined) {
    const fulfilled = await tryFulfillFollowGate(ctx)
    if (fulfilled) return { handled: true }
  }

  // ─── 2. STORY_MENTION hard-gate fulfillment ────────────────────────
  // A STORY_MENTION event for a sender with a pending STORY_MENTION gate
  // fulfills the gate (the user proved engagement by mentioning the account).
  if (msg.kind === 'STORY_MENTION') {
    const fulfilled = await tryFulfillGateByMention(ctx)
    if (fulfilled) return { handled: true }
  }

  // ─── 3. Scenario matching ──────────────────────────────────────────
  const type = kindToType(msg.kind)
  if (!type) return { handled: false }

  const scenarios = await prisma.instagramAutomation.findMany({
    where: { agentId: agent.id, channelId, active: true, type },
    orderBy: { priority: 'desc' },
  })
  if (!scenarios.length) return { handled: false }

  for (const row of scenarios as AutomationRow[]) {
    const trigger = readTrigger(row.trigger)
    const action = readAction(row.action)

    let matched = false
    if (type === 'STORY') {
      // Story scenarios match on scope: ALL (any reply/mention) or KEYWORD.
      matched =
        trigger.storyScope === 'ALL' || matchKeywords(msg.text, trigger)
    } else if (type === 'COMMENT') {
      // Optionally restrict to specific posts.
      if (
        trigger.postIds?.length &&
        msg.postId &&
        !trigger.postIds.includes(msg.postId)
      ) {
        continue
      }
      matched = matchKeywords(msg.text, trigger)
    } else {
      matched = matchKeywords(msg.text, trigger)
    }
    if (!matched) continue

    // ─── Matched. Execute the action. ───
    try {
      await executeAction(ctx, row, action)
    } catch (e) {
      captureError(`instagram:automation:${row.id}`, e, {
        workspaceId: agent.workspaceId,
        metadata: { agentId: agent.id, automationId: row.id },
      })
    }
    return { handled: true }
  }

  return { handled: false }
}

/** Send the configured reply for a matched scenario. */
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

  // ─── Follow-gate: send the gate prompt + create a pending gate ───
  if (action.followGate && action.gatePrompt) {
    const qr = action.gateQuickReply ? [action.gateQuickReply] : quickReplies
    // Reply publicly for comments, DM for DMs/stories.
    await adapter.sendText(msg.chatId, action.gatePrompt, {
      quickReplies: isComment ? undefined : qr,
    })
    await prisma.instagramFollowGate.create({
      data: {
        automationId: row.id,
        agentId: agent.id,
        contactId: contactId ?? null,
        igSenderId: msg.senderId,
        chatId: msg.senderId, // DM address for the gated content
        status: 'PENDING',
        expiresAt: new Date(Date.now() + GATE_TTL_MS),
        payload: {
          kind: msg.kind,
          commentId: msg.commentId,
          postId: msg.postId,
          storyId: msg.storyId,
          gateMode: action.gateMode,
          contentText: action.contentText,
        } as Prisma.InputJsonValue,
      },
    })
    return
  }

  // ─── MULTI_MESSAGE: pick one of `messages[]` at random and send it ───
  if (action.replyMode === 'MULTI_MESSAGE' && action.messages?.length) {
    const entry = action.messages[
      Math.floor(Math.random() * action.messages.length)
    ]
    const target = isComment && action.dmOnComment ? msg.senderId : msg.chatId
    await sendRichEntry(
      channelConfig ?? null,
      target,
      entry,
      async (cid, text) =>
        adapter.sendText(cid, text, {
          quickReplies: isComment ? undefined : quickReplies,
        }),
      (productId) => resolveProduct(agent.id, productId),
      agent.workspaceId,
    )
    // Optionally also push the public reply text on a comment→DM funnel.
    if (
      isComment &&
      action.dmOnComment &&
      entry.type === 'TEXT' &&
      entry.text
    ) {
      await adapter.sendText(msg.chatId, entry.text).catch(() => undefined)
    }
    return
  }

  // ─── STATIC rich reply (IMAGE / AUDIO / VIDEO / PRODUCT) ───
  if (
    action.replyMode === 'STATIC' &&
    action.mediaType &&
    action.mediaType !== 'TEXT' &&
    channelConfig
  ) {
    const target = isComment && action.dmOnComment ? msg.senderId : msg.chatId
    if (action.mediaType === 'IMAGE' && action.mediaUrl) {
      await sendImage(channelConfig, target, action.mediaUrl, action.replyText || undefined)
    } else if (action.mediaType === 'AUDIO' && action.mediaUrl) {
      await sendAudio(channelConfig, target, action.mediaUrl)
    } else if (action.mediaType === 'VIDEO' && action.mediaUrl) {
      await sendVideo(channelConfig, target, action.mediaUrl)
    } else if (action.mediaType === 'PRODUCT' && action.productId) {
      const product = await resolveProduct(agent.id, action.productId)
      if (product) await sendProductCard(channelConfig, target, product)
    }
    // For comment→DM funnels, also leave a public ack on the comment.
    if (isComment && action.dmOnComment && action.replyText) {
      await adapter.sendText(msg.chatId, action.replyText).catch(() => undefined)
    }
    return
  }

  // ─── STATIC reply (text) ───
  if (action.replyMode === 'STATIC' && action.replyText) {
    if (isComment && action.dmOnComment) {
      // Public acknowledgment + private DM with the real content.
      await adapter.sendText(msg.chatId, action.replyText)
      await adapter.sendText(msg.senderId, action.contentText || action.replyText, {
        quickReplies,
      })
      return
    }
    await adapter.sendText(msg.chatId, action.replyText, {
      quickReplies: isComment ? undefined : quickReplies,
    })
    return
  }

  // ─── AI reply (route through the agent's AI engine) ───
  if (action.replyMode === 'AI' || action.aiAgentEnabled) {
    const result = await generateReply({
      workspaceId: agent.workspaceId,
      agent,
      message: msg.text,
      channel: 'INSTAGRAM',
      contactId: contactId ?? undefined,
      contactName: contactName ?? undefined,
      externalId: msg.chatId,
    })
    if ('error' in result) return
    await adapter.sendText(msg.chatId, result.reply, {
      quickReplies: isComment ? undefined : quickReplies,
    })
    return
  }

  // ─── Fallback: static contentText (used after gateless comment→DM) ───
  if (action.contentText) {
    await adapter.sendText(
      isComment ? msg.senderId : msg.chatId,
      action.contentText,
      { quickReplies: isComment ? undefined : quickReplies },
    )
  }
}

/** Try to fulfill a pending SOFT follow-gate when the user sends the confirm keyword. */
async function tryFulfillFollowGate(
  ctx: AutomationContext,
): Promise<boolean> {
  const { adapter, msg, agent, quickReplies } = ctx
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
  const contentText = typeof payload.contentText === 'string'
    ? payload.contentText
    : ''
  // Soft gate: confirm keyword (e.g. "done" / "فالو کردم"). Hard
  // STORY_MENTION gate is NOT fulfilled by a keyword — it needs the mention
  // webhook (handled in tryFulfillGateByMention).
  const gateMode = typeof payload.gateMode === 'string' ? payload.gateMode : 'SOFT'
  if (gateMode === 'STORY_MENTION') return false

  if (!confirmKw || text !== confirmKw.trim().toLowerCase()) return false

  await prisma.instagramFollowGate.update({
    where: { id: gate.id },
    data: { status: 'FULFILLED', fulfilledAt: new Date() },
  })

  if (contentText) {
    try {
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

  await prisma.instagramFollowGate.update({
    where: { id: gate.id },
    data: { status: 'FULFILLED', fulfilledAt: new Date() },
  })

  if (contentText) {
    try {
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

// ─── CHANNEL REPLY POLICY + STOP-WORD / STOP_AI EVALUATION ────────────
//
// The handler (lib/channels/handler.ts) calls `shouldAgentReply()` AFTER
// running the automation engine. The decision combines:
//   1. the channel-level reply policy (default AGENT_EXCEPT_SCENARIOS)
//   2. the master AI toggle on InstagramAutomationSettings
//   3. the per-conversation `metadata.aiPaused` flag (set by STOP_AI scenarios)
//   4. whether the inbound text matches a stop-word (also pauses AI)
//
// When this returns false, the handler records the inbound (still happens in
// generateReply — see handler) but SKIPS the AI turn / outbound reply.

/** Snapshot of the per-(agent × channel) automation policy + toggles. */
export interface AutomationPolicy {
  replyPolicy: InstagramReplyPolicy
  stopWords: string[]
  aiEnabled: boolean
}

/** Default policy when no InstagramAutomationSettings row exists yet. */
export const DEFAULT_AUTOMATION_POLICY: AutomationPolicy = {
  replyPolicy: 'AGENT_EXCEPT_SCENARIOS',
  stopWords: [],
  aiEnabled: true,
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
  channelId: string,
  channelConfig?: Prisma.JsonValue,
): Promise<AutomationPolicy> {
  const row = await prisma.instagramAutomationSettings.findUnique({
    where: { agentId },
    select: {
      replyPolicy: true,
      stopWords: true,
      aiEnabled: true,
    },
  })
  if (row) {
    const policy = isReplyPolicy(row.replyPolicy)
      ? row.replyPolicy
      : 'AGENT_EXCEPT_SCENARIOS'
    return {
      replyPolicy: policy,
      stopWords: row.stopWords ?? [],
      aiEnabled: row.aiEnabled,
    }
  }
  // Legacy / pre-settings-table fallback.
  if (channelConfig !== undefined) {
    const snap = readAutomationPolicy(channelConfig)
    if (snap) return snap
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
  conversationMetadata?: Prisma.JsonValue
}): Promise<boolean> {
  const { policy, scenarioHandled, text } = args

  // Master toggle off → never.
  if (!policy.aiEnabled) return false

  // Automation-only channels never invoke the AI.
  if (policy.replyPolicy === 'AUTOMATION_ONLY') return false

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
  if (policy.replyPolicy === 'AGENT_EXCEPT_SCENARIOS' && scenarioHandled) {
    return false
  }
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
  const row = await prisma.agentCatalog.findFirst({
    where: { agentId, productId },
    select: {
      product: {
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          images: true,
        },
      },
    },
  })
  if (!row) return null
  const p = row.product
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    price: p.price,
    imageUrl: p.images?.[0] ?? null,
    productUrl: null,
  }
}
