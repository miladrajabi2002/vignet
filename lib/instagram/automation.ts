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
        sendButtonMessage,
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
   * `messages[]` is used by STATIC (sent in order) and MULTI_MESSAGE (one
   * picked at random). Each entry is a typed payload that the media helpers
   * know how to send (TEXT/IMAGE/AUDIO/VIDEO/QUICK_REPLY/PRODUCT).
   */
  messages?: Array<{
    type: 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'QUICK_REPLY' | 'PRODUCT'
    text?: string
    mediaUrl?: string
    productId?: string
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
          .map((m) => {
            const type = (
              m.type === 'IMAGE' ||
              m.type === 'AUDIO' ||
              m.type === 'VIDEO' ||
              m.type === 'QUICK_REPLY' ||
              m.type === 'PRODUCT'
                ? m.type
                : 'TEXT'
            ) as 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'QUICK_REPLY' | 'PRODUCT'
            const entry: {
              type: 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'QUICK_REPLY' | 'PRODUCT'
              text?: string
              mediaUrl?: string
              productId?: string
              buttons?: Array<{ title: string; url?: string } | string>
            } = {
              type,
              text: typeof m.text === 'string' ? m.text : undefined,
              mediaUrl: typeof m.mediaUrl === 'string' ? m.mediaUrl : undefined,
              productId: typeof m.productId === 'string' ? m.productId : undefined,
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
    const target = isComment && action.dmOnComment ? msg.senderId : msg.chatId

    // ── STEP 1: Check if the user already follows the account ──
    if (channelConfig) {
      const alreadyFollows = await checkUserFollows(channelConfig, msg.senderId)
      if (alreadyFollows === true) {
        // User already follows → skip the gate, deliver content directly.
        console.log(`[ig-gate] user ${msg.senderId} ALREADY follows — skipping gate, delivering content`)
        if (contentMessages.length > 0 && channelConfig) {
          for (const entry of contentMessages) {
            try {
              const entryType = typeof entry.type === 'string' ? entry.type : 'TEXT'
              const entryText = typeof entry.text === 'string' ? entry.text : ''
              const entryMediaUrl = typeof entry.mediaUrl === 'string' ? entry.mediaUrl : ''
              const entryButtons = Array.isArray(entry.buttons) ? entry.buttons : []

              if (entryType === 'IMAGE' && entryMediaUrl) {
                await sendImage(channelConfig, target, entryMediaUrl, entryText || undefined)
              } else if (entryType === 'AUDIO' && entryMediaUrl) {
                await sendAudio(channelConfig, target, entryMediaUrl)
              } else if (entryType === 'VIDEO' && entryMediaUrl) {
                await sendVideo(channelConfig, target, entryMediaUrl)
              } else if (entryType === 'QUICK_REPLY' && entryButtons.length > 0) {
                const buttonActions: ButtonAction[] = entryButtons.slice(0, 3).map((b) =>
                  typeof b === 'string'
                    ? { title: b }
                    : { title: (b as { title?: string }).title ?? '', url: (b as { url?: string }).url },
                )
                if (entry.buttonType === 'quick_reply') {
                  await adapter.sendText(target, entryText, {
                    quickReplies: buttonActions.map((b) => b.title),
                  })
                } else {
                  await sendButtonMessage(channelConfig, target, entryText, buttonActions)
                }
              } else if (entryText) {
                await adapter.sendText(target, entryText, { quickReplies: undefined })
              }
            } catch (e) {
              captureError('instagram:gate:direct-deliver', e, {
                workspaceId: agent.workspaceId,
                metadata: { entryType: entry.type },
              })
            }
          }
        }
        return // Gate skipped — content delivered, done.
      }
      // follows === false → send gate prompt (below)
      // follows === null → API failed, send gate prompt as safety net
    }

    // ── STEP 2: User does NOT follow (or check failed) → send gate prompt ──
    if (isComment) {
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

    await prisma.instagramFollowGate.create({
      data: {
        automationId: row.id,
        agentId: agent.id,
        contactId: contactId ?? null,
        igSenderId: msg.senderId,
        chatId: msg.senderId,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + GATE_TTL_MS),
        payload: {
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

  // ─── STATIC rich reply: send the ordered messages[] sequence ───
  // When the operator builds a sequence of messages (text, image, voice,
  // video, quick-reply buttons, product card) in the form, we send them all
  // in order here. This is the fix for "multi-message doesn't work for
  // DM/STORY STATIC" — previously only `replyText` was sent and `messages[]`
  // was silently ignored.
  if (action.replyMode === 'STATIC' && action.messages?.length && channelConfig) {
    const target = isComment && action.dmOnComment ? msg.senderId : msg.chatId
    for (const entry of action.messages) {
      // QUICK_REPLY entries carry `buttons`. The `buttonType` field controls
      // how they're rendered:
      //   'button' (default) → Button Template (inside the bubble)
      //   'quick_reply'      → Quick Reply chips (above the input)
      if (entry.type === 'QUICK_REPLY' && entry.buttons?.length) {
        const buttonActions: ButtonAction[] = entry.buttons.slice(0, 3).map((b) =>
          typeof b === 'string'
            ? { title: b }
            : { title: b.title, url: b.url },
        )
        try {
          if (entry.buttonType === 'quick_reply') {
            // Quick Reply chips — sent as quick_replies with the text message.
            await adapter.sendText(target, entry.text || '', {
              quickReplies: buttonActions.map((b) => b.title),
            })
          } else {
            // Button Template — inside the bubble (default).
            await sendButtonMessage(channelConfig, target, entry.text || '', buttonActions)
          }
        } catch (e) {
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
    }
    // For comment→DM funnels, also leave a public ack on the comment.
    if (isComment && action.dmOnComment && action.replyText) {
      await adapter.sendText(msg.chatId, action.replyText).catch(() => undefined)
    }

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
    // Per-scenario follow-up applies to single-media STATIC replies too —
    // previously this branch skipped it, so media scenarios couldn't nudge.
    scheduleFollowUp(ctx, action, target)
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
  setTimeout(() => {
    adapter
      .sendText(target, action.followUpMessage!, {
        quickReplies: undefined,
      })
      .catch((e) =>
        console.error('[instagram] follow-up send failed:', e),
      )
    void prisma.conversation
      .updateMany({
        where: { agentId: agent.id, externalId: target },
        data: { lastMessageAt: new Date() },
      })
      .catch(() => undefined)
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
 * The request must go to graph.facebook.com (NOT graph.instagram.com) and
 * queries the SENDER's node directly, NOT the business account's /accounts edge.
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
    const res = await fetch(url)
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
    const follows = json.is_user_follow_business === true
    console.log(
      `[ig-gate] follow check result: is_user_follow_business=${json.is_user_follow_business} → follows=${follows}`,
    )
    return follows
  } catch (e) {
    console.warn(`[ig-gate] follow check error: ${(e as Error).message}`)
    return null
  }
}

/** Try to fulfill a pending SOFT follow-gate when the user sends the confirm keyword. */
async function tryFulfillFollowGate(
  ctx: AutomationContext,
): Promise<boolean> {
  const { adapter, msg, agent, quickReplies, channelConfig } = ctx
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

  if (!confirmKw || text !== confirmKw.trim().toLowerCase()) return false

  // ── VERIFY the user actually follows the account ──
  // Before fulfilling the gate, check if the user is really a follower.
  // If they're NOT following, re-send the gate prompt (don't deliver content).
  if (channelConfig) {
    const follows = await checkUserFollows(channelConfig, msg.senderId)
    if (follows === false) {
      console.log(`[ig-gate] user ${msg.senderId} clicked "${text}" but does NOT follow — re-sending gate prompt`)
      const gatePrompt = typeof payload.gatePrompt === 'string'
        ? payload.gatePrompt
        : 'لطفاً ابتدا صفحه ما را دنبال کنید و سپس دوباره روی دکمه کلیک کنید.'
      const gateQuickReply = typeof payload.gateQuickReply === 'string'
        ? payload.gateQuickReply
        : 'دنبال کردم'
      const gateButtonType = typeof payload.gateButtonType === 'string'
        ? payload.gateButtonType
        : 'button'
      try {
        if (gateButtonType === 'quick_reply') {
          await adapter.sendText(gate.chatId, gatePrompt, {
            quickReplies: [gateQuickReply],
          })
        } else if (channelConfig) {
          await sendButtonMessage(channelConfig, gate.chatId, gatePrompt, [
            { title: gateQuickReply },
          ])
        } else {
          await adapter.sendText(gate.chatId, gatePrompt, {
            quickReplies: [gateQuickReply],
          })
        }
      } catch {
        await adapter.sendText(gate.chatId, gatePrompt, {
          quickReplies: [gateQuickReply],
        })
      }
      return true // gate handled (but not fulfilled) — don't fall through to AI
    }
  }

  // User follows (or check failed = treat as following) → fulfill the gate.
  await prisma.instagramFollowGate.update({
    where: { id: gate.id },
    data: { status: 'FULFILLED', fulfilledAt: new Date() },
  })

  // Deliver the gated content — the FULL messages[] array.
  const contentMessages = Array.isArray(payload.contentMessages)
    ? (payload.contentMessages as Array<Record<string, unknown>>)
    : []

  if (contentMessages.length > 0 && channelConfig) {
    for (const entry of contentMessages) {
      try {
        const entryType = typeof entry.type === 'string' ? entry.type : 'TEXT'
        const entryText = typeof entry.text === 'string' ? entry.text : ''
        const entryMediaUrl = typeof entry.mediaUrl === 'string' ? entry.mediaUrl : ''
        const entryButtons = Array.isArray(entry.buttons) ? entry.buttons : []

        if (entryType === 'IMAGE' && entryMediaUrl) {
          await sendImage(channelConfig, gate.chatId, entryMediaUrl, entryText || undefined)
        } else if (entryType === 'AUDIO' && entryMediaUrl) {
          await sendAudio(channelConfig, gate.chatId, entryMediaUrl)
        } else if (entryType === 'VIDEO' && entryMediaUrl) {
          await sendVideo(channelConfig, gate.chatId, entryMediaUrl)
        } else if (entryType === 'QUICK_REPLY' && entryButtons.length > 0) {
          const buttonActions: ButtonAction[] = entryButtons.slice(0, 3).map((b) =>
            typeof b === 'string'
              ? { title: b }
              : { title: (b as { title?: string }).title ?? '', url: (b as { url?: string }).url },
          )
          await sendButtonMessage(channelConfig, gate.chatId, entryText, buttonActions)
        } else if (entryText) {
          await adapter.sendText(gate.chatId, entryText, { quickReplies })
        }
      } catch (e) {
        captureError('instagram:gate:deliver', e, {
          workspaceId: agent.workspaceId,
          metadata: { gateId: gate.id, entryType: entry.type },
        })
      }
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
  conversationStatus?: string
}): Promise<boolean> {
  const { policy, scenarioHandled, text } = args

  // Master toggle off → never.
  if (!policy.aiEnabled) return false

  // Automation-only channels never invoke the AI.
  if (policy.replyPolicy === 'AUTOMATION_ONLY') return false

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
  if (policy.replyPolicy === 'AGENT_EXCEPT_SCENARIOS' && scenarioHandled) {
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
