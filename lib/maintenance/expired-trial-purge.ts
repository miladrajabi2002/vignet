/**
 * Expired trials that were never paid for and have gone quiet do not keep
 * their bulk data forever.
 *
 *   trial ended 30+ days ago, owner inactive 30+ days → warning (panel bell,
 *     manager Telegram bot, report email when set) and the clock starts;
 *   30 days after the warning, still inactive → conversations and customers
 *     go to the trash (the soft-delete sweeper drops them 7 days later),
 *     knowledge bases and their files are deleted, inbound events too.
 *
 * The account, the workspace, its agents and their settings, products and
 * orders stay, so subscribing later brings the assistant straight back; it
 * only has to be taught again. Activity (a login or an agent edit) after the
 * warning cancels it, and a later quiet spell starts the 30 days over.
 * Workspaces that ever paid, internal ones and the platform workspace are
 * never touched.
 */
import { prisma, prismaRaw } from '@/lib/prisma'
import { notifyWorkspace } from '@/lib/notifications/create'
import { sendEmail } from '@/lib/email/resend'
import { BUCKETS, deleteFile } from '@/lib/storage'
import { captureError } from '@/lib/errors/capture'

const DAY_MS = 86_400_000
export const TRIAL_PURGE_IDLE_DAYS = 30
export const TRIAL_PURGE_NOTICE_DAYS = 30
const BATCH = 200

export interface TrialPurgeResult {
  warned: number
  cancelled: number
  purged: number
}

function persianDate(date: Date): string {
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { timeZone: 'Asia/Tehran', dateStyle: 'long' }).format(date)
}

/** The owner's last sign of life: a login or an agent edit. */
async function lastActivity(workspaceId: string): Promise<Date | null> {
  const [owner, agent] = await Promise.all([
    prisma.user.findUnique({ where: { workspaceId }, select: { lastLoginAt: true, createdAt: true } }),
    prisma.agent.aggregate({ where: { workspaceId }, _max: { updatedAt: true } }),
  ])
  const times = [owner?.lastLoginAt, owner?.createdAt, agent._max.updatedAt].filter((d): d is Date => !!d)
  return times.length ? new Date(Math.max(...times.map((d) => d.getTime()))) : null
}

async function purgeWorkspaceData(workspaceId: string, now: Date): Promise<void> {
  // The soft-delete sweeper hard-deletes these after its undo window, with
  // the same cascades as a delete from the panel.
  await prismaRaw.conversation.updateMany({ where: { workspaceId, deletedAt: null }, data: { deletedAt: now } })
  await prismaRaw.contact.updateMany({ where: { workspaceId, deletedAt: null }, data: { deletedAt: now } })
  const files = await prisma.knowledgeBase.findMany({ where: { workspaceId, fileKey: { not: null } }, select: { fileKey: true } })
  // Chunks cascade with their knowledge base.
  await prisma.knowledgeBase.deleteMany({ where: { workspaceId } })
  for (const { fileKey } of files) {
    await deleteFile(BUCKETS.knowledge, fileKey!).catch(() => undefined)
  }
  await prisma.inboundEvent.deleteMany({ where: { workspaceId } })
  await prisma.workspace.update({ where: { id: workspaceId }, data: { trialDataPurgedAt: now } })
}

export async function sweepExpiredTrials(now = new Date()): Promise<TrialPurgeResult> {
  const result: TrialPurgeResult = { warned: 0, cancelled: 0, purged: 0 }
  const protectedId = process.env.PLATFORM_WORKSPACE_ID?.trim()
    || (await prisma.workspace.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } }))?.id
  const candidates = await prisma.workspace.findMany({
    where: {
      plan: 'TRIAL',
      trialEndsAt: { lt: new Date(now.getTime() - TRIAL_PURGE_IDLE_DAYS * DAY_MS) },
      trialDataPurgedAt: null,
      excludeFromAdminReports: false,
      subscriptions: { none: {} },
      payments: { none: { status: 'PAID' } },
      ...(protectedId ? { id: { not: protectedId } } : {}),
    },
    select: { id: true, trialPurgeWarnedAt: true, reportEmail: true },
    orderBy: { trialEndsAt: 'asc' },
    take: BATCH,
  })

  for (const ws of candidates) {
    try {
      const active = await lastActivity(ws.id)
      const idleSince = new Date(now.getTime() - TRIAL_PURGE_IDLE_DAYS * DAY_MS)

      if (ws.trialPurgeWarnedAt) {
        if (active && active > ws.trialPurgeWarnedAt) {
          await prisma.workspace.update({ where: { id: ws.id }, data: { trialPurgeWarnedAt: null } })
          result.cancelled++
        } else if (ws.trialPurgeWarnedAt.getTime() <= now.getTime() - TRIAL_PURGE_NOTICE_DAYS * DAY_MS) {
          await purgeWorkspaceData(ws.id, now)
          await notifyWorkspace({
            workspaceId: ws.id,
            type: 'SYSTEM',
            title: 'اطلاعات حساب آزمایشی پاک شد',
            body: 'گفتگوها، مشتری‌ها و دانش ایجنت حذف شد. حساب، ایجنت و تنظیمات سر جایشان هستند؛ با فعال کردن یک پلن دوباره شروع کنید.',
            link: '/billing',
          })
          result.purged++
        }
        continue
      }

      if (active && active > idleSince) continue
      const purgeOn = new Date(now.getTime() + TRIAL_PURGE_NOTICE_DAYS * DAY_MS)
      const title = 'اطلاعات حساب آزمایشی شما ۳۰ روز دیگر پاک می‌شود'
      const body = `دورهٔ آزمایشی شما تمام شده و مدتی است از پنل استفاده نکرده‌اید. اگر تا ${persianDate(purgeOn)} یکی از پلن‌ها را فعال نکنید یا وارد پنل نشوید، گفتگوها، مشتری‌ها و دانش ایجنت پاک می‌شود. حساب و تنظیمات ایجنت می‌ماند.`
      await prisma.workspace.update({ where: { id: ws.id }, data: { trialPurgeWarnedAt: now } })
      await notifyWorkspace({ workspaceId: ws.id, type: 'SYSTEM', title, body, link: '/billing', operatorTelegram: 'billing' })
      if (ws.reportEmail) {
        await sendEmail({ to: ws.reportEmail, subject: title, html: `<div dir="rtl" style="font-family:Tahoma,sans-serif;line-height:1.9">${body}</div>` })
      }
      result.warned++
    } catch (error) {
      captureError('maintenance:expired-trial-purge', error, { workspaceId: ws.id })
    }
  }
  return result
}
