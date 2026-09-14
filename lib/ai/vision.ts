import { randomUUID } from 'node:crypto'
import { OPENROUTER_BASE, fetchWithProviderRetry, getPlatformOpenRouterKey } from '@/lib/ai/openrouter'
import { ensureVisionCreditAvailable, captureVisionCredit } from '@/lib/billing/vision-credits'
import { safeHttpGet } from '@/lib/security/safe-http'
import type { InboundMessage } from '@/lib/channels/types'

/**
 * Inbound image understanding (A14).
 *
 * Messenger channels deliver customer photos as attachments the text model
 * never sees. Historically a photo-only turn («اینو داری؟» + عکس) degraded to
 * the honest-but-useless media handoff. This module downloads the attached
 * image, asks the platform vision model for a concise product-oriented
 * description, and hands that description to the normal chat turn so the
 * sales agent can match it against the live catalog, quote prices and send
 * product cards/links — exactly like a text product question.
 *
 * The description is generated per image and billed like STT (fixed charge
 * per analysed image) so the feature can never silently drain the platform
 * account on empty wallets.
 */

export const PLATFORM_VISION_MODEL =
  process.env.OPENROUTER_VISION_MODEL?.trim() || 'google/gemini-3.1-flash-lite'

export const VISION_PRICE_PER_IMAGE_IRR = positiveEnv('AI_VISION_PRICE_PER_IMAGE_IRR', 800)

