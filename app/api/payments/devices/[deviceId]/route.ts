import { NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { normalizeIranianMobile } from '@/lib/phone'
import { deviceTokenFields, deviceUrl, newDeviceToken } from '@/lib/payments/card/ingest'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ deviceId: string }> }

/** Live connection state for the setup guide (polled while it is open). */
export async function GET(_req: Request, props: Params) {
  const { deviceId } = await props.params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const device = await prisma.payDevice.findFirst({ where: { id: deviceId, workspaceId: user.workspaceId } })
  if (!device) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  return NextResponse.json({
    connectedAt: device.connectedAt?.toISOString() ?? null,
    verifiedAt: device.verifiedAt?.toISOString() ?? null,
    lastSmsAt: device.lastSmsAt?.toISOString() ?? null,
  }, { headers: { 'Cache-Control': 'no-store' } })
}

const schema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  platform: z.enum(['ANDROID', 'IOS']).optional(),
  method: z.enum(['SMS', 'URL']).optional(),
  phone: z.string().max(20).optional(),
  active: z.boolean().optional(),
  keyword: z.string().trim().min(2).max(40).nullable().optional(),
  // A new address; the old one stops working at once.
  rotate: z.literal(true).optional(),
})

export async function PATCH(req: Request, props: Params) {
  const { deviceId } = await props.params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 })
  const { rotate, phone: rawPhone, ...rest } = parsed.data
  const data: Prisma.PayDeviceUpdateManyMutationInput = { ...rest }
  if (rawPhone !== undefined) {
    const phone = normalizeIranianMobile(rawPhone)
    if (!phone) return NextResponse.json({ error: 'INVALID_PHONE' }, { status: 400 })
    data.phone = phone
  }
  if (rotate) Object.assign(data, deviceTokenFields(newDeviceToken()))
  try {
    const updated = await prisma.payDevice.updateMany({ where: { id: deviceId, workspaceId: user.workspaceId }, data })
    if (!updated.count) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return NextResponse.json({ error: 'PHONE_IN_USE' }, { status: 409 })
    throw error
  }
  const device = await prisma.payDevice.findUniqueOrThrow({ where: { id: deviceId } })
  return NextResponse.json({ ok: true, url: deviceUrl(device) })
}

export async function DELETE(_req: Request, props: Params) {
  const { deviceId } = await props.params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const deleted = await prisma.payDevice.deleteMany({ where: { id: deviceId, workspaceId: user.workspaceId } })
  if (!deleted.count) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
