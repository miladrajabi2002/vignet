import { prisma } from '@/lib/prisma'
import { OPENROUTER_BASE, getPlatformOpenRouterKey } from '@/lib/ai/openrouter'

/**
 * Text-to-speech via the platform-managed OpenRouter account.
 */
const DEFAULT_TTS_MODEL = 'openai/gpt-4o-mini-tts-2025-12-15'

export interface SynthesizeInput {
  text: string
  workspaceId: string
  voice?: string
  format?: 'mp3' | 'pcm'
}

export interface SynthesizedAudio {
  audio: Buffer
  mime: string
}

async function fetchGenerationCost(
  key: string,
  generationId: string,
): Promise<{ cost: number | null; promptTokens: number; completionTokens: number }> {
  try {
    const res = await fetch(
      `${OPENROUTER_BASE}/generation?id=${encodeURIComponent(generationId)}`,
      {
        headers: { Authorization: `Bearer ${key}` },
        cache: 'no-store',
        signal: AbortSignal.timeout(10_000),
      },
    )
    if (!res.ok) return { cost: null, promptTokens: 0, completionTokens: 0 }
    const json = (await res.json()) as {
      data?: {
        total_cost?: number
        usage?: number
        tokens_prompt?: number
        tokens_completion?: number
      }
    }
    const rawCost = Number(json.data?.total_cost ?? json.data?.usage)
    return {
      cost: Number.isFinite(rawCost) ? rawCost : null,
      promptTokens: Number(json.data?.tokens_prompt) || 0,
      completionTokens: Number(json.data?.tokens_completion) || 0,
    }
  } catch {
    return { cost: null, promptTokens: 0, completionTokens: 0 }
  }
}

const MIME_BY_FORMAT: Record<string, string> = {
  mp3: 'audio/mpeg',
  pcm: 'audio/pcm',
}

export async function synthesizeSpeech(
  input: SynthesizeInput,
): Promise<SynthesizedAudio> {
  const key = getPlatformOpenRouterKey()
  if (!key) throw new Error('PLATFORM_AI_NOT_CONFIGURED')

  const format = input.format ?? 'mp3'
  const model = process.env.OPENROUTER_TTS_MODEL?.trim() || DEFAULT_TTS_MODEL
  const ws = await prisma.workspace.findUnique({
    where: { id: input.workspaceId },
    select: { defaultTtsVoice: true },
  })
  const voice = input.voice ?? ws?.defaultTtsVoice ?? 'alloy'

  const res = await fetch(`${OPENROUTER_BASE}/audio/speech`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'https://vigent.ir',
      'X-Title': 'Vigent',
    },
    body: JSON.stringify({
      model,
      input: input.text,
      voice,
      response_format: format,
      provider: {
        data_collection: 'deny',
        zdr: process.env.OPENROUTER_ZDR?.trim().toLowerCase() !== 'false',
      },
    }),
    signal: AbortSignal.timeout(90_000),
  })
  if (!res.ok) {
    throw new Error(`OPENROUTER_TTS_${res.status}`)
  }

  const audio = Buffer.from(await res.arrayBuffer())
  const generationId = res.headers.get('x-generation-id')
  const usage = generationId
    ? await fetchGenerationCost(key, generationId)
    : { cost: null, promptTokens: 0, completionTokens: 0 }

  prisma.usageLog
    .create({
      data: {
        workspaceId: input.workspaceId,
        type: 'TTS',
        model,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        providerRequestId: generationId,
        cost: usage.cost,
      },
    })
    .catch(() => {})

  return { audio, mime: MIME_BY_FORMAT[format] ?? 'audio/mpeg' }
}
