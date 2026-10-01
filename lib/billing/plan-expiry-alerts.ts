/**
 * Plan-expiry heads-up for the owner, in the panel bell and the manager
 * Telegram bot («اعتبار و پلن»): 7, 3 and 1 day before a paid period ends,
 * and 3 and 1 day before a trial ends. Each stage fires once per period
 * (Redis claim), so a renewal that moves the period end starts fresh.
 * The renewal SMS keeps its own schedule in the worker.
 */
import { prisma } from '@/lib/prisma'
import { getRedis } from '@/lib/redis'
import { notifyWorkspace } from '@/lib/notifications/create'
import { captureError } from '@/lib/errors/capture'

const DAY_MS = 86_400_000
export const PAID_STAGES = [7, 3, 1] as const
export const TRIAL_STAGES = [3, 1] as const

const PLAN_FA: Record<string, string> = {
  TRIAL: 'آزمایشی',
  STARTER: 'استارتر',
  PRO: 'حرفه‌ای',
  BUSINESS: 'بیزینس',
}

/** The tightest stage the remaining time falls in, or null when too early. */
export function expiryStage(msLeft: number, stages: readonly number[]): number | null {
  if (msLeft <= 0) return null
  const days = msLeft / DAY_MS
  const sorted = [...stages].sort((a, b) => a - b)
  return sorted.find((stage) => days <= stage) ?? null
}

export function planExpiryText(params: { plan: string; stage: number; trial: boolean; endsAt: Date }): { title: string; body: string } {
  const nf = new Intl.NumberFormat('fa-IR')
  const when = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { timeZone: 'Asia/Tehran', dateStyle: 'medium', timeStyle: 'short' }).format(params.endsAt)
  const subject = params.trial ? 'دوره آزمایشی' : `اشتراک ${PLAN_FA[params.plan] ?? params.plan}`
  const title = params.stage <= 1
    ? `${subject} کمتر از یک روز دیگر تمام می‌شود`
    : `${subject} ${nf.format(params.stage)} روز دیگر تمام می‌شود`
  const body = params.trial
    ? `پایان: ${when}. برای اینکه پاسخ خودکار ایجنت قطع نشود، یکی از پلن‌ها را فعال کنید.`
    : `پایان: ${when}. برای اینکه پاسخ خودکار ایجنت قطع نشود، از بخش مالی تمدید کنید.`
  return { title, body }
}

async function claim(key: string, ttlSeconds: number): Promise<boolean> {
  return (await getRedis().set(key, '1', 'EX', ttlSeconds, 'NX')) === 'OK'
}

export async function sweepPlanExpiryAlerts(now = new Date()): Promise<number> {
  let sent = 0
  const [subscriptions, trials] = await Promise.all([
    prisma.subscription.findMany({
      where: { status: 'ACTIVE', currentPeriodEnd: { gt: now, lte: new Date(now.getTime() + PAID_STAGES[0] * DAY_MS) } },
      select: { workspaceId: true, plan: true, currentPeriodEnd: true },
      take: 500,
    }),
    prisma.workspace.findMany({
      where: { plan: 'TRIAL', trialEndsAt: { gt: now, lte: new Date(now.getTime() + TRIAL_STAGES[0] * DAY_MS) } },
      select: { id: true, trialEndsAt: true },
      take: 500,
    }),
  ])

  const items = [
    ...subscriptions.map((sub) => ({ workspaceId: sub.workspaceId, plan: sub.plan as string, endsAt: sub.currentPeriodEnd, trial: false })),
    ...trials.map((workspace) => ({ workspaceId: workspace.id, plan: 'TRIAL', endsAt: workspace.trialEndsAt!, trial: true })),
  ]
  for (const item of items) {
    const stage = expiryStage(item.endsAt.getTime() - now.getTime(), item.trial ? TRIAL_STAGES : PAID_STAGES)
    if (stage === null) continue
    const key = `plan_expiry_alert:${item.workspaceId}:${item.endsAt.getTime().toString(36)}:${stage}`
    try {
      if (!(await claim(key, (stage + 2) * 86_400))) continue
      const { title, body } = planExpiryText({ plan: item.plan, stage, trial: item.trial, endsAt: item.endsAt })
      await notifyWorkspace({
        workspaceId: item.workspaceId,
        type: 'SYSTEM',
        title,
        body,
        link: '/billing',
        operatorTelegram: 'billing',
      })
      sent++
    } catch (error) {
      captureError('billing:plan-expiry-alert', error, { workspaceId: item.workspaceId })
    }
  }
  return sent
}
