import path from 'path'
import { readFile } from 'fs/promises'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { isAdminAuthed } from '@/lib/admin/auth'
import { rateLimit } from '@/lib/ratelimit'
import { chatCompletion, getPlatformOpenRouterKey, type ChatMessage, type ChatTool } from '@/lib/ai/openrouter'
import { applyPlatformModelPolicy, getPlatformAiConfig, hasPlatformAiBudget } from '@/lib/ai/platform-config'
import { resolveModelId } from '@/lib/ai/models'
import { createAdminActionToken } from '@/lib/admin/vigento-actions'
import { normalizePhone } from '@/lib/phone'

const inputSchema = z.object({ message: z.string().trim().min(2).max(1800) })
const querySchema = z.object({ query: z.string().trim().min(1).max(140) })
const summarySchema = z.object({ days: z.number().int().min(1).max(365).default(7) })
const fileSchema = z.object({ path: z.string().trim().min(1).max(260) })
const creditSchema = z.object({
  workspaceQuery: z.string().trim().min(1).max(140),
  amountToman: z.number().int().positive().max(500_000_000),
  direction: z.enum(['increase', 'decrease']),
  reason: z.string().trim().min(2).max(180),
})
const resolveSchema = z.object({ conversationId: z.string().trim().min(8).max(80), reason: z.string().trim().min(2).max(180) })

const TOOLS: ChatTool[] = [
  { type: 'function', function: { name: 'get_platform_summary', description: 'Read live platform revenue, users, conversations, AI cost, handoffs and top workspaces for a date range.', parameters: { type: 'object', properties: { days: { type: 'integer', minimum: 1, maximum: 365 } }, required: ['days'] } } },
  { type: 'function', function: { name: 'find_workspace', description: 'Find a business/workspace and its owner by workspace name, owner name, phone or id.', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } } },
  { type: 'function', function: { name: 'inspect_conversation', description: 'Inspect one conversation by exact conversation id.', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } } },
  { type: 'function', function: { name: 'read_project_file', description: 'Read one safe non-secret source/config/documentation file from the deployed project. Never use for .env, secrets, credentials or node_modules.', parameters: { type: 'object', properties: { path: { type: 'string', description: 'Project-relative file path' } }, required: ['path'] } } },
  { type: 'function', function: { name: 'propose_credit_adjustment', description: 'Create a confirmation preview to increase or decrease a workspace AI wallet. This never executes until Milad confirms in the UI.', parameters: { type: 'object', properties: { workspaceQuery: { type: 'string' }, amountToman: { type: 'integer', minimum: 1 }, direction: { type: 'string', enum: ['increase', 'decrease'] }, reason: { type: 'string' } }, required: ['workspaceQuery', 'amountToman', 'direction', 'reason'] } } },
  { type: 'function', function: { name: 'propose_resolve_conversation', description: 'Create a confirmation preview to mark a conversation resolved and clear operator handoff state.', parameters: { type: 'object', properties: { conversationId: { type: 'string' }, reason: { type: 'string' } }, required: ['conversationId', 'reason'] } } },
]

async function platformSummary(days: number) {
  const since = new Date(Date.now() - days * 86_400_000)
  const [revenue, payments, users, workspaces, conversations, messages, resolved, handoffs, errors, usage, top] = await Promise.all([
    prisma.payment.aggregate({ where: { status: 'PAID', paidAt: { gte: since }, currency: 'IRR' }, _sum: { amount: true } }),
    prisma.payment.count({ where: { status: 'PAID', paidAt: { gte: since } } }),
    prisma.user.count({ where: { createdAt: { gte: since } } }),
    prisma.workspace.count({ where: { createdAt: { gte: since } } }),
    prisma.conversation.count({ where: { createdAt: { gte: since } } }),
    prisma.message.count({ where: { createdAt: { gte: since } } }),
    prisma.conversation.count({ where: { status: 'RESOLVED', createdAt: { gte: since } } }),
    prisma.conversation.count({ where: { status: 'HANDED_OFF' } }),
    prisma.errorLog.count({ where: { createdAt: { gte: since } } }),
    prisma.usageLog.aggregate({ where: { status: 'CAPTURED', date: { gte: since } }, _sum: { chargedIRR: true, cost: true }, _count: { _all: true } }),
    prisma.conversation.groupBy({ by: ['workspaceId'], where: { createdAt: { gte: since } }, _sum: { messageCount: true }, _count: { _all: true }, orderBy: { _sum: { messageCount: 'desc' } }, take: 5 }),
  ])
  const names = await prisma.workspace.findMany({ where: { id: { in: top.map((row) => row.workspaceId) } }, select: { id: true, name: true } })
  const nameMap = new Map(names.map((row) => [row.id, row.name]))
  return {
    days,
    revenueToman: Math.round((revenue._sum.amount ?? 0) / 10),
    successfulPayments: payments,
    newUsers: users,
    newWorkspaces: workspaces,
    conversations,
    messages,
    resolved,
    activeHandoffs: handoffs,
    errors,
    ai: { replies: usage._count._all, chargedToman: Math.round((usage._sum.chargedIRR ?? 0) / 10), providerCostUSD: usage._sum.cost ?? 0 },
    topWorkspaces: top.map((row) => ({ name: nameMap.get(row.workspaceId) || row.workspaceId, conversations: row._count._all, messages: row._sum.messageCount ?? 0 })),
  }
}

