import { prisma } from '@/lib/prisma'
import { captureError } from '@/lib/errors/capture'
import { notifyWorkspace } from '@/lib/notifications/create'
import { getEffectiveReplyPriceIRR, resolveModelAlias, type ModelAlias } from '@/lib/ai/models'

/**
 * Trial quota alerting (A16).
 *
 * Two thresholds over the workspace's TRIAL reply credit:
 *   80%  → warn the workspace owner (in-app + operator Telegram).
 *   100% → tell the owner the free capacity is exhausted and the
 *          platform already answered customers with the polite
 *          configurable message; prompt a plan upgrade.
 *
 * The consumed share is measured against the trial grant actually received.
 * The grant is reconstructed lazily from the wallet ledger the first time the
 * alert runs for a workspace (balance + captured charges − refunds), then
 * cached on the workspace row (`trialInitialCreditIRR`) so later sweeps stay
 * O(1). Latches (`trialQuota80AlertedAt` / `trialQuota100AlertedAt`) make each
 * milestone notify at most once per workspace lifetime; a manual credit top-up
 * resets the 80% latch so the owner gets warned again on the next drain.
 */

const FA_PCT = (fraction: number) => `${Math.round(fraction * 100).toLocaleString('fa-IR')}٪`

export type TrialQuotaOutcome =
        | { kind: 'SKIP'; reason: 'NOT_TRIAL' | 'NO_GRANT' }
        | { kind: 'OK'; consumedFraction: number; alerted80: boolean; alerted100: boolean }

async function reconstructTrialGrant(workspaceId: string): Promise<number | null> {
        const ledger = await prisma.walletLedger.aggregate({
                where: { workspaceId },
                _sum: { amountIRR: true },
        })
        const charged = await prisma.walletLedger.findMany({
                where: { workspaceId, type: { in: ['AI_CHARGE', 'AI_REFUND'] } },
                select: { type: true, amountIRR: true },
        })
        // Only charges that were actually captured count as consumption. A
        // released reservation refunds its full amount, so subtracting refunds
        // from charges yields the durable spend so far.
        const netCharged = charged.reduce(
                (sum, row) => sum + (row.type === 'AI_CHARGE' ? Math.abs(row.amountIRR) : -Math.abs(row.amountIRR)),
                0,
        )
        void ledger
        if (!Number.isFinite(netCharged) || netCharged <= 0) return null
        const workspace = await prisma.workspace.findUnique({
                where: { id: workspaceId },
                select: { aiCreditBalanceIRR: true },
        })
        if (!workspace) return null
        const grant = workspace.aiCreditBalanceIRR + netCharged
        return grant > 0 ? grant : null
}

/**
 * Evaluate (and latch) trial quota milestones for a workspace. Safe to call
 * after every credit capture and from the NO_CREDIT reply gate. Never throws.
 */
export async function processTrialQuotaAlert(params: {
        workspaceId: string
        /** True when called from the exhausted-credit reply gate. */
        exhausted?: boolean
}): Promise<TrialQuotaOutcome> {
        try {
                const workspace = await prisma.workspace.findUnique({
                        where: { id: params.workspaceId },
                        select: {
                                plan: true,
                                aiCreditBalanceIRR: true,
                                trialInitialCreditIRR: true,
                                trialQuota80AlertedAt: true,
                                trialQuota100AlertedAt: true,
                        },
                })
                if (!workspace || workspace.plan !== 'TRIAL') {
                        return { kind: 'SKIP', reason: 'NOT_TRIAL' }
                }

                let grantIRR = workspace.trialInitialCreditIRR
                if (!grantIRR || grantIRR <= 0) {
                        const reconstructed = await reconstructTrialGrant(params.workspaceId)
                        if (!reconstructed || reconstructed <= 0) {
                                return { kind: 'SKIP', reason: 'NO_GRANT' }
                        }
                        grantIRR = reconstructed
                        await prisma.workspace.update({
                                where: { id: params.workspaceId },
                                data: { trialInitialCreditIRR: reconstructed },
                        }).catch(() => {})
                }

                const balance = workspace.aiCreditBalanceIRR
                const consumedFraction = Math.max(0, Math.min(1, (grantIRR - balance) / grantIRR))

                // A manual top-up resets the 80% latch so a second drain warns again.
                const toppedUp = balance > grantIRR * 0.8 && consumedFraction < 0.8
                const shouldAlert80 = consumedFraction >= 0.8 && !workspace.trialQuota80AlertedAt
                const shouldReset80 = toppedUp && workspace.trialQuota80AlertedAt && !workspace.trialQuota100AlertedAt
                const shouldAlert100 =
                        (params.exhausted || consumedFraction >= 1) && !workspace.trialQuota100AlertedAt

                if (shouldReset80) {
                        await prisma.workspace.update({
                                where: { id: params.workspaceId },
                                data: { trialQuota80AlertedAt: null },
                        }).catch(() => {})
                }

                if (shouldAlert80) {
                        await prisma.workspace.update({
                                where: { id: params.workspaceId },
                                data: { trialQuota80AlertedAt: new Date() },
                        }).catch(() => {})
                        await notifyWorkspace({
                                workspaceId: params.workspaceId,
                                type: 'SYSTEM',
                                title: '۸۰ درصد اعتبار رایگان مصرف شده است',
                                body: `تقریباً ${FA_PCT(consumedFraction)} از اعتبار پاسخگویی رایگان این مجموعه مصرف شده است. برای جلوگیری از قطع شدن پاسخ‌ها، اعتبار یا پلن را از قبل ارتقا دهید.`,
                                link: '/billing',
                                operatorTelegram: true,
                        }).catch(() => {})
                }

                if (shouldAlert100) {
                        await prisma.workspace.update({
                                where: { id: params.workspaceId },
                                data: { trialQuota100AlertedAt: new Date() },
                        }).catch(() => {})
                        await notifyWorkspace({
                                workspaceId: params.workspaceId,
                                type: 'SYSTEM',
                                title: 'اعتبار پاسخگویی رایگان این مجموعه تکمیل شده است',
                                body: 'مشتریان از این لحظه پیام کوتاه «ظرفیت پاسخگویی رایگان تکمیل شده» دریافت می‌کنند و گفتگوها برای پیگیری انسانی علامت می‌خورند. برای فعال ماندن پاسخ‌دهی خودکار، پلن یا اعتبار را ارتقا دهید.',
                                link: '/billing',
                                operatorTelegram: true,
                        }).catch(() => {})
                }

                return { kind: 'OK', consumedFraction, alerted80: shouldAlert80, alerted100: shouldAlert100 }
        } catch (error) {
                captureError('billing:trial-quota-alert', error, { workspaceId: params.workspaceId })
                return { kind: 'SKIP', reason: 'NOT_TRIAL' }
        }
}

/**
 * Whether the workspace can currently afford even the cheapest reply — used by
 * the inbound gate to distinguish "out of money" from other block reasons.
 */
export async function isCreditExhausted(workspaceId: string): Promise<boolean> {
        try {
                const [workspace, fastPrice] = await Promise.all([
                        prisma.workspace.findUnique({
                                where: { id: workspaceId },
                                select: { aiCreditBalanceIRR: true },
                        }),
                        getEffectiveReplyPriceIRR(resolveModelAlias('fast') as ModelAlias),
                ])
                if (!workspace) return false
                return workspace.aiCreditBalanceIRR < fastPrice
        } catch {
                return false
        }
}
