import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { ADMIN_OWNER_PHONE, isAdminAuthed } from '@/lib/admin/auth'
import { dispatchNotification } from '@/lib/queue/jobs'

const BodySchema = z.object({
  mode: z.enum(['single', 'bulk']),
  userId: z.string().min(1).optional(),
  audience: z.enum(['all', 'paid', 'trial', 'onboarding']).optional(),
  plan: z.enum(['TRIAL', 'STARTER', 'PRO', 'BUSINESS']).optional(),
  channel: z.enum(['notification', 'sms', 'both']),
  title: z.string().trim().min(2).max(120),
  message: z.string().trim().min(2).max(1000),
}).superRefine((value, ctx) => {
  if (value.mode === 'single' && !value.userId) ctx.addIssue({ code: 'custom', path: ['userId'], message: 'کاربر را انتخاب کنید.' })
  if (value.mode === 'bulk' && !value.audience && !value.plan) ctx.addIssue({ code: 'custom', path: ['audience'], message: 'مخاطبان را انتخاب کنید.' })
})

export async function POST(request: Request) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'اطلاعات نامعتبر است.' }, { status: 400 })
  const input = parsed.data

  const where: Prisma.WorkspaceWhereInput = input.mode === 'single'
    ? { users: { some: { id: input.userId } } }
    : input.plan
      ? { plan: input.plan }
      : input.audience === 'paid'
        ? { plan: { not: 'TRIAL' } }
        : input.audience === 'trial'
          ? { plan: 'TRIAL' }
          : input.audience === 'onboarding'
            ? { onboardingCompleted: false }
            : {}

  const workspaces = await prisma.workspace.findMany({
    where,
    take: 1000,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      users: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, phone: true },
      },
    },
  })

  if (!workspaces.length) return NextResponse.json({ error: 'مخاطبی با این فیلتر پیدا نشد.' }, { status: 404 })
  const sendInApp = input.channel !== 'sms'
  const sendSms = input.channel !== 'notification'
  const text = `${input.title}\n${input.message}`
  let notificationCount = 0
  let smsCount = 0

  for (let index = 0; index < workspaces.length; index += 10) {
    await Promise.all(workspaces.slice(index, index + 10).map(async (workspace) => {
      if (sendInApp) {
        await prisma.notification.create({ data: { workspaceId: workspace.id, type: 'SYSTEM', title: input.title, body: input.message } })
        notificationCount += 1
      }
      if (sendSms) {
        const recipient = input.mode === 'single'
          ? workspace.users.find((user) => user.id === input.userId)
          : workspace.users[0]
        if (recipient?.phone) {
          await dispatchNotification({ kind: 'sms', to: recipient.phone, message: text })
          smsCount += 1
        }
      }
    }))
  }

  await prisma.adminAuditLog.create({
    data: {
      adminPhone: ADMIN_OWNER_PHONE || 'unconfigured',
      action: 'ADMIN_BROADCAST',
      targetType: input.mode === 'single' ? 'User' : 'Audience',
      targetId: input.userId ?? input.plan ?? input.audience ?? 'all',
      payload: {
        mode: input.mode,
        channel: input.channel,
        audience: input.audience ?? null,
        plan: input.plan ?? null,
        title: input.title,
        messageLength: input.message.length,
        workspaceCount: workspaces.length,
        notificationCount,
        smsCount,
      } as Prisma.InputJsonValue,
    },
  })

  return NextResponse.json({ ok: true, workspaceCount: workspaces.length, notificationCount, smsCount })
}