async function findWorkspaces(query: string) {
  const normalized = query.replace(/\s+/g, ' ').trim()
  const phone = normalizePhone(normalized)
  const rows = await prisma.workspace.findMany({
    where: {
      OR: [
        { id: normalized },
        { name: { contains: normalized, mode: 'insensitive' } },
        { users: { some: { OR: [{ name: { contains: normalized, mode: 'insensitive' } }, ...(phone ? [{ phone }] : [])] } } },
      ],
    },
    take: 6,
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, plan: true, businessType: true, aiCreditBalanceIRR: true, users: { where: { role: 'OWNER' }, take: 1, select: { name: true, phone: true } }, _count: { select: { agents: true, conversations: true, contacts: true } } },
  })
  return rows.map((row) => ({ ...row, creditToman: Math.round(row.aiCreditBalanceIRR / 10), aiCreditBalanceIRR: undefined }))
}

async function inspectConversation(id: string) {
  return prisma.conversation.findUnique({
    where: { id },
    select: { id: true, status: true, channel: true, summary: true, messageCount: true, handedOff: true, createdAt: true, lastMessageAt: true, workspace: { select: { id: true, name: true } }, contact: { select: { name: true, phone: true, instagramUsername: true } }, agent: { select: { name: true, active: true } } },
  })
}

async function safeReadProjectFile(relativePath: string) {
  const root = path.resolve(process.cwd())
  const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '')
  if (!/\.(?:ts|tsx|js|jsx|json|md|css|sql|prisma)$/i.test(normalized)) throw new Error('FILE_TYPE_NOT_ALLOWED')
  if (/(^|\/)(?:\.env|\.git|node_modules|\.next|secrets?)(?:\/|$)/i.test(normalized)) throw new Error('FILE_NOT_ALLOWED')
  const absolute = path.resolve(root, normalized)
  if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) throw new Error('FILE_NOT_ALLOWED')
  const content = await readFile(absolute, 'utf8')
  return { path: normalized, excerpt: content.slice(0, 40_000), truncated: content.length > 40_000 }
}

type Proposal = { token: string; title: string; description: string; tone: 'warning' | 'danger' }

async function executeTool(name: string, rawArgs: string): Promise<{ result: unknown; proposal?: Proposal }> {
  const args = JSON.parse(rawArgs || '{}') as unknown
  if (name === 'get_platform_summary') return { result: await platformSummary(summarySchema.parse(args).days) }
  if (name === 'find_workspace') return { result: await findWorkspaces(querySchema.parse(args).query) }
  if (name === 'inspect_conversation') return { result: await inspectConversation(querySchema.parse(args).query) }
  if (name === 'read_project_file') return { result: await safeReadProjectFile(fileSchema.parse(args).path) }
  if (name === 'propose_credit_adjustment') {
    const input = creditSchema.parse(args)
    const matches = await findWorkspaces(input.workspaceQuery)
    if (matches.length !== 1) return { result: { error: 'AMBIGUOUS_WORKSPACE', matches } }
    const workspace = matches[0]
    const signedIRR = input.amountToman * 10 * (input.direction === 'increase' ? 1 : -1)
    const token = createAdminActionToken({ kind: 'ADJUST_CREDIT', workspaceId: workspace.id, workspaceName: workspace.name, amountIRR: signedIRR, reason: input.reason })
    return { result: { readyForConfirmation: true }, proposal: { token, title: input.direction === 'increase' ? 'افزایش اعتبار' : 'کاهش اعتبار', description: `${input.amountToman.toLocaleString('fa-IR')} تومان برای «${workspace.name}» — موجودی فعلی ${workspace.creditToman.toLocaleString('fa-IR')} تومان`, tone: input.direction === 'increase' ? 'warning' : 'danger' } }
  }
  if (name === 'propose_resolve_conversation') {
    const input = resolveSchema.parse(args)
    const conversation = await inspectConversation(input.conversationId)
    if (!conversation) return { result: { error: 'CONVERSATION_NOT_FOUND' } }
    const label = conversation.contact?.name || conversation.contact?.phone || conversation.id
    const token = createAdminActionToken({ kind: 'RESOLVE_CONVERSATION', conversationId: conversation.id, workspaceId: conversation.workspace.id, label, reason: input.reason })
    return { result: { readyForConfirmation: true }, proposal: { token, title: 'بستن پرونده گفتگو', description: `گفتگوی «${label}» در ${conversation.workspace.name} حل‌شده می‌شود و وضعیت انتقال اپراتور پاک خواهد شد.`, tone: 'danger' } }
  }
  return { result: { error: 'UNKNOWN_TOOL' } }
}