function positiveEnv(name: string, fallback: number): number {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value > 0 ? Math.round(value) : fallback
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const DOWNLOAD_TIMEOUT_MS = 20_000
const VISION_TIMEOUT_MS = 60_000
/** Descriptions longer than this are trimmed — they are context, not prose. */
const MAX_DESCRIPTION_CHARS = 700

/** Photo attachments the vision path can analyse (sticker/video/file stay on the media-handoff path). */
export function isInboundImage(msg: Pick<InboundMessage, 'hasMedia' | 'mediaKind'>): boolean {
  return Boolean(msg.hasMedia) && msg.mediaKind === 'photo'
}

/**
 * Resolve a downloadable URL for the attached photo: Instagram ships a
 * (short-lived) CDN URL; Telegram/Bale photos need a getFile round-trip.
 */
export async function resolveInboundImageUrl(
  msg: Pick<InboundMessage, 'mediaUrl' | 'mediaFileId'>,
  getVoiceUrl?: (fileId: string) => Promise<string | null>,
): Promise<string | null> {
  if (msg.mediaUrl) return msg.mediaUrl
  if (msg.mediaFileId && getVoiceUrl) {
    try {
      return (await getVoiceUrl(msg.mediaFileId)) ?? null
    } catch {
      return null
    }
  }
  return null
}

/** Download a remote image into a Buffer (Instagram CDN needs the browser UA — see safe-http). */
export async function downloadImage(
  url: string,
): Promise<{ image: Buffer; mime: string } | null> {
  try {
    const res = await safeHttpGet(url, {
      timeoutMs: DOWNLOAD_TIMEOUT_MS,
      maxBytes: MAX_IMAGE_BYTES,
      maxRedirects: 3,
      allowedContentTypes: ['image/'],
    })
    if (res.status < 200 || res.status >= 300) return null
    if (!res.body.length) return null
    const mime = String(res.headers['content-type'] ?? 'image/jpeg').split(';')[0].trim() || 'image/jpeg'
    return { image: res.body, mime }
  } catch (e) {
    console.error('[vision] downloadImage failed:', e)
    return null
  }
}

export interface DescribeImageInput {
  image: Buffer
  mime: string
  /** Description language — the agent's language keeps the context readable for the main model. */
  language?: string
  workspaceId: string
  agentId?: string
  idempotencyKey?: string
}

export type DescribeImageResult =
  | { status: 'ok'; description: string }
  | { status: 'no_credit' }
  | { status: 'failed' }

const FA_PROMPT = `این تصویری است که مشتری در گفتگوی فروش فرستاده است. محتوایش را دقیق و فشرده توصیف کن تا دستیار فروش بتواند آن را با کاتالوگ محصولات مقایسه کند. فقط این موارد را در چند خط بنویس:
- نوع محصول/شیء اصلی (مثلاً: کفش، ساعت، روسری، شلوار، تیشرت…)
- مشخصات ظاهری کلیدی: رنگ اصلی و رنگ‌های دیگر، طرح/نگار، جنس قابل تشخیص، مدل یا استایل
- هر متن، برند، لوگو یا عدد قابل مشاهده در تصویر (مثل نام برند یا کد محصول)
- اگر انسان در تصویر است، کالایی که نشان می‌دهد یا می‌پوشد را توصیف کن
حدس نزن و چیزی که در تصویر نیست را اضافه نکن. پاسخ فقط توصیف باشد.`

const EN_PROMPT = `This is an image a customer sent in a sales conversation. Describe it precisely and compactly so the sales assistant can match it against the product catalog. In a few lines, cover only:
- the main product/object type (e.g. shoes, watch, scarf, pants, t-shirt…)
- key visual attributes: main and secondary colors, pattern/print, recognizable material, style
- any visible text, brand, logo or numbers (brand name, product code)
- if a person is shown, describe the item they are wearing or holding
Do not guess and do not add anything not visible. Answer with the description only.`

/**
 * Describe one downloaded image with the platform vision model. Returns a
 * status instead of throwing so the channel handler can degrade gracefully:
 * no_credit → quota reply, failed → the honest media handoff.
 */
export async function describeImage(input: DescribeImageInput): Promise<DescribeImageResult> {
  const idempotencyKey = input.idempotencyKey ?? `vision:${randomUUID()}`
  const key = getPlatformOpenRouterKey()
  if (!key) return { status: 'failed' }
  try {
    await ensureVisionCreditAvailable(input.workspaceId, idempotencyKey)
  } catch (e) {
    if (e instanceof Error && e.message === 'NO_CREDIT') return { status: 'no_credit' }
    throw e
  }

  const isFa = (input.language ?? 'fa').toLowerCase().startsWith('fa')
  const dataUrl = `data:${input.mime};base64,${input.image.toString('base64')}`

  let json: Record<string, unknown>
  try {
    json = await fetchWithProviderRetry<Record<string, unknown>>(
      `${OPENROUTER_BASE}/chat/completions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'https://vigent.ir',
          'X-Title': 'Vigent',
        },
        body: JSON.stringify({
          model: PLATFORM_VISION_MODEL,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: isFa ? FA_PROMPT : EN_PROMPT },
                { type: 'image_url', image_url: { url: dataUrl } },
              ],
            },
          ],
          temperature: 0.1,
          max_tokens: 400,
          reasoning: { enabled: false },
          provider: { data_collection: 'deny', allow_fallbacks: true },
        }),
      },
      {
        timeoutMs: VISION_TIMEOUT_MS,
        parse: async (res) => {
          if (!res.ok) throw new Error(`OPENROUTER_VISION_${res.status}`)
          return (await res.json()) as Record<string, unknown>
        },
      },
    )
  } catch (e) {
    console.error('[vision] describeImage request failed:', e)
    return { status: 'failed' }
  }

  const choice = Array.isArray(json.choices) && json.choices[0] && typeof json.choices[0] === 'object'
    ? (json.choices[0] as Record<string, unknown>)
    : {}
  const message = choice.message && typeof choice.message === 'object'
    ? (choice.message as Record<string, unknown>)
    : {}
  const content = typeof message.content === 'string' ? message.content.trim() : ''
  if (!content) return { status: 'failed' }

  const usage = (json.usage && typeof json.usage === 'object' ? json.usage : {}) as Record<string, unknown>
  const rawCost = Number(usage.cost)
  try {
    await captureVisionCredit({
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      model: PLATFORM_VISION_MODEL,
      pricePerImageIRR: VISION_PRICE_PER_IMAGE_IRR,
      providerRequestId: typeof json.id === 'string' ? json.id : null,
      providerCostUSD: Number.isFinite(rawCost) ? rawCost : null,
      promptTokens: Number(usage.prompt_tokens) || 0,
      completionTokens: Number(usage.completion_tokens) || 0,
      idempotencyKey,
    })
  } catch (e) {
    // The description is already in hand; a capture hiccup (e.g. credit ran
    // dry between the check and the debit) must not waste the customer's
    // turn — the reply credit gate still protects the wallet downstream.
    console.error('[vision] captureVisionCredit failed:', e)
  }

  return { status: 'ok', description: content.slice(0, MAX_DESCRIPTION_CHARS) }
}

/** Label prefix that marks the description as trusted channel context inside the user message. */
export function imageDescriptionContext(description: string): string {
  return `[محتوای تصویر ارسالی مشتری — توصیف معتبر بینایی ماشین]\n${description}`
}

export function imageDescriptionContextEn(description: string): string {
  return `[Customer-sent image content — trusted machine-vision description]\n${description}`
}

export type InboundImageUnderstanding =
  | { kind: 'described'; label: string }
  | { kind: 'no_credit' }
  | { kind: 'skipped' }
  | { kind: 'failed' }

/**
 * Full inbound-photo pipeline used by the shared channel handler: resolve the
 * attachment URL (Instagram CDN URL or Telegram getFile), download it, and
 * describe it with the platform vision model. Never throws — the caller
 * degrades to the existing media handoff when this fails.
 */
export async function understandInboundImage(params: {
  msg: InboundMessage
  language?: string
  workspaceId: string
  agentId: string
  getVoiceUrl?: (fileId: string) => Promise<string | null>
  idempotencyKey: string
}): Promise<InboundImageUnderstanding> {
  if (!isInboundImage(params.msg)) return { kind: 'skipped' }
  const url = await resolveInboundImageUrl(params.msg, params.getVoiceUrl)
  if (!url) return { kind: 'failed' }
  const dl = await downloadImage(url)
  if (!dl) return { kind: 'failed' }
  const result = await describeImage({
    image: dl.image,
    mime: dl.mime,
    language: params.language,
    workspaceId: params.workspaceId,
    agentId: params.agentId,
    idempotencyKey: `vision:inbound:${params.idempotencyKey}`,
  })
  if (result.status === 'no_credit') return { kind: 'no_credit' }
  if (result.status === 'failed') return { kind: 'failed' }
  const isFa = (params.language ?? 'fa').toLowerCase().startsWith('fa')
  const label = isFa
    ? imageDescriptionContext(result.description)
    : imageDescriptionContextEn(result.description)
  return { kind: 'described', label }
}
