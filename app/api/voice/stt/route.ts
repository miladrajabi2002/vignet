import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { rateLimit } from '@/lib/ratelimit'
import { transcribeAudio } from '@/lib/voice/stt'

export const dynamic = 'force-dynamic'

const MAX_BYTES = 25 * 1024 * 1024 // 25 MB

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const allowed = await rateLimit(`stt:${user.workspaceId}`, 30, 60)
  if (!allowed) return NextResponse.json({ error: 'RATE_LIMIT' }, { status: 429 })

  const form = await req.formData().catch(() => null)
  const file = form?.get('audio')
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: 'NO_AUDIO' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'TOO_LARGE' }, { status: 413 })
  }

  const audio = Buffer.from(await file.arrayBuffer())
  try {
    const text = await transcribeAudio({
      audio,
      mime: file.type || 'audio/webm',
      filename: 'recording.webm',
      workspaceId: user.workspaceId,
    })
    return NextResponse.json({ text })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'STT_FAILED'
    if (msg === 'NO_OPENROUTER_KEY') {
      return NextResponse.json({ error: 'NO_KEY' }, { status: 400 })
    }
    console.error('[voice/stt] failed:', e)
    return NextResponse.json({ error: 'STT_FAILED' }, { status: 500 })
  }
}
