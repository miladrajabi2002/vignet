/**
 * Back-in-stock alerts — DB half: remember offers, register requests, and
 * the worker sweep that delivers the «دوباره موجود شد» message.
 */
import { Prisma, type ChannelType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { readBotToken } from '@/lib/channels/config'
import { readPageToken } from '@/lib/instagram/config'
import { getAdapter, isMessengerType } from '@/lib/channels/registry'
import { sendProductCarousel } from '@/lib/instagram/media'
import { resolveProductShowcases, formatProductFallback } from '@/lib/products/presentation'
import { notifyWorkspace } from '@/lib/notifications/create'
import { captureError } from '@/lib/errors/capture'
import { detectTurnLanguage } from '@/lib/ai/turn-language'
import type { CatalogProduct } from '@/lib/ai/rag'
import { extractTypedVariations } from '@/lib/products/description'
import { variationLabel } from '@/lib/products/presentation'
import {
  composeRestockAlreadyAvailable,
  composeRestockAskPhone,
  composeRestockConfirmed,
  composeRestockNotice,
  composeRestockWhichProduct,
  detectRestockRequest,
  isItemAvailable,
  restockDedupeKey,
  restockMode,
  type RestockItem,
  type RestockLang,
} from '@/lib/commerce/restock'
import { heldByOthers, heldExcept, liveHoldsFor, withHeldStock } from '@/lib/commerce/cart-hold'

/** An offer the agent made is honoured for this long. */
const OFFER_TTL_MS = 3 * 24 * 60 * 60 * 1000
/** Alerts nobody could be notified about expire after this. */
export const RESTOCK_ALERT_TTL_MS = 90 * 24 * 60 * 60 * 1000
const SENDING_STALE_MS = 30 * 60 * 1000

interface StoredOffer {
  items: RestockItem[]
  at: string
  awaitingPhone?: boolean
}

function readOffer(metadata: Prisma.JsonValue | null | undefined): StoredOffer | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const raw = (metadata as Record<string, unknown>).restockOffer
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const offer = raw as Record<string, unknown>
  const at = typeof offer.at === 'string' ? Date.parse(offer.at) : NaN
  if (!Number.isFinite(at) || Date.now() - at > OFFER_TTL_MS || !Array.isArray(offer.items)) return null
  const items = offer.items.flatMap((item): RestockItem[] => {
    if (!item || typeof item !== 'object') return []
    const row = item as Record<string, unknown>
    if (typeof row.productId !== 'string' || typeof row.name !== 'string') return []
    return [{
      productId: row.productId,
      variationId: typeof row.variationId === 'number' ? row.variationId : null,
      name: row.name,
      variant: typeof row.variant === 'string' ? row.variant : null,
    }]
  })
  return items.length ? { items, at: offer.at as string, awaitingPhone: offer.awaitingPhone === true } : null
}

/**
 * Remember which sold-out items the agent just offered to watch, so a later
 * «آره خبرم کن» resolves to exactly those items. Atomic jsonb merge: other
 * conversation flags (aiPaused, orderIssueBudget…) are never overwritten.
 */
export async function rememberRestockOffer(conversationId: string, items: RestockItem[], awaitingPhone = false): Promise<void> {
  if (!items.length) return
  const offer = { items: items.slice(0, 3), at: new Date().toISOString(), ...(awaitingPhone ? { awaitingPhone: true } : {}) }
  await prisma.$executeRaw`
    UPDATE "Conversation"
    SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('restockOffer', ${JSON.stringify(offer)}::jsonb)
    WHERE id = ${conversationId}`
}

