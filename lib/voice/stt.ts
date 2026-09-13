import { randomUUID } from 'node:crypto'
import { OPENROUTER_BASE, getPlatformOpenRouterKey } from '@/lib/ai/openrouter'
import { captureSttCredit, ensureSttCreditAvailable } from '@/lib/billing/stt-credits'
import { getPlatformCommercialConfig, PLATFORM_STT_MODEL } from '@/lib/platform/commercial-config'
import { safeHttpGet } from '@/lib/security/safe-http'

/** Multilingual speech-to-text through the platform OpenRouter account. */

function audioFormat(input: TranscribeInput): string {
  const mime = input.mime.toLowerCase()
  if (mime.includes('wav')) return 'wav'
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3'
  if (mime.includes('mp4') || mime.includes('m4a')) return 'mp4'
  if (mime.includes('flac')) return 'flac'
  if (mime.includes('ogg')) return 'ogg'
  if (mime.includes('aac')) return 'aac'
  return 'webm'
}

export interface TranscribeInput {
  audio: Buffer
  mime: string
  filename?: string
  workspaceId: string
  agentId?: string
  conversationId?: string | null
  idempotencyKey?: string
  language?: string
}

export async function transcribeAudio(
  input: TranscribeInput,
): Promise<string> {
  const runtime = await getPlatformCommercialConfig()
  const idempotencyKey = input.idempotencyKey ?? `stt:${randomUUID()}`
  await ensureSttCreditAvailable(input.workspaceId, idempotencyKey)
  const key = getPlatformOpenRouterKey()
  if (!key) throw new Error('PLATFORM_AI_NOT_CONFIGURED')

  const res = await fetch(`${OPENROUTER_BASE}/audio/transcriptions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'https://vigent.ir',
      'X-Title': 'Vigent',
    },
    body: JSON.stringify({
      model: PLATFORM_STT_MODEL,
      input_audio: {
        data: input.audio.toString('base64'),
        format: audioFormat(input),
      },
      ...(input.language ? { language: input.language } : {}),
      provider: {
        data_collection: 'deny',
        zdr: runtime.zeroDataRetention,
      },
    }),
    signal: AbortSignal.timeout(90_000),
  })
  if (!res.ok) {
    throw new Error(`OPENROUTER_STT_${res.status}`)
  }
  const json = (await res.json()) as {
    id?: string
    text?: string
    usage?: {
      cost?: number
      input_tokens?: number
      output_tokens?: number
      seconds?: number
    }
  }

  const rawCost = Number(json.usage?.cost)
  const audioSeconds = Number(json.usage?.seconds)
  const generationId = res.headers.get('x-generation-id') || json.id || null
  await captureSttCredit({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    conversationId: input.conversationId,
    model: PLATFORM_STT_MODEL,
    audioSeconds,
    pricePerMinuteIRR: runtime.sttPricePerMinuteIRR,
    providerRequestId: generationId,
    providerCostUSD: Number.isFinite(rawCost) ? rawCost : null,
    promptTokens: Number(json.usage?.input_tokens) || 0,
    completionTokens: Number(json.usage?.output_tokens) || 0,
    idempotencyKey,
  })

  return (json.text ?? '').trim()
}

/** Download a remote audio file (e.g. a Telegram voice note) into a Buffer. */
export async function downloadAudio(
  url: string,
): Promise<{ audio: Buffer; mime: string } | null> {
  try {
    const res = await safeHttpGet(url, {
      timeoutMs: 20_000,
      maxBytes: 25 * 1024 * 1024,
      maxRedirects: 2,
      allowedContentTypes: ['audio/', 'application/octet-stream'],
    })
    if (res.status < 200 || res.status >= 300) return null
    const mime = String(res.headers['content-type'] ?? 'audio/ogg')
    return { audio: res.body, mime }
  } catch (e) {
    console.error('[stt] downloadAudio failed:', e)
    return null
  }
}
