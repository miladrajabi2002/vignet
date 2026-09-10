import { prisma } from '@/lib/prisma'
import { displayPhone } from '@/lib/phone'
import type { ChatMessage } from '@/lib/ai/openrouter'
import type { WorkspaceVigentoContext } from '@/lib/vigento/access'

const DAY_MS = 86_400_000

function sinceDays(days: number): Date {
  return new Date(Date.now() - Math.max(1, days) * DAY_MS)
}

function safeText(value: string | null | undefined, maxLength = 1200): string | null {
  if (!value) return null
  return value
    .replace(new RegExp(String.fromCharCode(0), 'g'), '')
    .replace(/^\s*(system|assistant|user|developer)\s*:/gim, '$1 -')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength) || null
}

export class WorkspaceVigentoRepository {
  constructor(private readonly context: WorkspaceVigentoContext) {}

  async getOverview(days: number) {
    const since = sinceDays(days)
    const workspaceId = this.context.workspaceId
    const [workspace, conversations, messages, contacts, appointments, usage] = await Promise.all([
      prisma.workspace.findUniqueOrThrow({
        where: { id: workspaceId },
        select: { name: true, plan: true, businessType: true, aiCreditBalanceIRR: true },
      }),
      prisma.conversation.groupBy({
        by: ['status'],
        where: { workspaceId, createdAt: { gte: since } },
        _count: { _all: true },
      }),
      prisma.message.count({ where: { createdAt: { gte: since }, conversation: { workspaceId } } }),
      prisma.contact.count({ where: { workspaceId, createdAt: { gte: since } } }),
      prisma.appointment.count({
        where: { workspaceId, startsAt: { gte: since }, status: { in: ['PENDING', 'CONFIRMED'] } },
      }),
      prisma.usageLog.aggregate({
        where: { workspaceId, date: { gte: since }, status: 'CAPTURED' },
        _sum: { chargedIRR: true },
        _count: { _all: true },
      }),
    ])
    return {
      periodDays: days,
      workspace: {
        name: safeText(workspace.name, 120),
        plan: workspace.plan,
        businessType: workspace.businessType,
        creditToman: Math.round(workspace.aiCreditBalanceIRR / 10),
      },
      conversations: Object.fromEntries(conversations.map((row) => [row.status, row._count._all])),
      messages,
      newContacts: contacts,
      activeAppointments: appointments,
      ai: {
        requests: usage._count._all,
        chargedToman: Math.round((usage._sum.chargedIRR ?? 0) / 10),
      },
    }
  }

  async getAgentHealth(days: number) {
    const since = sinceDays(days)
    const rows = await prisma.agent.findMany({
      where: { workspaceId: this.context.workspaceId },
      orderBy: [{ active: 'desc' }, { updatedAt: 'desc' }],
      take: 30,
      select: {
        id: true,
        name: true,
        active: true,
        language: true,
        productAccessEnabled: true,
        orderTrackingEnabled: true,
        updatedAt: true,
        _count: {
          select: {
            conversations: { where: { createdAt: { gte: since } } },
            catalogItems: true,
            knowledgeBases: { where: { status: 'READY' } },
            channels: { where: { active: true } },
          },
        },
      },
    })
    return rows.map((row) => ({ ...row, name: safeText(row.name, 120) }))
  }

  async getConversationInsights(days: number) {
    const since = sinceDays(days)
    const workspaceId = this.context.workspaceId
    const [status, recent] = await Promise.all([
      prisma.conversation.groupBy({
        by: ['status'],
        where: { workspaceId, createdAt: { gte: since } },
        _count: { _all: true },
        _sum: { messageCount: true },
      }),
      prisma.conversation.findMany({
        where: { workspaceId, createdAt: { gte: since } },
        orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
        take: 12,
        select: {
          id: true,
          status: true,
          summary: true,
          messageCount: true,
          lastMessageAt: true,
          agent: { select: { name: true } },
          contact: { select: { name: true, instagramUsername: true } },
        },
      }),
    ])
    return {
      periodDays: days,
      status: status.map((row) => ({
        status: row.status,
        conversations: row._count._all,
        messages: row._sum.messageCount ?? 0,
      })),
      recent: recent.map((row) => ({
        id: row.id,
        status: row.status,
        messageCount: row.messageCount,
        lastMessageAt: row.lastMessageAt,
        summary: safeText(row.summary, 500),
        agent: safeText(row.agent.name, 120),
        customer: safeText(row.contact?.name || row.contact?.instagramUsername, 120),
      })),
    }
  }