async function clearRestockOffer(conversationId: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "Conversation" SET metadata = metadata - 'restockOffer'
    WHERE id = ${conversationId} AND metadata IS NOT NULL`
}

/** Sold-out rows of this turn as offerable items (max 3). */
export function unavailableItemsFromCatalog(products: CatalogProduct[]): RestockItem[] {
  return products
    .filter((product) => product.unavailable || product.stock === 0)
    .slice(0, 3)
    .map((product) => {
      const [id, suffix] = product.id.split('#')
      const variationId = suffix && /^v?\d+$/i.test(suffix) ? Number(suffix.replace(/^v/i, '')) : null
      return { productId: id, variationId, name: product.name, variant: null }
    })
}

export type RestockTurnOutcome =
  | { kind: 'none' }
  | { kind: 'reply'; text: string }

export async function resolveRestockTurn(params: {
  enabled: boolean
  workspaceId: string
  agentId: string
  conversationId: string
  contactId: string | null
  contactPhone: string | null
  channel: ChannelType
  message: string
  lang: RestockLang
  lastAssistantText: string | null
  /** Sold-out rows found by this turn's catalog search. */
  catalogProducts: CatalogProduct[]
  /** The conversation's grounded product entity. */
  activeEntityId: string | null
  /** agent.cartHoldEnabled: units other chats hold count as taken. */
  cartHold?: boolean
  /**
   * The turn-understanding reading (explicit request / yes to the offer /
   * nothing). Undefined = the legacy regex detector decides.
   */
  requestOverride?: 'explicit' | 'accept' | null
}): Promise<RestockTurnOutcome> {
  if (!params.enabled) return { kind: 'none' }
  const conversation = await prisma.conversation.findUnique({
    where: { id: params.conversationId },
    select: { metadata: true },
  })
  const offer = readOffer(conversation?.metadata)
  const request = params.requestOverride !== undefined
    ? params.requestOverride
    : detectRestockRequest(params.message, params.lastAssistantText)
  const phoneJustGiven = Boolean(offer?.awaitingPhone && params.contactPhone)
  if (!request && !phoneJustGiven) return { kind: 'none' }
  const mode = restockMode(params.channel, Boolean(params.contactPhone))
  if (!mode) return { kind: 'none' }

  // Which items? This turn's sold-out rows (the customer named them now),
  // then the remembered offer, then the conversation's current product.
  let items = unavailableItemsFromCatalog(params.catalogProducts.filter((product) => product.fullTermMatch || product.unavailable))
  if (!items.length && offer) items = offer.items
  if (!items.length && params.activeEntityId) {
    const [id, suffix] = params.activeEntityId.split('#')
    const product = await prisma.product.findFirst({
      where: { id, catalogItems: { some: { agentId: params.agentId } } },
      select: { id: true, name: true },
    })
    if (product) items = [{ productId: product.id, variationId: suffix ? Number(suffix.replace(/^v/i, '')) || null : null, name: product.name, variant: null }]
  }
  if (!items.length) return { kind: 'reply', text: composeRestockWhichProduct(params.lang) }

  // Never register an alert for something that is already available.
  const rows = await prisma.product.findMany({
    where: { id: { in: items.map((item) => item.productId) }, catalogItems: { some: { agentId: params.agentId } } },
    select: { id: true, name: true, active: true, stock: true, attributes: true },
  })
  const held = params.cartHold ? await heldByOthers(params.workspaceId, params.conversationId) : null
  const byId = new Map(rows.map((row) => [row.id, held ? withHeldStock(row, held) : row]))
  const resolved = items.flatMap((item) => {
    const row = byId.get(item.productId)
    if (!row) return []
    const variation = item.variationId != null
      ? extractTypedVariations(row.attributes).find((candidate) => candidate.id === item.variationId)
      : null
    return [{ ...item, name: row.name, variant: item.variant ?? (variation ? variationLabel(variation) : null), available: isItemAvailable(row, item.variationId) }]
  })
  const soldOut = resolved.filter((item) => !item.available)
  if (!soldOut.length && resolved.length) {
    return { kind: 'reply', text: composeRestockAlreadyAvailable(resolved, params.lang) }
  }
  if (!soldOut.length) return { kind: 'reply', text: composeRestockWhichProduct(params.lang) }

  if (mode === 'needs_phone') {
    await rememberRestockOffer(params.conversationId, soldOut, true)
    return { kind: 'reply', text: composeRestockAskPhone(params.lang) }
  }

  for (const item of soldOut) {
    const dedupeKey = restockDedupeKey(params.conversationId, item)
    await prisma.restockAlert.upsert({
      where: { dedupeKey },
      create: {
        workspaceId: params.workspaceId,
        agentId: params.agentId,
        conversationId: params.conversationId,
        contactId: params.contactId,
        channel: params.channel,
        productId: item.productId,
        variationId: item.variationId,
        productName: item.name,
        variantLabel: item.variant,
        dedupeKey,
      },
      // A repeated request re-arms an old alert (e.g. notified, sold out again).
      update: { status: 'ACTIVE', lastError: null, notifiedAt: null, contactId: params.contactId ?? undefined },
    })
  }
  await clearRestockOffer(params.conversationId).catch(() => {})
  return { kind: 'reply', text: composeRestockConfirmed(soldOut, mode, params.lang) }
}

// ─── Worker sweep ───────────────────────────────────────────────────────────

export interface RestockSweepStats {
  checked: number
  notified: number
  followUp: number
  expired: number
  failed: number
}

type AlertRow = Prisma.RestockAlertGetPayload<{
  include: {
    product: { select: { id: true; name: true; active: true; stock: true; attributes: true; deletedAt: true } }
    conversation: { select: { id: true; externalId: true; agentId: true; contact: { select: { name: true; phone: true } } } }
    agent: { select: { orderCaptureEnabled: true; language: true } }
  }
}>

async function deliverToConversation(alerts: AlertRow[]): Promise<{ status: 'sent' | 'follow_up' | 'retry'; error?: string }> {
  const first = alerts[0]
  const conversation = first.conversation
  const items: RestockItem[] = alerts.map((alert) => ({
    productId: alert.productId,
    variationId: alert.variationId,
    name: alert.productName,
    variant: alert.variantLabel,
  }))
  const lastUser = await prisma.message.findFirst({
    where: { conversationId: conversation.id, role: 'USER' },
    orderBy: { createdAt: 'desc' },
    select: { content: true },
  })
  const lang: RestockLang = lastUser?.content && detectTurnLanguage(lastUser.content) === 'en' ? 'en' : 'fa'
  const text = composeRestockNotice({
    items,
    customerName: conversation.contact?.name ?? null,
    orderCapture: first.agent.orderCaptureEnabled,
    lang,
  })
  const markers = alerts.map((alert) => `[[product:${JSON.stringify({ id: alert.variationId != null ? `${alert.productId}#v${alert.variationId}` : alert.productId, name: alert.productName })}]]`)

  // The notice is part of the conversation history on every channel.
  const persist = async () => {
    await prisma.$transaction([
      prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: 'ASSISTANT',
          content: [text, ...markers].join('\n'),
          metadata: { restockNotice: true, alertIds: alerts.map((alert) => alert.id) },
        },
      }),
      prisma.conversation.update({
        where: { id: conversation.id },
        data: { messageCount: { increment: 1 }, lastMessageAt: new Date() },
      }),
    ])
  }

  const channel = first.channel
  if (!isMessengerType(channel)) {
    // Web visitors have no push channel: the store team calls the number.
    await persist()
    return { status: 'follow_up', error: 'NO_PUSH_CHANNEL' }
  }
  if (!conversation.externalId) return { status: 'follow_up', error: 'MISSING_THREAD' }
  const agentChannel = await prisma.agentChannel.findFirst({
    where: { agentId: conversation.agentId, type: channel, active: true },
    select: { config: true },
  })
  if (!agentChannel) return { status: 'follow_up', error: 'CHANNEL_INACTIVE' }
  const token = channel === 'INSTAGRAM' ? readPageToken(agentChannel.config) : readBotToken(agentChannel.config)
  if (!token) return { status: 'follow_up', error: 'CREDENTIALS_MISSING' }

  const showcases = await resolveProductShowcases({
    workspaceId: first.workspaceId,
    agentId: conversation.agentId,
    directives: alerts.map((alert) => ({
      id: alert.variationId != null ? `${alert.productId}#v${alert.variationId}` : alert.productId,
      name: alert.productName,
    })),
  }).catch(() => [])
  try {
    const adapter = getAdapter(channel, token)
    await adapter.sendText(conversation.externalId, text)
    if (showcases.length) {
      try {
        if (channel === 'INSTAGRAM') {
          await sendProductCarousel(agentChannel.config, conversation.externalId, showcases)
        } else if (adapter.sendProductCard) {
          for (const product of showcases) {
            await adapter.sendProductCard(conversation.externalId, {
              name: product.name,
              description: product.description ?? null,
              price: product.price == null ? null : lang === 'en' ? product.price.toLocaleString('en-US') : `${product.price.toLocaleString('fa-IR')} تومان`,
              badge: lang === 'en' ? 'Available' : 'موجود',
              specs: product.specs,
              imageUrl: product.imageUrl,
              productUrl: product.productUrl,
              ctaLabel: lang === 'en' ? 'View / Buy' : '🛒 مشاهده و خرید',
            })
          }
        } else {
          await adapter.sendText(conversation.externalId, formatProductFallback(showcases, lang))
        }
      } catch (cardError) {
        // The text already told them; a failed card is not worth a resend.
        captureError('restock:card', cardError, { workspaceId: first.workspaceId })
      }
    }
    await persist()
    return { status: 'sent' }
  } catch (error) {
    const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
    // A closed Instagram 24h window cannot be reopened by us: hand it to people.
    if (/Instagram24hWindow|24H_WINDOW|window/i.test(detail)) return { status: 'follow_up', error: 'INSTAGRAM_WINDOW_CLOSED' }
    return { status: 'retry', error: detail.slice(0, 300) }
  }
}

