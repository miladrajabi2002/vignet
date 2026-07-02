import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'

/**
 * Save the workspace's weekly-report email. The report itself ships later;
 * collecting the email now builds the send list for launch day.
 */

const bodySchema = z.object({
  email: z.string().email().max(200).or(z.literal('')),
})

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const json = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 })
  }

  await prisma.workspace.update({
    where: { id: user.workspaceId },
    data: { reportEmail: parsed.data.email || null },
  })

  return NextResponse.json({ ok: true })
}