  async getCustomerActivity(days: number) {
    const since = sinceDays(days)
    const rows = await prisma.contact.findMany({
      where: { workspaceId: this.context.workspaceId, lastActivityAt: { gte: since } },
      orderBy: { lastActivityAt: 'desc' },
      take: 12,
      select: {
        name: true,
        phone: true,
        instagramUsername: true,
        lastActivityAt: true,
        stage: true,
        _count: { select: { conversations: true, appointments: true } },
      },
    })
    return rows.map((row) => ({
      identity: safeText(row.name || row.instagramUsername || displayPhone(row.phone) || 'unknown', 120),
      stage: safeText(row.stage, 80),
      lastActivityAt: row.lastActivityAt,
      conversations: row._count.conversations,
      appointments: row._count.appointments,
    }))
  }

  async getBookingSummary(daysAhead: number) {
    const now = new Date()
    const until = new Date(now.getTime() + daysAhead * DAY_MS)
    const workspaceId = this.context.workspaceId
    const [services, appointments] = await Promise.all([
      prisma.service.findMany({
        where: { workspaceId, active: true },
        orderBy: { createdAt: 'asc' },
        take: 30,
        select: { id: true, name: true, durationMinutes: true, timezone: true, location: true },
      }),
      prisma.appointment.findMany({
        where: {
          workspaceId,
          startsAt: { gte: now, lte: until },
          status: { in: ['PENDING', 'CONFIRMED'] },
        },
        orderBy: { startsAt: 'asc' },
        take: 30,
        select: {
          startsAt: true,
          endsAt: true,
          status: true,
          partySize: true,
          service: { select: { name: true } },
        },
      }),
    ])
    return {
      daysAhead,
      services: services.map((service) => ({
        ...service,
        name: safeText(service.name, 120),
        location: safeText(service.location, 160),
      })),
      appointments: appointments.map((appointment) => ({
        ...appointment,
        service: safeText(appointment.service.name, 120),
      })),
    }
  }

  async getStoreHealth() {
    const workspaceId = this.context.workspaceId
    const [products, activeProducts, outOfStock, orders, integrations] = await Promise.all([
      prisma.product.count({ where: { workspaceId } }),
      prisma.product.count({ where: { workspaceId, active: true } }),
      prisma.product.count({ where: { workspaceId, active: true, stock: 0 } }),
      prisma.storeOrder.groupBy({ by: ['status'], where: { workspaceId }, _count: { _all: true } }),
      prisma.storeIntegration.findMany({
        where: { workspaceId },
        orderBy: { updatedAt: 'desc' },
        take: 10,
        select: {
          type: true,
          active: true,
          connectedAt: true,
          lastSyncAt: true,
          lastSyncStatus: true,
          lastWebhookAt: true,
          pluginVersion: true,
        },
      }),
    ])
    return {
      products: { total: products, active: activeProducts, outOfStock },
      orders: Object.fromEntries(orders.map((row) => [row.status, row._count._all])),
      integrations,
    }
  }