/**
 * Deliver every alert whose item is available again. One message per
 * conversation (several watched items are combined), claim-before-send so a
 * concurrent sweep never double-messages, and a per-product owner summary.
 */
export async function sweepRestockAlerts(limit = 300): Promise<RestockSweepStats> {
  const stats: RestockSweepStats = { checked: 0, notified: 0, followUp: 0, expired: 0, failed: 0 }
  const now = Date.now()
  // Heal claims left behind by a crashed sweep.
  await prisma.restockAlert.updateMany({
    where: { status: 'SENDING', updatedAt: { lt: new Date(now - SENDING_STALE_MS) } },
    data: { status: 'ACTIVE' },
  })
  const expired = await prisma.restockAlert.updateMany({
    where: { status: 'ACTIVE', createdAt: { lt: new Date(now - RESTOCK_ALERT_TTL_MS) } },
    data: { status: 'EXPIRED' },
  })
  stats.expired = expired.count

  const alerts: AlertRow[] = await prisma.restockAlert.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { createdAt: 'asc' },
    take: limit,
    include: {
      product: { select: { id: true, name: true, active: true, stock: true, attributes: true, deletedAt: true } },
      conversation: { select: { id: true, externalId: true, agentId: true, contact: { select: { name: true, phone: true } } } },
      agent: { select: { orderCaptureEnabled: true, language: true } },
    },
  })
  stats.checked = alerts.length
  // Units another chat holds (cart hold) are not back in stock yet.
  const holds = await liveHoldsFor(alerts.map((alert) => alert.workspaceId))
  const ready = alerts.filter((alert) => !alert.product.deletedAt
    && isItemAvailable(withHeldStock(alert.product, heldExcept(holds, alert.workspaceId, alert.conversationId)), alert.variationId))
  const byConversation = new Map<string, AlertRow[]>()
  for (const alert of ready) {
    const list = byConversation.get(alert.conversationId) ?? []
    list.push(alert)
    byConversation.set(alert.conversationId, list)
  }

  const perProduct = new Map<string, { workspaceId: string; name: string; notified: number; followUp: string[] }>()
  for (const group of byConversation.values()) {
    const ids = group.map((alert) => alert.id)
    const claimed = await prisma.restockAlert.updateMany({ where: { id: { in: ids }, status: 'ACTIVE' }, data: { status: 'SENDING' } })
    if (claimed.count !== ids.length) {
      await prisma.restockAlert.updateMany({ where: { id: { in: ids }, status: 'SENDING' }, data: { status: 'ACTIVE' } })
      continue
    }
    let result: Awaited<ReturnType<typeof deliverToConversation>>
    try {
      result = await deliverToConversation(group)
    } catch (error) {
      result = { status: 'retry', error: error instanceof Error ? error.message.slice(0, 300) : 'DELIVERY_FAILED' }
    }
    const status = result.status === 'sent' ? 'NOTIFIED' : result.status === 'follow_up' ? 'NEEDS_FOLLOW_UP' : 'ACTIVE'
    await prisma.restockAlert.updateMany({
      where: { id: { in: ids } },
      data: { status, lastError: result.error ?? null, ...(result.status === 'sent' ? { notifiedAt: new Date() } : {}) },
    })
    if (result.status === 'sent') stats.notified += ids.length
    else if (result.status === 'follow_up') stats.followUp += ids.length
    else stats.failed += ids.length
    if (result.status === 'retry') continue
    for (const alert of group) {
      const key = `${alert.workspaceId}:${alert.productId}`
      const entry = perProduct.get(key) ?? { workspaceId: alert.workspaceId, name: alert.productName, notified: 0, followUp: [] }
      if (result.status === 'sent') entry.notified += 1
      else entry.followUp.push(alert.conversation.contact?.phone ?? alert.conversation.contact?.name ?? alert.channel)
      perProduct.set(key, entry)
    }
  }

  for (const entry of perProduct.values()) {
    const parts: string[] = []
    if (entry.notified) parts.push(`به ${entry.notified.toLocaleString('fa-IR')} مشتری منتظر خودکار خبر داده شد.`)
    if (entry.followUp.length) parts.push(`${entry.followUp.length.toLocaleString('fa-IR')} نفر نیاز به پیگیری دستی دارند: ${entry.followUp.slice(0, 5).join('، ')}`)
    void notifyWorkspace({
      workspaceId: entry.workspaceId,
      type: 'SYSTEM',
      title: `«${entry.name}» دوباره موجود شد`,
      body: parts.join(' '),
      link: '/products/requests',
      operatorTelegram: entry.followUp.length > 0 ? 'orders' : false,
    }).catch(() => {})
  }
  return stats
}
