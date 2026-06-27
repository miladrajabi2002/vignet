import { prisma } from '@/lib/prisma'
import { OPENROUTER_BASE, getWorkspaceOpenRouterKey } from '@/lib/ai/openrouter'

/**
 * Speech-to-text via Whisper, using the workspace's own OpenRouter key (BYOK).
 * OpenAI-compatible audio/transcriptions endpoint.
 */
const STT_MODEL = 'whisper-1'

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
  const key = await getWorkspaceOpenRouterKey(input.workspaceId)
  if (!key) throw new Error('NO_OPENROUTER_KEY')

  const form = new FormData()
  form.append(
    'file',
    new Blob([new Uint8Array(input.audio)], { type: input.mime }),
    input.filename ?? 'audio.ogg',
  )
  form.append('model', STT_MODEL)
  if (input.language) form.append('language', input.language)

  const res = await fetch(`${OPENROUTER_BASE}/audio/transcriptions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'https://vigent.ir',
      'X-Title': 'Vigent',
    },
    body: form,
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`STT failed (${res.status}): ${body}`)
  }
  const json = (await res.json()) as { text?: string }

  // Best-effort usage log.
  prisma.usageLog
    .create({ data: { workspaceId: input.workspaceId, type: 'STT', model: STT_MODEL } })
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
