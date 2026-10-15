import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/session'
import { addPayCard, PayCardError } from '@/lib/payments/card/service'

const schema = z.object({
  pan: z.string().min(16).max(40),
  holderName: z.string().trim().min(2).max(80),
  bankKey: z.string().max(24).optional(),
})

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 })
  try {
    const card = await addPayCard(user.workspaceId, parsed.data)
    return NextResponse.json({ ok: true, id: card.id })
  } catch (error) {
    if (error instanceof PayCardError) return NextResponse.json({ error: error.code === 'DUPLICATE' ? 'DUPLICATE_CARD' : 'INVALID_CARD' }, { status: 400 })
    throw error
  }
}
