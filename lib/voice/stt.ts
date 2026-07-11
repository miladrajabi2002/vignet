import { prisma } from '@/lib/prisma'
import { OPENROUTER_BASE, getPlatformOpenRouterKey } from '@/lib/ai/openrouter'

/**
 * Speech-to-text via Vigent's platform-managed OpenRouter account.
 * OpenAI-compatible audio/transcriptions endpoint.
 */
const DEFAULT_STT_MODEL = 'openai/whisper-large-v3-turbo'

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
  language?: string
}

export async function transcribeAudio(
  input: TranscribeInput,
): Promise<string> {
  const key = getPlatformOpenRouterKey()
  if (!key) throw new Error('PLATFORM_AI_NOT_CONFIGURED')

  const model = process.env.OPENROUTER_STT_MODEL?.trim() || DEFAULT_STT_MODEL

  const res = await fetch(`${OPENROUTER_BASE}/audio/transcriptions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'https://vigent.ir',
      'X-Title': 'Vigent',
    },
    body: JSON.stringify({
      model,
      input_audio: {
        data: input.audio.toString('base64'),
        format: audioFormat(input),
      },
      ...(input.language ? { language: input.language } : {}),
      provider: {
        data_collection: 'deny',
        zdr: process.env.OPENROUTER_ZDR?.trim().toLowerCase() !== 'false',
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
    }
  }

  const rawCost = Number(json.usage?.cost)
  const generationId = res.headers.get('x-generation-id') || json.id || null
  prisma.usageLog
    .create({
      data: {
        workspaceId: input.workspaceId,
        type: 'STT',
        model,
        promptTokens: Number(json.usage?.input_tokens) || 0,
        completionTokens: Number(json.usage?.output_tokens) || 0,
        providerRequestId: generationId,
        cost: Number.isFinite(rawCost) ? rawCost : null,
      },
    })
    .catch(() => {})

  return (json.text ?? '').trim()
}

/** Download a remote audio file (e.g. a Telegram voice note) into a Buffer. */
export async function downloadAudio(
  url: string,
): Promise<{ audio: Buffer; mime: string } | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const mime = res.headers.get('content-type') ?? 'audio/ogg'
    const buf = Buffer.from(await res.arrayBuffer())
    return { audio: buf, mime }
  } catch (e) {
    console.error('[stt] downloadAudio failed:', e)
    return null
  }
}
