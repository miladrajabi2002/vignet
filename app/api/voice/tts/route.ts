import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/session'
import { rateLimit } from '@/lib/ratelimit'
import { synthesizeSpeech } from '@/lib/voice/tts'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  text: z.string().min(1).max(4000),
  voice: z.string().max(50).optional(),
})

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const allowed = await rateLimit(`tts:${user.workspaceId}`, 30, 60)
  if (!allowed) return NextResponse.json({ error: 'RATE_LIMIT' }, { status: 429 })

  const json = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: 'INVALID' }, { status: 400 })

  try {
    const { audio, mime } = await synthesizeSpeech({
      text: parsed.data.text,
      workspaceId: user.workspaceId,
      voice: parsed.data.voice,
      format: 'mp3',
    })
    return new Response(new Uint8Array(audio), {
      headers: { 'Content-Type': mime, 'Cache-Control': 'no-store' },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'TTS_FAILED'
    if (msg === 'NO_OPENROUTER_KEY') {
      return NextResponse.json({ error: 'NO_KEY' }, { status: 400 })
    }
    console.error('[voice/tts] failed:', e)
    return NextResponse.json({ error: 'TTS_FAILED' }, { status: 500 })
  }
}
