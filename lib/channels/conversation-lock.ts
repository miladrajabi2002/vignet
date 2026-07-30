import crypto from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

/**
 * Durable, fenced per-conversation serialization.
 *
 * Redis TTL locks could disappear during an outage and the previous
 * implementation deliberately proceeded without a lock after 25 seconds.
 * This lease lives beside the conversation effects in PostgreSQL, is renewed
 * during slow model calls, and never lets a waiter run unlocked.
 */

const DEFAULT_LEASE_MS = 45_000
const DEFAULT_HEARTBEAT_MS = 10_000
// One wait spans the full lease, so a crash is recoverable even on a queue
// job's final configured attempt.
const DEFAULT_WAIT_TIMEOUT_MS = 55_000
const DEFAULT_POLL_MS = 250

export interface ConversationTurnLeaseInput {
  workspaceId: string
  channelId: string
  conversationKey: string
  eventId: string
}

export interface ConversationTurnLeaseOptions {
  leaseMs?: number
  heartbeatMs?: number
  waitTimeoutMs?: number
  pollMs?: number
}

export interface ConversationTurnLease {
  id: string
  workspaceId: string
  channelId: string
  conversationKey: string
  leaseOwner: string
  fencingToken: number
  leaseExpiresAt: Date
  eventId: string | null
}

export interface ConversationTurnLeaseGuard {
  readonly lease: ConversationTurnLease
  assertActive(): Promise<void>
}

export class ConversationTurnLeaseBusyError extends Error {
  constructor(scope: string) {
    super(`Conversation turn lease is busy: ${scope}`)
    this.name = 'ConversationTurnLeaseBusyError'
  }
}

export class ConversationTurnLeaseLostError extends Error {
  constructor(scope: string) {
    super(`Conversation turn lease is no longer current: ${scope}`)
    this.name = 'ConversationTurnLeaseLostError'
  }
}

function isUniqueConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError
      ? error.code === 'P2002'
      : !!error && typeof error === 'object' && 'code' in error && error.code === 'P2002'
  )
}

const leaseSelect = {
  id: true,
  workspaceId: true,
  channelId: true,
  conversationKey: true,
  leaseOwner: true,
  fencingToken: true,
  leaseExpiresAt: true,
  eventId: true,
} satisfies Prisma.ConversationTurnLeaseSelect

type SelectedLease = Prisma.ConversationTurnLeaseGetPayload<{ select: typeof leaseSelect }>

function currentLease(row: SelectedLease): ConversationTurnLease {
  if (!row.leaseOwner || !row.leaseExpiresAt) {
    throw new ConversationTurnLeaseLostError(
      `${row.workspaceId}:${row.channelId}:${row.conversationKey}`,
    )
  }
  return {
    ...row,
    leaseOwner: row.leaseOwner,
    leaseExpiresAt: row.leaseExpiresAt,
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Atomically acquire/reclaim a thread lease, waiting briefly but never bypassing it. */
export async function acquireConversationTurnLease(
  input: ConversationTurnLeaseInput,
  options: ConversationTurnLeaseOptions = {},
): Promise<ConversationTurnLease> {
  const leaseMs = options.leaseMs ?? DEFAULT_LEASE_MS
  const waitTimeoutMs = options.waitTimeoutMs ?? DEFAULT_WAIT_TIMEOUT_MS
  const pollMs = options.pollMs ?? DEFAULT_POLL_MS
  const deadline = Date.now() + waitTimeoutMs
  const leaseOwner = crypto.randomUUID()
  const scope = `${input.workspaceId}:${input.channelId}:${input.conversationKey}`

  for (;;) {
    const now = new Date()
    const leaseExpiresAt = new Date(now.getTime() + leaseMs)
    try {
      const created = await prisma.conversationTurnLease.create({
        data: {
          id: crypto.randomUUID(),
          ...input,
          leaseOwner,
          fencingToken: 1,
          leaseExpiresAt,
        },
        select: leaseSelect,
      })
      return currentLease(created)
    } catch (error) {
      if (!isUniqueConflict(error)) throw error
    }

    const reclaimed = await prisma.conversationTurnLease.updateMany({
      where: {
        workspaceId: input.workspaceId,
        channelId: input.channelId,
        conversationKey: input.conversationKey,
        OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: now } }],
      },
      data: {
        leaseOwner,
        fencingToken: { increment: 1 },
        leaseExpiresAt,
        eventId: input.eventId,
      },
    })
    if (reclaimed.count === 1) {
      const row = await prisma.conversationTurnLease.findUnique({
        where: {
          workspaceId_channelId_conversationKey: {
            workspaceId: input.workspaceId,
            channelId: input.channelId,
            conversationKey: input.conversationKey,
          },
        },
        select: leaseSelect,
      })
      if (row?.leaseOwner === leaseOwner) return currentLease(row)
      if (row) throw new ConversationTurnLeaseLostError(scope)
    }

    if (Date.now() >= deadline) throw new ConversationTurnLeaseBusyError(scope)
    await sleep(Math.max(1, pollMs))
  }
}

