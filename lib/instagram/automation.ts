import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { InboundMessage, MessengerAdapter } from '@/lib/channels/types'
import type { ChatAgent } from '@/lib/ai/chat-engine'
import { generateReply } from '@/lib/ai/chat-engine'
import { captureError } from '@/lib/errors/capture'

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
  replyMode?: 'STATIC' | 'AI' | 'FLOW'
  replyText?: string
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
    replyMode:
      o.replyMode === 'AI' || o.replyMode === 'FLOW' ? o.replyMode : 'STATIC',
    replyText: typeof o.replyText === 'string' ? o.replyText : '',
    dmOnComment: o.dmOnComment === true,
    followGate: o.followGate === true,
    gateMode: o.gateMode === 'STORY_MENTION' ? 'STORY_MENTION' : 'SOFT',
    gatePrompt: typeof o.gatePrompt === 'string' ? o.gatePrompt : '',
    gateConfirmKeyword:
      typeof o.gateConfirmKeyword === 'string' ? o.gateConfirmKeyword : '',
    gateQuickReply: typeof o.gateQuickReply === 'string' ? o.gateQuickReply : '',
    contentText: typeof o.contentText === 'string' ? o.contentText : '',
    aiAgentEnabled: o.aiAgentEnabled === true,
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
  const { adapter, msg, agent, contactId, contactName, quickReplies } = ctx
  const isComment = msg.kind === 'COMMENT'

  // ─── Follow-gate: send the gate prompt + create a pending gate ───
  if (action.followGate && action.gatePrompt) {
    const qr = action.gateQuickReply
      ? [action.gateQuickReply]
      : quickReplies
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

  // ─── STATIC reply ───
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
