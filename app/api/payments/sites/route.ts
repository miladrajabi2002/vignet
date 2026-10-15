import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { newSiteCredentials } from '@/lib/payments/card/sites'

const schema = z.object({
  name: z.string().trim().min(1).max(60),
  domain: z.string().trim().max(120).optional(),
})

/** A new API key for one site. The key and the callback secret are shown once, here. */
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 })
  if ((await prisma.paySite.count({ where: { workspaceId: user.workspaceId } })) >= 20) return NextResponse.json({ error: 'TOO_MANY_SITES' }, { status: 400 })
  const credentials = newSiteCredentials()
  const site = await prisma.paySite.create({
    data: { workspaceId: user.workspaceId, name: parsed.data.name, domain: parsed.data.domain || null, ...credentials.fields },
    select: { id: true },
  })
  return NextResponse.json({ ok: true, id: site.id, key: credentials.key, secret: credentials.secret })
}