async function renewConversationTurnLease(
  lease: ConversationTurnLease,
  leaseMs: number,
): Promise<boolean> {
  const now = new Date()
  const result = await prisma.conversationTurnLease.updateMany({
    where: {
      id: lease.id,
      leaseOwner: lease.leaseOwner,
      fencingToken: lease.fencingToken,
      leaseExpiresAt: { gt: now },
    },
    data: { leaseExpiresAt: new Date(now.getTime() + leaseMs) },
  })
  return result.count === 1
}

export async function assertConversationTurnLease(
  lease: ConversationTurnLease,
): Promise<void> {
  const count = await prisma.conversationTurnLease.count({
    where: {
      id: lease.id,
      leaseOwner: lease.leaseOwner,
      fencingToken: lease.fencingToken,
      leaseExpiresAt: { gt: new Date() },
    },
  })
  if (count !== 1) {
    throw new ConversationTurnLeaseLostError(
      `${lease.workspaceId}:${lease.channelId}:${lease.conversationKey}`,
    )
  }
}

/** Conditional release: an expired owner cannot clear its successor's lease. */
export async function releaseConversationTurnLease(
  lease: ConversationTurnLease,
): Promise<void> {
  await prisma.conversationTurnLease.updateMany({
    where: {
      id: lease.id,
      leaseOwner: lease.leaseOwner,
      fencingToken: lease.fencingToken,
    },
    data: {
      leaseOwner: null,
      leaseExpiresAt: new Date(),
      eventId: null,
    },
  })
}

export async function withConversationTurnLock<T>(
  input: ConversationTurnLeaseInput,
  operation: (guard: ConversationTurnLeaseGuard) => Promise<T>,
  options: ConversationTurnLeaseOptions = {},
): Promise<T> {
  const leaseMs = options.leaseMs ?? DEFAULT_LEASE_MS
  const heartbeatMs = options.heartbeatMs ?? DEFAULT_HEARTBEAT_MS
  const lease = await acquireConversationTurnLease(input, options)
  let lost = false
  let renewing = false
  const timer = setInterval(() => {
    if (renewing || lost) return
    renewing = true
    void renewConversationTurnLease(lease, leaseMs)
      .then((ok) => {
        if (!ok) lost = true
      })
      .catch(() => {
        lost = true
      })
      .finally(() => {
        renewing = false
      })
  }, heartbeatMs)
  timer.unref?.()

  const guard: ConversationTurnLeaseGuard = {
    lease,
    async assertActive() {
      if (lost) {
        throw new ConversationTurnLeaseLostError(
          `${lease.workspaceId}:${lease.channelId}:${lease.conversationKey}`,
        )
      }
      await assertConversationTurnLease(lease)
    },
  }

  try {
    const result = await operation(guard)
    await guard.assertActive()
    return result
  } finally {
    clearInterval(timer)
    await releaseConversationTurnLease(lease).catch(() => {})
  }
}
