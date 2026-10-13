/**
 * Free-form live probe: run any conversation against any tenant's agent with
 * the working-tree code, without deploying and without charging the tenant.
 *
 * Same isolation as agent-eval.live.ts (real model, catalog and store quote;
 * mocked wallet, plan gate and notifications; every conversation, order draft
 * and message created here is hard-deleted afterwards).
 *
 *   PROBE_FILE=/path/scenarios.json PROBE_AGENT_ID=<agent id> \
 *     npx vitest run -c vitest.live.config.ts tests-live/probe.live.ts
 *
 * scenarios.json: [{ "id": "s1", "turns": ["سلام", "رژگونه زیر ۲ میلیون"] }]
 * Optional per scenario: "channel" (default TELEGRAM).
 * Output: PROBE_OUT (default tests-live/results/probe.json) and the console.
 */
import { afterAll, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

vi.mock('@/lib/billing/ai-credits', () => ({
  reserveChatCredit: vi.fn(async () => ({
    ok: true,
    reservation: { usageLogId: 'probe', chargeIRR: 0, balanceAfterIRR: 0, modelAlias: 'fast' },
  })),
  captureChatCredit: vi.fn(async () => {}),
  releaseChatCredit: vi.fn(async () => {}),
}))
vi.mock('@/lib/billing/entitlements', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  checkChatAllowed: vi.fn(async () => ({ allowed: true, plan: 'PRO' })),
}))
vi.mock('@/lib/notifications/create', () => ({ notifyWorkspace: vi.fn(async () => {}) }))
vi.mock('@/lib/billing/trial-quota-alert', () => ({ processTrialQuotaAlert: vi.fn(async () => ({})) }))
vi.mock('@/lib/onboarding', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  syncOnboarding: vi.fn(async () => {}),
}))
vi.mock('@/lib/ai/handoff', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  notifyHandoff: vi.fn(async () => {}),
}))

import { prisma } from '@/lib/prisma'
import { generateReply } from '@/lib/ai/chat-engine'
import type { ChatAgent } from '@/lib/ai/chat-types'
import { PrismaClient, type ChannelType } from '@prisma/client'

const PROBE_FILE = process.env.PROBE_FILE ?? ''
const AGENT_ID = process.env.PROBE_AGENT_ID ?? ''
const OUT = process.env.PROBE_OUT ?? path.join(__dirname, 'results', 'probe.json')
const RUN = `vprobe-${Date.now().toString(36)}`

type Scenario = { id: string; turns: string[]; channel?: ChannelType }
type TurnOut = { user: string; reply: string; ms: number; understanding?: unknown; error?: string }

const display = (reply: string) => reply
  .replace(/\[\[product:(\{[^\n]*?\})\]\]/g, (_, json: string) => {
    try { const card = JSON.parse(json) as { name?: string; price?: string; badge?: string }; return `  ▣ ${card.name} | ${card.price} | ${card.badge ?? ''}` } catch { return '  ▣ ?' }
  })
  .replace(/\[\[checkout:(\{[^\n]*?\})\]\]/g, (_, json: string) => {
    try { const card = JSON.parse(json) as { code?: string; total?: number; shipping?: unknown; url?: string }; return `  ▣ CHECKOUT ${card.code} total=${card.total} shipping=${JSON.stringify(card.shipping)} url=${card.url}` } catch { return '  ▣ CHECKOUT ?' }
  })

describe.skipIf(!PROBE_FILE || !AGENT_ID)('live probe', () => {
  const conversationIds = new Set<string>()

  afterAll(async () => {
    const raw = new PrismaClient()
    try {
      const rows = await raw.conversation.findMany({ where: { agentId: AGENT_ID, externalId: { startsWith: RUN } }, select: { id: true } })
      const ids = [...new Set([...conversationIds, ...rows.map((row) => row.id)])]
      if (ids.length) await raw.conversation.deleteMany({ where: { id: { in: ids }, agentId: AGENT_ID } })
    } finally {
      await raw.$disconnect()
    }
  })

  it('runs the scenarios', async () => {
    const scenarios = JSON.parse(fs.readFileSync(PROBE_FILE, 'utf8')) as Scenario[]
    const agent = (await prisma.agent.findUniqueOrThrow({ where: { id: AGENT_ID } })) as unknown as ChatAgent & { workspaceId: string }
    const out: Array<{ id: string; turns: TurnOut[] }> = []
    for (const scenario of scenarios) {
      const record = { id: scenario.id, turns: [] as TurnOut[] }
      out.push(record)
      const channel = scenario.channel ?? 'TELEGRAM'
      console.log(`\n══ ${scenario.id} ══`)
      for (const message of scenario.turns) {
        const started = Date.now()
        const turnOut: TurnOut = { user: message, reply: '', ms: 0 }
        record.turns.push(turnOut)
        try {
          const result = await generateReply({
            workspaceId: agent.workspaceId,
            agent,
            message,
            channel,
            externalId: `${RUN}-${scenario.id}`,
          })
          if ('conversationId' in result && result.conversationId) conversationIds.add(result.conversationId)
          if ('error' in result) turnOut.error = JSON.stringify(result)
          else turnOut.reply = result.reply
          if ('conversationId' in result && result.conversationId) {
            const log = await prisma.turnUnderstandingLog.findFirst({
              where: { conversationId: result.conversationId },
              orderBy: { createdAt: 'desc' },
              select: { status: true, errorCode: true, understanding: true },
            }).catch(() => null)
            turnOut.understanding = log ? (log.status === 'ok' ? (log.understanding as { acts?: unknown } | null)?.acts : `${log.status}:${log.errorCode}`) : null
          }
        } catch (error) {
          turnOut.error = error instanceof Error ? error.message : String(error)
        }
        turnOut.ms = Date.now() - started
        console.log(`>>> ${message}\n    [${JSON.stringify(turnOut.understanding)}]\n<<< (${turnOut.ms}ms) ${turnOut.error ?? display(turnOut.reply)}\n`)
        // Fire-and-forget side effects (state persist, fact capture) settle here.
        await new Promise((resolve) => setTimeout(resolve, 900))
      }
    }
    fs.mkdirSync(path.dirname(OUT), { recursive: true })
    fs.writeFileSync(OUT, JSON.stringify(out, null, 1))
    expect(out.length).toBe(scenarios.length)
  })
})

it('probe sanity', () => expect(true).toBe(true))
