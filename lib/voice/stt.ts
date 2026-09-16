import { randomUUID } from 'node:crypto'
import { OPENROUTER_BASE, getPlatformOpenRouterKey } from '@/lib/ai/openrouter'
import { captureSttCredit, ensureSttCreditAvailable } from '@/lib/billing/stt-credits'
import { getPlatformCommercialConfig, PLATFORM_STT_MODEL } from '@/lib/platform/commercial-config'
import { safeHttpGet } from '@/lib/security/safe-http'
import { normalizeAudioForTranscription } from '@/lib/voice/audio-normalize'

/** Multilingual speech-to-text through the platform OpenRouter account. */

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
  const normalized = await normalizeAudioForTranscription(input.audio)

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
        data: normalized.audio.toString('base64'),
        format: normalized.format,
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
    const detail = (await res.text().catch(() => '')).trim().slice(0, 1_000)
    throw new Error(`OPENROUTER_STT_${res.status}`, {
      cause: detail || 'OpenRouter returned an empty error response',
    })
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
      // Instagram voice notes are commonly delivered as an m4a track inside a
      // video/mp4 container. The transcription path normalizes unsupported
      // containers before sending them to the pinned STT model.
      allowedContentTypes: ['audio/', 'application/octet-stream', 'video/mp4'],
    })
    if (res.status < 200 || res.status >= 300) return null
    const mime = String(res.headers['content-type'] ?? 'audio/ogg')
    return { audio: res.body, mime }
  } catch (e) {
    console.error('[stt] downloadAudio failed:', e)
    return null
  }
}
