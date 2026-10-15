import { NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { normalizeIranianMobile } from '@/lib/phone'
import { deviceTokenFields, newDeviceToken } from '@/lib/payments/card/ingest'

const schema = z.object({
  name: z.string().trim().min(1).max(60),
  platform: z.enum(['ANDROID', 'IOS']),
  method: z.enum(['SMS', 'URL']),
  // The SIM that receives the bank's deposit SMS.
  phone: z.string().max(20),
})

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 })
  const phone = normalizeIranianMobile(parsed.data.phone)
  if (!phone) return NextResponse.json({ error: 'INVALID_PHONE' }, { status: 400 })
  if ((await prisma.payDevice.count({ where: { workspaceId: user.workspaceId } })) >= 5) return NextResponse.json({ error: 'TOO_MANY_DEVICES' }, { status: 400 })
  try {
    const device = await prisma.payDevice.create({
      data: { workspaceId: user.workspaceId, name: parsed.data.name, platform: parsed.data.platform, method: parsed.data.method, phone, ...deviceTokenFields(newDeviceToken()) },
      select: { id: true },
    })
    return NextResponse.json({ ok: true, id: device.id })
  } catch (error) {
    // The number is the phone's identity on the SMS line: one business per number.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return NextResponse.json({ error: 'PHONE_IN_USE' }, { status: 409 })
    throw error
  }
}