  async searchProducts(
    query: string,
    inventory: 'ANY' | 'AVAILABLE' | 'OUT_OF_STOCK',
    limit: number,
  ) {
    const normalized = query.replace(/\s+/g, ' ').trim()
    const rows = await prisma.product.findMany({
      where: {
        workspaceId: this.context.workspaceId,
        active: true,
        ...(inventory === 'AVAILABLE'
          ? { OR: [{ stock: null }, { stock: { gt: 0 } }] }
          : inventory === 'OUT_OF_STOCK'
            ? { stock: 0 }
            : {}),
        ...(normalized
          ? {
              AND: [{
                OR: [
                  { name: { contains: normalized, mode: 'insensitive' as const } },
                  { sku: { contains: normalized, mode: 'insensitive' as const } },
                  { description: { contains: normalized, mode: 'insensitive' as const } },
                ],
              }],
            }
          : {}),
      },
      orderBy: [{ queryCount: 'desc' }, { updatedAt: 'desc' }],
      take: Math.min(Math.max(limit, 1), 20),
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        comparePrice: true,
        stock: true,
        sku: true,
        tags: true,
        attributes: true,
        updatedAt: true,
        category: { select: { name: true } },
      },
    })
    return rows.map((row) => ({
      ...row,
      name: safeText(row.name, 180),
      description: safeText(row.description, 500),
      sku: safeText(row.sku, 120),
      tags: row.tags.slice(0, 20).flatMap((tag) => {
        const value = safeText(tag, 100)
        return value ? [value] : []
      }),
      attributes: row.attributes ? safeText(JSON.stringify(row.attributes), 1000) : null,
      category: safeText(row.category?.name, 120),
    }))
  }

  async getUsage(days: number) {
    const since = sinceDays(days)
    const workspaceId = this.context.workspaceId
    const [total, byType] = await Promise.all([
      prisma.usageLog.aggregate({
        where: { workspaceId, date: { gte: since }, status: 'CAPTURED' },
        _sum: { chargedIRR: true, promptTokens: true, completionTokens: true },
        _count: { _all: true },
      }),
      prisma.usageLog.groupBy({
        by: ['type'],
        where: { workspaceId, date: { gte: since }, status: 'CAPTURED' },
        _sum: { chargedIRR: true },
        _count: { _all: true },
      }),
    ])
    return {
      periodDays: days,
      requests: total._count._all,
      chargedToman: Math.round((total._sum.chargedIRR ?? 0) / 10),
      promptTokens: total._sum.promptTokens ?? 0,
      completionTokens: total._sum.completionTokens ?? 0,
      byType: byType.map((row) => ({
        type: row.type,
        requests: row._count._all,
        chargedToman: Math.round((row._sum.chargedIRR ?? 0) / 10),
      })),
    }
  }

  async getKnowledgeStatus() {
    const rows = await prisma.knowledgeBase.findMany({
      where: { workspaceId: this.context.workspaceId },
      orderBy: { updatedAt: 'desc' },
      take: 80,
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        chunkCount: true,
        lastIngestedAt: true,
        updatedAt: true,
        agent: { select: { name: true } },
      },
    })
    return rows.map((row) => ({
      ...row,
      name: safeText(row.name, 160),
      agent: safeText(row.agent.name, 120),
    }))
  }

  async inspectKnowledge(knowledgeBaseId: string) {
    const row = await prisma.knowledgeBase.findFirst({
      where: { id: knowledgeBaseId, workspaceId: this.context.workspaceId },
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        chunkCount: true,
        lastIngestedAt: true,
        agent: { select: { name: true } },
        chunks: {
          orderBy: { createdAt: 'asc' },
          take: 8,
          select: { content: true },
        },
      },
    })
    if (!row) return { error: 'NOT_FOUND' as const }
    return {
      id: row.id,
      name: safeText(row.name, 160),
      type: row.type,
      status: row.status,
      chunkCount: row.chunkCount,
      lastIngestedAt: row.lastIngestedAt,
      agent: safeText(row.agent.name, 120),
      excerpts: row.chunks.map((chunk) => safeText(chunk.content, 1200)),
    }
  }

  async inspectConversation(conversationId: string) {
    const row = await prisma.conversation.findFirst({
      where: { id: conversationId, workspaceId: this.context.workspaceId },
      select: {
        id: true,
        status: true,
        handedOff: true,
        channel: true,
        summary: true,
        messageCount: true,
        createdAt: true,
        lastMessageAt: true,
        agent: { select: { name: true } },
        contact: { select: { name: true, instagramUsername: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 12,
          select: { role: true, content: true, createdAt: true },
        },
      },
    })
    if (!row) return { error: 'NOT_FOUND' as const }
    return {
      id: row.id,
      status: row.status,
      handedOff: row.handedOff,
      channel: row.channel,
      summary: safeText(row.summary, 800),
      messageCount: row.messageCount,
      createdAt: row.createdAt,
      lastMessageAt: row.lastMessageAt,
      agent: safeText(row.agent.name, 120),
      customer: safeText(row.contact?.name || row.contact?.instagramUsername, 120),
      messages: row.messages.reverse().map((message) => ({
        ...message,
        content: safeText(message.content, 1200),
      })),
    }
  }

  async loadHistory(limit = 18): Promise<ChatMessage[]> {
    if (this.context.impersonated) return []
    const thread = await prisma.workspaceVigentoThread.findUnique({
      where: {
        workspaceId_actorId: {
          workspaceId: this.context.workspaceId,
          actorId: this.context.actorId,
        },
      },
      select: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: Math.min(Math.max(limit, 1), 40),
          select: { role: true, content: true },
        },
      },
    })
    if (!thread) return []
    return thread.messages.reverse().map((message) => ({
      role: message.role === 'USER' ? 'user' : 'assistant',
      content: message.content.slice(-6000),
    }))
  }

  async saveMessage(role: 'USER' | 'ASSISTANT', content: string): Promise<void> {
    if (this.context.impersonated || !content.trim()) return
    const thread = await prisma.workspaceVigentoThread.upsert({
      where: {
        workspaceId_actorId: {
          workspaceId: this.context.workspaceId,
          actorId: this.context.actorId,
        },
      },
      create: { workspaceId: this.context.workspaceId, actorId: this.context.actorId },
      update: {},
      select: { id: true },
    })
    await prisma.workspaceVigentoMessage.create({
      data: { threadId: thread.id, role, content: content.trim().slice(0, 20_000) },
    })
    const stale = await prisma.workspaceVigentoMessage.findMany({
      where: { threadId: thread.id },
      orderBy: { createdAt: 'desc' },
      skip: 80,
      select: { id: true },
    })
    if (stale.length) {
      await prisma.workspaceVigentoMessage.deleteMany({
        where: { threadId: thread.id, id: { in: stale.map((message) => message.id) } },
      })
    }
  }

  async clearHistory(): Promise<void> {
    if (this.context.impersonated) return
    await prisma.workspaceVigentoThread.deleteMany({
      where: { workspaceId: this.context.workspaceId, actorId: this.context.actorId },
    })
  }
}