export async function POST(request: Request) {
  if (!isAdminAuthed()) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!(await rateLimit('admin-vigento:milad', 18, 60))) return NextResponse.json({ error: 'RATE_LIMIT' }, { status: 429 })
  const parsed = inputSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'INVALID' }, { status: 400 })

  const fallback = await platformSummary(7)
  if (!getPlatformOpenRouterKey()) return NextResponse.json({ answer: `در ۷ روز اخیر ${fallback.conversations.toLocaleString('fa-IR')} گفتگو، ${fallback.successfulPayments.toLocaleString('fa-IR')} پرداخت موفق و ${fallback.activeHandoffs.toLocaleString('fa-IR')} انتقال فعال ثبت شده است.`, source: 'facts' })

  try {
    const config = await getPlatformAiConfig()
    if (!(await hasPlatformAiBudget(config))) return NextResponse.json({ answer: 'سقف هزینه ماهانه OpenRouter رسیده است؛ آمار خام همچنان از صفحه داشبورد در دسترس است.', source: 'facts' })
    const alias = applyPlatformModelPolicy('fast', config)
    const model = resolveModelId(alias, config.providerModels)
    const messages: ChatMessage[] = [
      { role: 'system', content: `You are Vigento Admin, the owner-only operations copilot for Milad (phone 09128352271). Reply in concise Persian. Use tools for every factual platform/database/file claim; never invent values. You may read aggregates, find workspaces, inspect a conversation and read one safe project file. Mutations are strictly allow-listed: only propose_credit_adjustment and propose_resolve_conversation, and both MUST return a confirmation card; never claim a mutation executed. Secrets and .env are inaccessible. Prefer toman in user-facing money. Ask for clarification when a target is ambiguous.` },
      { role: 'user', content: parsed.data.message },
    ]
    const first = await chatCompletion({ model, messages, tools: TOOLS, temperature: 0.1, maxTokens: 700 })
    if (!first.toolCalls.length) return NextResponse.json({ answer: first.content || 'برای پاسخ دقیق‌تر، نام کسب‌وکار یا شناسه مورد را بفرستید.', source: 'ai' })

    messages.push({ role: 'assistant', content: first.content, tool_calls: first.toolCalls })
    let proposal: Proposal | undefined
    for (const call of first.toolCalls.slice(0, 3)) {
      const output = await executeTool(call.function.name, call.function.arguments)
      proposal = proposal || output.proposal
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(output.result) })
    }
    if (proposal) return NextResponse.json({ answer: 'عملیات آماده است. جزئیات را بررسی کنید و فقط در صورت اطمینان تأیید بزنید.', source: 'ai', proposal })
    const final = await chatCompletion({ model, messages, toolChoice: 'none', temperature: 0.1, maxTokens: 780 })
    return NextResponse.json({ answer: final.content || 'داده پیدا شد، اما امکان خلاصه‌سازی پاسخ وجود نداشت.', source: 'ai' })
  } catch (error) {
    const code = error instanceof Error ? error.message : 'UNKNOWN'
    return NextResponse.json({ answer: `درخواست کامل نشد (${code}). داده‌ای تغییر نکرد.`, source: 'error' }, { status: 200 })
  }
}
