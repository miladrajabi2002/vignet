import { prisma } from '@/lib/prisma'
import { sendOutbound } from '@/lib/channels/outbound'
import { recordConversationActivity } from '@/lib/conversations/activity'

export interface CampaignJobData {
  campaignId: string
}

const OPT_OUT_FOOTER_FA = 'برای لغو پیام‌های اطلاع‌رسانی، STOP را ارسال کنید.'
const OPT_OUT_FOOTER_EN = 'Reply STOP to unsubscribe from informational messages.'
const SEND_INTERVAL_MS = Math.max(50, Number(process.env.CAMPAIGN_SEND_INTERVAL_MS ?? 180))

export function campaignDeliveryText(message: string): string {
  const footer = /[\u0600-\u06FF]/.test(message) ? OPT_OUT_FOOTER_FA : OPT_OUT_FOOTER_EN
  return `${message.trim()}\n\n${footer}`
}

function waitForRateLimit(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, SEND_INTERVAL_MS))
}

async function processRecipient(params: {
  campaignId: string
  workspaceId: string
  message: string
  recipientId: string
}): Promise<void> {
  const claimed = await prisma.campaignRecipient.updateMany({
    where: { id: params.recipientId, campaignId: params.campaignId, status: 'PENDING' },
    data: { status: 'SENDING', attemptCount: { increment: 1 }, errorCode: null },
  })
  if (claimed.count !== 1) return

  const recipient = await prisma.campaignRecipient.findUnique({
    where: { id: params.recipientId },
    select: {
      id: true,
      channel: true,
      conversationId: true,
      contact: { select: { id: true, marketingOptIn: true, marketingOptOutAt: true } },
    },
  })
  if (!recipient) return
  if (!recipient.contact.marketingOptIn || recipient.contact.marketingOptOutAt) {
    await prisma.campaignRecipient.update({
      where: { id: recipient.id },
      data: { status: 'SKIPPED', errorCode: 'OPTED_OUT' },
    })
    return
  }
  if (!recipient.conversationId || !recipient.channel) {
    await prisma.campaignRecipient.update({
      where: { id: recipient.id },
      data: { status: 'SKIPPED', errorCode: 'NO_FROZEN_ROUTE' },
    })
    return
  }

  const conversation = await prisma.conversation.findFirst({
    where: {
      id: recipient.conversationId,
      workspaceId: params.workspaceId,
      contactId: recipient.contact.id,
      channel: recipient.channel,
      externalId: { not: null },
    },
    select: { id: true, agentId: true, channel: true, externalId: true },
  })
  if (!conversation) {
    await prisma.campaignRecipient.update({
      where: { id: recipient.id },
      data: { status: 'SKIPPED', errorCode: 'ROUTE_CHANGED' },
    })
    return
  }

  try {
    // sendOutbound re-checks active channel configuration and token safety.
    const delivery = await sendOutbound(
      conversation.agentId,
      conversation.channel,
      conversation.externalId,
      params.message,
    )
    if (delivery.status !== 'sent') {
      await prisma.campaignRecipient.update({
        where: { id: recipient.id },
        data: {
          status: delivery.status === 'failed' ? 'FAILED' : 'SKIPPED',
          errorCode: delivery.reason ?? 'CHANNEL_UNAVAILABLE',
        },
      })
      return
    }

    await prisma.$transaction(async (tx) => {
      await tx.message.create({
        data: {
          conversationId: conversation.id,
          role: 'ASSISTANT',
          content: params.message,
          metadata: { campaign: true, campaignId: params.campaignId, operator: true },
        },
      })
      await recordConversationActivity(tx, conversation.id, {
        kind: 'campaign_sent',
        source: 'dashboard',
      })
      await tx.conversation.update({
        where: { id: conversation.id },
        data: { messageCount: { increment: 1 }, lastMessageAt: new Date() },
      })
      await tx.campaignRecipient.update({
        where: { id: recipient.id },
        data: { status: 'SENT', sentAt: new Date(), errorCode: null },
      })
    })
  } catch {
    await prisma.campaignRecipient.update({
      where: { id: recipient.id },
      data: { status: 'FAILED', errorCode: 'PROVIDER_FAILED' },
    })
  }
}

export async function processCampaign(data: CampaignJobData): Promise<void> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: data.campaignId },
    select: { id: true, workspaceId: true, status: true, message: true },
  })
  if (!campaign || !['QUEUED', 'SENDING'].includes(campaign.status)) return

  if (campaign.status === 'QUEUED') {
    const started = await prisma.campaign.updateMany({
      where: { id: campaign.id, status: 'QUEUED' },
      data: { status: 'SENDING', startedAt: new Date() },
    })
    if (started.count !== 1) return
  }

  const recipients = await prisma.campaignRecipient.findMany({
    where: { campaignId: campaign.id, status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  const message = campaignDeliveryText(campaign.message)
  for (const recipient of recipients) {
    await processRecipient({
      campaignId: campaign.id,
      workspaceId: campaign.workspaceId,
      message,
      recipientId: recipient.id,
    })
    await waitForRateLimit()
  }

  // A prior worker may have stopped after provider delivery but before the DB
  // acknowledgement. Keep that recipient visible as uncertain, never retry it
  // automatically (avoids accidental duplicate messages).
  await prisma.campaignRecipient.updateMany({
    where: { campaignId: campaign.id, status: 'SENDING' },
    data: { status: 'FAILED', errorCode: 'DELIVERY_UNCERTAIN' },
  })
  const grouped = await prisma.campaignRecipient.groupBy({
    by: ['status'],
    where: { campaignId: campaign.id },
    _count: { _all: true },
  })
  const counts = Object.fromEntries(grouped.map((row) => [row.status, row._count._all]))
  const sentCount = counts.SENT ?? 0
  const failedCount = counts.FAILED ?? 0
  const skippedCount = counts.SKIPPED ?? 0
  const status = sentCount === 0
    ? 'FAILED'
    : failedCount > 0 || skippedCount > 0
      ? 'PARTIAL'
      : 'COMPLETED'
  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { status, sentCount, failedCount, skippedCount, completedAt: new Date() },
  })
}
