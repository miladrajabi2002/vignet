import crypto from 'crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ADMIN_OWNER_PHONE } from '@/lib/admin/auth'

export type AdminActionPayload =
  | {
      kind: 'ADJUST_CREDIT'
      workspaceId: string
      workspaceName: string
      amountIRR: number
      reason: string
      expiresAt: number
      nonce: string
    }
  | {
      kind: 'RESOLVE_CONVERSATION'
      conversationId: string
      workspaceId: string
      label: string
      reason: string
      expiresAt: number
      nonce: string
    }
  | {
      kind: 'UPDATE_WORKSPACE'
      workspaceId: string
      workspaceName: string
      nextName?: string
      nextPlan?: 'TRIAL' | 'STARTER' | 'PRO' | 'BUSINESS'
      reason: string
      expiresAt: number
      nonce: string
    }
  | {
      kind: 'SET_AGENT_ACTIVE'
      agentId: string
      workspaceId: string
      label: string
      active: boolean
      reason: string
      expiresAt: number
      nonce: string
    }
  | {
      kind: 'CREATE_WORKSPACE_MEMBER'
      workspaceId: string
      workspaceName: string
      phone: string
      name: string
      role: 'ADMIN' | 'MEMBER'
      reason: string
      expiresAt: number
      nonce: string
    }
  | {
      kind: 'UPDATE_WORKSPACE_MEMBER'
      userId: string
      workspaceId: string
      label: string
      nextName?: string
      nextRole?: 'ADMIN' | 'MEMBER'
      reason: string
      expiresAt: number
      nonce: string
    }
  | {
      kind: 'DELETE_WORKSPACE_MEMBER'
      userId: string
      workspaceId: string
      label: string
      reason: string
      expiresAt: number
      nonce: string
    }

type AdminActionInput =
  | Omit<Extract<AdminActionPayload, { kind: 'ADJUST_CREDIT' }>, 'expiresAt' | 'nonce'>
  | Omit<Extract<AdminActionPayload, { kind: 'RESOLVE_CONVERSATION' }>, 'expiresAt' | 'nonce'>
  | Omit<Extract<AdminActionPayload, { kind: 'UPDATE_WORKSPACE' }>, 'expiresAt' | 'nonce'>
  | Omit<Extract<AdminActionPayload, { kind: 'SET_AGENT_ACTIVE' }>, 'expiresAt' | 'nonce'>
  | Omit<Extract<AdminActionPayload, { kind: 'CREATE_WORKSPACE_MEMBER' }>, 'expiresAt' | 'nonce'>
  | Omit<Extract<AdminActionPayload, { kind: 'UPDATE_WORKSPACE_MEMBER' }>, 'expiresAt' | 'nonce'>
  | Omit<Extract<AdminActionPayload, { kind: 'DELETE_WORKSPACE_MEMBER' }>, 'expiresAt' | 'nonce'>

function secret(): string {
  const value = process.env.ADMIN_SESSION_SECRET || process.env.AUTH_SECRET
  if (!value) throw new Error('ADMIN_SESSION_SECRET_NOT_SET')
  return value
}

function signature(encoded: string): string {
  return crypto.createHmac('sha256', secret()).update(encoded).digest('base64url')
}

export function createAdminActionToken(
  payload: AdminActionInput,
): string {
  const complete = {
    ...payload,
    expiresAt: Date.now() + 10 * 60_000,
    nonce: crypto.randomUUID(),
  } as AdminActionPayload
  const encoded = Buffer.from(JSON.stringify(complete), 'utf8').toString('base64url')
  return `${encoded}.${signature(encoded)}`
}

export function verifyAdminActionToken(token: string): AdminActionPayload {
  const [encoded, supplied] = token.split('.')
  if (!encoded || !supplied) throw new Error('INVALID_ACTION_TOKEN')
  const expected = Buffer.from(signature(encoded))
  const actual = Buffer.from(supplied)
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    throw new Error('INVALID_ACTION_TOKEN')
  }
  const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as AdminActionPayload
  if (!payload || payload.expiresAt < Date.now() || !payload.nonce) throw new Error('ACTION_TOKEN_EXPIRED')
  return payload
}

