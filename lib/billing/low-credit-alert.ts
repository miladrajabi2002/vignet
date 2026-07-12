import { prisma } from '@/lib/prisma'
import { dispatchNotification } from '@/lib/queue/jobs'
import { captureError } from '@/lib/errors/capture'
import { findModel, type ModelAlias } from '@/lib/ai/models'
import {
  decideLowCreditAlertAction,
  estimateRemainingReplies,
  lowCreditThresholdIRR,
} from '@/lib/billing/credit-estimates'

type AlertPayload = {
  workspaceId: string
  remainingReplies: number
  modelName: string
}

/**
 * Runs only after a successful credit capture. The caller intentionally does
 * not await it: state/notification failures are isolated from the chat reply.
 */
export async function processLowCreditAlert(params: {
  workspaceId: string
  modelAlias: ModelAlias
  replyPriceIRR: number
}): Promise<void> {
  try {
    const alert = await prisma.$transaction(async (tx): Promise<AlertPayload | null> => {
      const [workspace, state] = await Promise.all([
        tx.workspace.findUnique({
          where: { id: params.workspaceId },
          select: { aiCreditBalanceIRR: true },
        }),
        tx.creditAlertState.findUnique({
          where: {
            workspaceId_modelAlias: {
              workspaceId: params.workspaceId,
              modelAlias: params.modelAlias,
            },
          },
        }),
      ])
      if (!workspace) return null

      const thresholdIRR = lowCreditThresholdIRR(params.replyPriceIRR)
      const action = decideLowCreditAlertAction({
        armed: state?.armed ?? null,
        balanceIRR: workspace.aiCreditBalanceIRR,
        replyPriceIRR: params.replyPriceIRR,
      })

      if (action === 'REARM' && state) {
        await tx.creditAlertState.update({
          where: { id: state.id },
          data: {
            armed: true,
            thresholdIRR,
            lastBalanceIRR: workspace.aiCreditBalanceIRR,
          },
        })
        return null
      }
      if (action !== 'ALERT') return null

      const now = new Date()
      if (state) {
        const claimed = await tx.creditAlertState.updateMany({
          where: { id: state.id, armed: true },
          data: {
            armed: false,
            lastAlertedAt: now,
            thresholdIRR,
            lastBalanceIRR: workspace.aiCreditBalanceIRR,
          },
        })
        if (claimed.count !== 1) return null
      } else {
        await tx.creditAlertState.create({
          data: {
            workspaceId: params.workspaceId,
            modelAlias: params.modelAlias,
            armed: false,
            lastAlertedAt: now,
            thresholdIRR,
            lastBalanceIRR: workspace.aiCreditBalanceIRR,
          },
        })
      }

      const remainingReplies = estimateRemainingReplies(
        workspace.aiCreditBalanceIRR,
        params.replyPriceIRR,
      )
      const modelName = findModel(params.modelAlias).name
      await tx.notification.create({
        data: {
          workspaceId: params.workspaceId,
          type: 'SYSTEM',
          title: 'اعتبار پاسخ‌ها رو به پایان است',
          body: `با مدل «${modelName}» حدود ${remainingReplies.toLocaleString('fa-IR')} پاسخ موفق دیگر باقی مانده است. برای جلوگیری از توقف پاسخ‌گویی، اعتبار را افزایش دهید.`,
          link: '/billing',
        },
      })

      return { workspaceId: params.workspaceId, remainingReplies, modelName }
    })

    if (alert) await sendLowCreditSms(alert)
  } catch (error) {
    captureError('billing:low-credit-alert', error, {
      workspaceId: params.workspaceId,
      metadata: { modelAlias: params.modelAlias },
    })
  }
}

async function sendLowCreditSms(alert: AlertPayload): Promise<void> {
  try {
    const owner = await prisma.user.findFirst({
      where: { workspaceId: alert.workspaceId, role: 'OWNER' },
      orderBy: { createdAt: 'asc' },
      select: { phone: true },
    })
    if (!owner?.phone) return

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://vigent.ir').replace(/\/$/, '')
    await dispatchNotification({
      kind: 'sms',
      to: owner.phone,
      message: `اعتبار پاسخ‌های ویجنت رو به پایان است. با مدل ${alert.modelName} حدود ${alert.remainingReplies.toLocaleString('fa-IR')} پاسخ دیگر دارید. افزایش اعتبار: ${appUrl}/billing`,
    })
  } catch (error) {
    captureError('billing:low-credit-sms', error, { workspaceId: alert.workspaceId })
  }
}
