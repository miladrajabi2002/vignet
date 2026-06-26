import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { encrypt, keyHint } from '@/lib/crypto'
import { validateOpenRouterKey } from '@/lib/ai/openrouter'
import { syncOnboarding } from '@/lib/onboarding'

const bodySchema = z.object({ key: z.string().min(10) })

// POST — validate the key against OpenRouter, then encrypt & store it.
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const json = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 })
  }

  const key = parsed.data.key.trim()
  const valid = await validateOpenRouterKey(key)
  if (!valid) {
    return NextResponse.json({ error: 'INVALID_KEY' }, { status: 400 })
  }

  await prisma.workspace.update({
    where: { id: user.workspaceId },
    data: {
      openrouterKeyEnc: encrypt(key),
      openrouterKeyHint: keyHint(key),
    },
  })

  await syncOnboarding(user.workspaceId)

  return NextResponse.json({ ok: true, hint: keyHint(key) })
}

// DELETE — remove the stored key.
export async function DELETE() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  await prisma.workspace.update({
    where: { id: user.workspaceId },
    data: { openrouterKeyEnc: null, openrouterKeyHint: null },
  })
  await syncOnboarding(user.workspaceId)

  return NextResponse.json({ ok: true })
}
