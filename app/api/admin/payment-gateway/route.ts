import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { isAdminAuthed } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { clearPlatformGatewayCache } from '@/lib/payments/card/platform'

export const dynamic = 'force-dynamic'

const cap = z.number().int().nonnegative().max(10_000_000).nullable()
const schema = z.object({
  enabled: z.boolean(),
  planMonthlyCaps: z.object({ TRIAL: cap, STARTER: cap, PRO: cap, BUSINESS: cap }),
  inboundLines: z.array(z.string().trim().regex(/^\+?\d{6,16}$/)).max(5),
  maxAmount: z.number().int().min(1_000).max(1_000_000_000),
  // A fresh secret for the SMS panel's inbound webhook; the old URL stops working.
  rotateSecret: z.boolean().optional(),
})

export async function PUT(req: Request) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT', issues: parsed.error.flatten().fieldErrors }, { status: 400 })
  const { rotateSecret, ...data } = parsed.data
  const existing = await prisma.paymentGatewaySettings.findUnique({ where: { id: 'primary' }, select: { inboundSecret: true } })
  const inboundSecret = rotateSecret || !existing?.inboundSecret ? crypto.randomBytes(24).toString('base64url') : existing.inboundSecret
  const row = await prisma.paymentGatewaySettings.upsert({
    where: { id: 'primary' },
    create: { id: 'primary', ...data, inboundSecret },
    update: { ...data, inboundSecret },
  })
  clearPlatformGatewayCache()
  return NextResponse.json({ ok: true, inboundSecret: row.inboundSecret })
}