export async function executeAdminAction(token: string) {
  const payload = verifyAdminActionToken(token)
  const grantKey = `admin-vigento:${payload.nonce}`

  if (payload.kind === 'ADJUST_CREDIT') {
    if (!Number.isInteger(payload.amountIRR) || payload.amountIRR === 0 || Math.abs(payload.amountIRR) > 5_000_000_000) {
      throw new Error('INVALID_AMOUNT')
    }
    return prisma.$transaction(async (tx) => {
      const alreadyDone = await tx.walletLedger.findUnique({ where: { grantKey } })
      if (alreadyDone) return { kind: payload.kind, alreadyDone: true, balanceAfterIRR: alreadyDone.balanceAfterIRR }
      const workspace = await tx.workspace.findUnique({ where: { id: payload.workspaceId }, select: { aiCreditBalanceIRR: true, name: true } })
      if (!workspace) throw new Error('WORKSPACE_NOT_FOUND')
      const nextBalance = workspace.aiCreditBalanceIRR + payload.amountIRR
      if (nextBalance < 0) throw new Error('INSUFFICIENT_CREDIT')
      await tx.workspace.update({ where: { id: payload.workspaceId }, data: { aiCreditBalanceIRR: nextBalance } })
      await tx.walletLedger.create({
        data: {
          workspaceId: payload.workspaceId,
          grantKey,
          type: 'ADMIN_ADJUSTMENT',
          amountIRR: payload.amountIRR,
          balanceAfterIRR: nextBalance,
          note: `Vigento admin: ${payload.reason}`.slice(0, 240),
        },
      })
      await tx.adminAuditLog.create({
        data: {
          adminPhone: ADMIN_OWNER_PHONE || 'unconfigured',
          action: payload.kind,
          targetType: 'Workspace',
          targetId: payload.workspaceId,
          payload: {
            amountIRR: payload.amountIRR,
            balanceBeforeIRR: workspace.aiCreditBalanceIRR,
            balanceAfterIRR: nextBalance,
            reason: payload.reason,
            nonce: payload.nonce,
          } as Prisma.InputJsonValue,
        },
      })
      return { kind: payload.kind, workspaceName: workspace.name, balanceAfterIRR: nextBalance }
    })
  }

  if (payload.kind === 'UPDATE_WORKSPACE') {
    if (!payload.nextName && !payload.nextPlan) throw new Error('NO_WORKSPACE_CHANGE')
    return prisma.$transaction(async (tx) => {
      const alreadyDone = await tx.adminAuditLog.findFirst({ where: { action: payload.kind, targetId: payload.workspaceId, payload: { path: ['nonce'], equals: payload.nonce } } })
      if (alreadyDone) return { kind: payload.kind, alreadyDone: true }
      const workspace = await tx.workspace.findUnique({ where: { id: payload.workspaceId }, select: { name: true, plan: true } })
      if (!workspace) throw new Error('WORKSPACE_NOT_FOUND')
      const updated = await tx.workspace.update({ where: { id: payload.workspaceId }, data: { ...(payload.nextName ? { name: payload.nextName } : {}), ...(payload.nextPlan ? { plan: payload.nextPlan } : {}) }, select: { id: true, name: true, plan: true } })
      await tx.adminAuditLog.create({ data: { adminPhone: ADMIN_OWNER_PHONE || 'unconfigured', action: payload.kind, targetType: 'Workspace', targetId: payload.workspaceId, payload: { before: workspace, after: updated, reason: payload.reason, nonce: payload.nonce } as Prisma.InputJsonValue } })
      return { kind: payload.kind, workspace: updated }
    })
  }

  if (payload.kind === 'SET_AGENT_ACTIVE') {
    return prisma.$transaction(async (tx) => {
      const alreadyDone = await tx.adminAuditLog.findFirst({ where: { action: payload.kind, targetId: payload.agentId, payload: { path: ['nonce'], equals: payload.nonce } } })
      if (alreadyDone) return { kind: payload.kind, alreadyDone: true }
      const agent = await tx.agent.findFirst({ where: { id: payload.agentId, workspaceId: payload.workspaceId }, select: { id: true, name: true, active: true } })
      if (!agent) throw new Error('AGENT_NOT_FOUND')
      const updated = await tx.agent.update({ where: { id: agent.id }, data: { active: payload.active }, select: { id: true, name: true, active: true } })
      await tx.adminAuditLog.create({ data: { adminPhone: ADMIN_OWNER_PHONE || 'unconfigured', action: payload.kind, targetType: 'Agent', targetId: payload.agentId, payload: { previousActive: agent.active, active: updated.active, reason: payload.reason, nonce: payload.nonce } as Prisma.InputJsonValue } })
      return { kind: payload.kind, agent: updated }
    })
  }

  if (payload.kind === 'CREATE_WORKSPACE_MEMBER') {
    return prisma.$transaction(async (tx) => {
      const alreadyDone = await tx.adminAuditLog.findFirst({ where: { action: payload.kind, targetId: payload.workspaceId, payload: { path: ['nonce'], equals: payload.nonce } } })
      if (alreadyDone) return { kind: payload.kind, alreadyDone: true }
      const workspace = await tx.workspace.findUnique({ where: { id: payload.workspaceId }, select: { id: true, name: true } })
      if (!workspace) throw new Error('WORKSPACE_NOT_FOUND')
      const existing = await tx.user.findUnique({ where: { phone: payload.phone }, select: { id: true } })
      if (existing) throw new Error('PHONE_ALREADY_EXISTS')
      const user = await tx.user.create({ data: { workspaceId: payload.workspaceId, phone: payload.phone, name: payload.name, role: payload.role, platformRole: 'USER' }, select: { id: true, phone: true, name: true, role: true, platformRole: true } })
      await tx.adminAuditLog.create({ data: { adminPhone: ADMIN_OWNER_PHONE || 'unconfigured', action: payload.kind, targetType: 'User', targetId: user.id, payload: { workspaceId: payload.workspaceId, phone: payload.phone, name: payload.name, role: payload.role, platformRole: 'USER', reason: payload.reason, nonce: payload.nonce } as Prisma.InputJsonValue } })
      return { kind: payload.kind, user }
    })
  }

  if (payload.kind === 'UPDATE_WORKSPACE_MEMBER') {
    if (!payload.nextName && !payload.nextRole) throw new Error('NO_MEMBER_CHANGE')
    return prisma.$transaction(async (tx) => {
      const alreadyDone = await tx.adminAuditLog.findFirst({ where: { action: payload.kind, targetId: payload.userId, payload: { path: ['nonce'], equals: payload.nonce } } })
      if (alreadyDone) return { kind: payload.kind, alreadyDone: true }
      const user = await tx.user.findFirst({ where: { id: payload.userId, workspaceId: payload.workspaceId }, select: { id: true, name: true, phone: true, role: true, platformRole: true } })
      if (!user) throw new Error('USER_NOT_FOUND')
      if (user.platformRole === 'ADMIN' || user.role === 'OWNER') throw new Error('PROTECTED_USER')
      const updated = await tx.user.update({ where: { id: user.id }, data: { ...(payload.nextName ? { name: payload.nextName } : {}), ...(payload.nextRole ? { role: payload.nextRole } : {}) }, select: { id: true, name: true, phone: true, role: true, platformRole: true } })
      await tx.adminAuditLog.create({ data: { adminPhone: ADMIN_OWNER_PHONE || 'unconfigured', action: payload.kind, targetType: 'User', targetId: user.id, payload: { before: user, after: updated, reason: payload.reason, nonce: payload.nonce } as Prisma.InputJsonValue } })
      return { kind: payload.kind, user: updated }
    })
  }

  if (payload.kind === 'DELETE_WORKSPACE_MEMBER') {
    return prisma.$transaction(async (tx) => {
      const alreadyDone = await tx.adminAuditLog.findFirst({ where: { action: payload.kind, targetId: payload.userId, payload: { path: ['nonce'], equals: payload.nonce } } })
      if (alreadyDone) return { kind: payload.kind, alreadyDone: true }
      const user = await tx.user.findFirst({ where: { id: payload.userId, workspaceId: payload.workspaceId }, select: { id: true, name: true, phone: true, role: true, platformRole: true } })
      if (!user) throw new Error('USER_NOT_FOUND')
      if (user.platformRole === 'ADMIN') throw new Error('PROTECTED_USER')
      const replacementOwner = user.role === 'OWNER'
        ? await tx.user.findFirst({
            where: { workspaceId: payload.workspaceId, id: { not: user.id }, platformRole: 'USER' },
            orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
            select: { id: true, name: true, phone: true, role: true },
          })
        : null
      if (replacementOwner) {
        await tx.user.update({ where: { id: replacementOwner.id }, data: { role: 'OWNER' } })
      }
      await tx.user.delete({ where: { id: user.id } })
      await tx.adminAuditLog.create({ data: { adminPhone: ADMIN_OWNER_PHONE || 'unconfigured', action: payload.kind, targetType: 'User', targetId: user.id, payload: { deleted: user, replacementOwner: replacementOwner ? { ...replacementOwner, role: 'OWNER' } : null, workspaceDataPreserved: true, reason: payload.reason, nonce: payload.nonce } as Prisma.InputJsonValue } })
      return { kind: payload.kind, label: payload.label, replacementOwner: replacementOwner ? { ...replacementOwner, role: 'OWNER' as const } : null }
    })
  }

  return prisma.$transaction(async (tx) => {
    const alreadyDone = await tx.adminAuditLog.findFirst({
      where: { action: payload.kind, targetId: payload.conversationId, payload: { path: ['nonce'], equals: payload.nonce } },
    })
    if (alreadyDone) return { kind: payload.kind, alreadyDone: true }
    const conversation = await tx.conversation.findFirst({
      where: { id: payload.conversationId, workspaceId: payload.workspaceId },
      select: { id: true, status: true },
    })
    if (!conversation) throw new Error('CONVERSATION_NOT_FOUND')
    await tx.conversation.update({
      where: { id: conversation.id },
      data: { status: 'RESOLVED', handedOff: false },
    })
    await tx.handoffAlert.updateMany({
      where: { conversationId: conversation.id, state: { in: ['open', 'claimed'] } },
      data: { state: 'resolved', resolvedAt: new Date() },
    })
    await tx.adminAuditLog.create({
      data: {
        adminPhone: ADMIN_OWNER_PHONE || 'unconfigured',
        action: payload.kind,
        targetType: 'Conversation',
        targetId: payload.conversationId,
        payload: { previousStatus: conversation.status, reason: payload.reason, nonce: payload.nonce } as Prisma.InputJsonValue,
      },
    })
    return { kind: payload.kind, label: payload.label }
  })
}
