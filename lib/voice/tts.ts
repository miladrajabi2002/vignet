import { prisma } from '@/lib/prisma'
import { OPENROUTER_BASE, getWorkspaceOpenRouterKey } from '@/lib/ai/openrouter'

/**
 * Text-to-speech via OpenAI-compatible audio/speech, using the workspace's
 * OpenRouter key (BYOK). Returns raw audio bytes.
 */
const TTS_MODEL = 'tts-1'

export interface SynthesizeInput {
  text: string
  workspaceId: string
  voice?: string
  format?: 'mp3' | 'opus' | 'ogg'
}

export interface SynthesizedAudio {
  audio: Buffer
  mime: string
}

const MIME_BY_FORMAT: Record<string, string> = {
  mp3: 'audio/mpeg',
  opus: 'audio/ogg',
  ogg: 'audio/ogg',
}

export async function synthesizeSpeech(
  input: SynthesizeInput,
): Promise<SynthesizedAudio> {
  const key = await getWorkspaceOpenRouterKey(input.workspaceId)
  if (!key) throw new Error('NO_OPENROUTER_KEY')

  const format = input.format ?? 'mp3'
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
      model: TTS_MODEL,
      input: input.text,
      voice,
      response_format: format,
    }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`TTS failed (${res.status}): ${body}`)
  }

  const audio = Buffer.from(await res.arrayBuffer())

  prisma.usageLog
    .create({ data: { workspaceId: input.workspaceId, type: 'TTS', model: TTS_MODEL } })
    .catch(() => {})

  return { audio, mime: MIME_BY_FORMAT[format] ?? 'audio/mpeg' }
}
