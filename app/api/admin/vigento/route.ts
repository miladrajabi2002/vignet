import path from 'path'
import { readFile } from 'fs/promises'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { ADMIN_OWNER_NAME, ADMIN_OWNER_PHONE, isAdminAuthed } from '@/lib/admin/auth'
import { rateLimit } from '@/lib/ratelimit'
import { chatCompletion, getPlatformOpenRouterKey, type ChatMessage, type ChatTool } from '@/lib/ai/openrouter'
import { getPlatformAiConfig, hasPlatformAiBudget } from '@/lib/ai/platform-config'
import { resolveModelId } from '@/lib/ai/models'
import { createAdminActionToken } from '@/lib/admin/vigento-actions'
import { normalizePhone } from '@/lib/phone'
import { ADMIN_VISIBLE_RELATED_WHERE, ADMIN_VISIBLE_USER_WHERE, ADMIN_VISIBLE_WORKSPACE_WHERE, getAdminHiddenWorkspaceIds } from '@/lib/admin/reporting-scope'

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
const workspaceUpdateSchema = z.object({
  workspaceQuery: z.string().trim().min(1).max(140),
  name: z.string().trim().min(2).max(80).optional(),
  plan: z.enum(['TRIAL', 'STARTER', 'PRO', 'BUSINESS']).optional(),
  reason: z.string().trim().min(2).max(180),
}).refine((value) => Boolean(value.name || value.plan), { message: 'NO_WORKSPACE_CHANGE' })
const agentStateSchema = z.object({ agentQuery: z.string().trim().min(1).max(140), active: z.boolean(), reason: z.string().trim().min(2).max(180) })
const userDeleteSchema = z.object({ userQuery: z.string().trim().min(1).max(140), reason: z.string().trim().min(2).max(180) })

const WELCOME_MESSAGE = `سلام ${ADMIN_OWNER_NAME}؛ من ویجنتوی ادمین هستم. وضعیت پلتفرم را با داده زنده بررسی می‌کنم و عملیات حساس را فقط بعد از نمایش جزئیات و تأیید شما انجام می‌دهم.`

const TOOLS: ChatTool[] = [
  { type: 'function', function: { name: 'get_platform_summary', description: 'Read live platform revenue, users, conversations, AI cost, handoffs and top workspaces for a date range.', parameters: { type: 'object', properties: { days: { type: 'integer', minimum: 1, maximum: 365 } }, required: ['days'] } } },
  { type: 'function', function: { name: 'find_workspace', description: 'Find a business/workspace and its owner by workspace name, owner name, phone or id.', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } } },
  { type: 'function', function: { name: 'inspect_conversation', description: 'Inspect one conversation by exact conversation id.', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } } },
  { type: 'function', function: { name: 'find_user', description: 'Find platform account owners by id, exact/partial name, phone, or workspace name. Returns platform role and workspace context without secrets.', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } } },
  { type: 'function', function: { name: 'find_agent', description: 'Find agents by id, name, or workspace name and inspect active state.', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } } },
  { type: 'function', function: { name: 'read_project_file', description: 'Read one safe non-secret source/config/documentation file from the deployed project. Never use for .env, secrets, credentials or node_modules.', parameters: { type: 'object', properties: { path: { type: 'string', description: 'Project-relative file path' } }, required: ['path'] } } },
  { type: 'function', function: { name: 'propose_credit_adjustment', description: 'Create a confirmation preview to increase or decrease a workspace AI wallet. This never executes until the platform owner confirms in the UI.', parameters: { type: 'object', properties: { workspaceQuery: { type: 'string' }, amountToman: { type: 'integer', minimum: 1 }, direction: { type: 'string', enum: ['increase', 'decrease'] }, reason: { type: 'string' } }, required: ['workspaceQuery', 'amountToman', 'direction', 'reason'] } } },
  { type: 'function', function: { name: 'propose_resolve_conversation', description: 'Create a confirmation preview to mark a conversation resolved and clear operator handoff state.', parameters: { type: 'object', properties: { conversationId: { type: 'string' }, reason: { type: 'string' } }, required: ['conversationId', 'reason'] } } },
  { type: 'function', function: { name: 'propose_update_workspace', description: 'Preview changing a workspace display name and/or plan. Requires owner confirmation and creates an audit receipt.', parameters: { type: 'object', properties: { workspaceQuery: { type: 'string' }, name: { type: 'string' }, plan: { type: 'string', enum: ['TRIAL', 'STARTER', 'PRO', 'BUSINESS'] }, reason: { type: 'string' } }, required: ['workspaceQuery', 'reason'] } } },
  { type: 'function', function: { name: 'propose_set_agent_active', description: 'Preview activating or deactivating one agent. Requires owner confirmation.', parameters: { type: 'object', properties: { agentQuery: { type: 'string' }, active: { type: 'boolean' }, reason: { type: 'string' } }, required: ['agentQuery', 'active', 'reason'] } } },
  { type: 'function', function: { name: 'propose_delete_user_account', description: 'Preview deleting the single owner account from a workspace while preserving workspace data. Platform admins are protected and owner confirmation is required.', parameters: { type: 'object', properties: { userQuery: { type: 'string' }, reason: { type: 'string' } }, required: ['userQuery', 'reason'] } } },
]

async function platformSummary(days: number) {
  const since = new Date(Date.now() - days * 86_400_000)
  const hiddenWorkspaceIds = await getAdminHiddenWorkspaceIds()
  const visibleErrorWhere = hiddenWorkspaceIds.length
    ? { OR: [{ workspaceId: null }, { workspaceId: { notIn: hiddenWorkspaceIds } }] }
    : {}
  const [revenue, payments, users, workspaces, conversations, messages, resolved, handoffs, errors, usage, top] = await Promise.all([
    prisma.payment.aggregate({ where: { ...ADMIN_VISIBLE_RELATED_WHERE, status: 'PAID', paidAt: { gte: since }, currency: 'IRR' }, _sum: { amount: true } }),
    prisma.payment.count({ where: { ...ADMIN_VISIBLE_RELATED_WHERE, status: 'PAID', paidAt: { gte: since } } }),
    prisma.user.count({ where: { ...ADMIN_VISIBLE_USER_WHERE, createdAt: { gte: since } } }),
    prisma.workspace.count({ where: { ...ADMIN_VISIBLE_WORKSPACE_WHERE, createdAt: { gte: since } } }),
    prisma.conversation.count({ where: { ...ADMIN_VISIBLE_RELATED_WHERE, createdAt: { gte: since } } }),
    prisma.message.count({ where: { conversation: ADMIN_VISIBLE_RELATED_WHERE, createdAt: { gte: since } } }),
    prisma.conversation.count({ where: { ...ADMIN_VISIBLE_RELATED_WHERE, status: 'RESOLVED', createdAt: { gte: since } } }),
    prisma.conversation.count({ where: { ...ADMIN_VISIBLE_RELATED_WHERE, status: 'HANDED_OFF' } }),
    prisma.errorLog.count({ where: { AND: [visibleErrorWhere, { createdAt: { gte: since }, level: 'error' }] } }),
    prisma.usageLog.aggregate({ where: { ...ADMIN_VISIBLE_RELATED_WHERE, status: 'CAPTURED', date: { gte: since } }, _sum: { chargedIRR: true, cost: true }, _count: { _all: true } }),
    prisma.conversation.groupBy({ by: ['workspaceId'], where: { ...ADMIN_VISIBLE_RELATED_WHERE, createdAt: { gte: since } }, _sum: { messageCount: true }, _count: { _all: true }, orderBy: { _sum: { messageCount: 'desc' } }, take: 5 }),
  ])
  const names = await prisma.workspace.findMany({ where: { ...ADMIN_VISIBLE_WORKSPACE_WHERE, id: { in: top.map((row) => row.workspaceId) } }, select: { id: true, name: true } })
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
      AND: [ADMIN_VISIBLE_WORKSPACE_WHERE],
      OR: [
        { id: normalized },
        { name: { contains: normalized, mode: 'insensitive' } },
        { owner: { is: { OR: [{ name: { contains: normalized, mode: 'insensitive' } }, ...(phone ? [{ phone }] : [])] } } },
      ],
    },
    take: 6,
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, plan: true, businessType: true, aiCreditBalanceIRR: true, owner: { select: { name: true, phone: true } }, _count: { select: { agents: true, conversations: true, contacts: true } } },
  })
  return rows.map((row) => ({ ...row, creditToman: Math.round(row.aiCreditBalanceIRR / 10), aiCreditBalanceIRR: undefined }))
}

async function inspectConversation(id: string) {
  return prisma.conversation.findFirst({
    where: { ...ADMIN_VISIBLE_RELATED_WHERE, id },
    select: { id: true, status: true, channel: true, summary: true, messageCount: true, handedOff: true, createdAt: true, lastMessageAt: true, workspace: { select: { id: true, name: true } }, contact: { select: { name: true, phone: true, instagramUsername: true } }, agent: { select: { name: true, active: true } } },
  })
}

async function findUsers(query: string) {
  const normalized = query.replace(/\s+/g, ' ').trim()
  const phone = normalizePhone(normalized)
  const rows = await prisma.user.findMany({
    where: {
      AND: [ADMIN_VISIBLE_USER_WHERE],
      OR: [
        { id: normalized },
        { name: { contains: normalized, mode: 'insensitive' } },
        ...(phone ? [{ phone }] : []),
        { workspace: { name: { contains: normalized, mode: 'insensitive' } } },
      ],
    },
    take: 12,
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, phone: true, platformRole: true, createdAt: true, workspace: { select: { id: true, name: true, plan: true } } },
  })
  const normalizedLower = normalized.toLocaleLowerCase('fa')
  return rows
    .map((user) => ({
      ...user,
      protectedAs: user.platformRole === 'ADMIN'
        ? 'PLATFORM_ADMIN'
        : null,
      matchRank: user.id === normalized || (phone && user.phone === phone)
        ? 0
        : user.name?.trim().toLocaleLowerCase('fa') === normalizedLower
          ? 1
          : user.name?.toLocaleLowerCase('fa').includes(normalizedLower)
            ? 2
            : 3,
    }))
    .sort((a, b) => a.matchRank - b.matchRank || b.createdAt.getTime() - a.createdAt.getTime())
}

async function loadAdminHistory(): Promise<ChatMessage[]> {
  if (!ADMIN_OWNER_PHONE) return []
  try {
    const rows = await prisma.adminVigentoMessage.findMany({
      where: { adminPhone: ADMIN_OWNER_PHONE },
      orderBy: { createdAt: 'desc' },
      take: 18,
      select: { role: true, content: true },
    })
    return rows.reverse().flatMap((row) =>
      row.role === 'user' || row.role === 'assistant'
        ? [{ role: row.role, content: row.content.slice(-6_000) } satisfies ChatMessage]
        : [],
    )
  } catch {
    return []
  }
}

async function saveAdminMessage(role: 'user' | 'assistant', content: string): Promise<void> {
  if (!ADMIN_OWNER_PHONE || !content.trim()) return
  try {
    await prisma.adminVigentoMessage.create({
      data: { adminPhone: ADMIN_OWNER_PHONE, role, content: content.slice(0, 20_000) },
    })
  } catch {
    // Keep the copilot available during the short migration window.
  }
}

export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!ADMIN_OWNER_PHONE) return NextResponse.json({ messages: [{ id: 'welcome', role: 'assistant', text: WELCOME_MESSAGE }] })
  try {
    const rows = await prisma.adminVigentoMessage.findMany({
      where: { adminPhone: ADMIN_OWNER_PHONE },
      orderBy: { createdAt: 'desc' },
      take: 160,
      select: { id: true, role: true, content: true },
    })
    return NextResponse.json({
      messages: rows.length
        ? rows.reverse().map((row) => ({ id: row.id, role: row.role, text: row.content }))
        : [{ id: 'welcome', role: 'assistant', text: WELCOME_MESSAGE }],
    })
  } catch {
    return NextResponse.json({ messages: [{ id: 'welcome', role: 'assistant', text: WELCOME_MESSAGE }] })
  }
}

export async function DELETE() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (ADMIN_OWNER_PHONE) {
    await prisma.adminVigentoMessage.deleteMany({ where: { adminPhone: ADMIN_OWNER_PHONE } })
  }
  return NextResponse.json({ ok: true, message: { id: 'welcome', role: 'assistant', text: WELCOME_MESSAGE } })
}

async function findAgents(query: string) {
  const normalized = query.replace(/\s+/g, ' ').trim()
  return prisma.agent.findMany({
    where: { AND: [ADMIN_VISIBLE_RELATED_WHERE], OR: [{ id: normalized }, { name: { contains: normalized, mode: 'insensitive' } }, { workspace: { name: { contains: normalized, mode: 'insensitive' } } }] },
    take: 8,
    orderBy: { updatedAt: 'desc' },
    select: { id: true, name: true, active: true, model: true, updatedAt: true, workspace: { select: { id: true, name: true } }, _count: { select: { channels: true, conversations: true } } },
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
  if (name === 'find_user') return { result: await findUsers(querySchema.parse(args).query) }
  if (name === 'find_agent') return { result: await findAgents(querySchema.parse(args).query) }
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
  if (name === 'propose_update_workspace') {
    const input = workspaceUpdateSchema.parse(args)
    const matches = await findWorkspaces(input.workspaceQuery)
    if (matches.length !== 1) return { result: { error: 'AMBIGUOUS_WORKSPACE', matches } }
    const workspace = matches[0]
    const token = createAdminActionToken({ kind: 'UPDATE_WORKSPACE', workspaceId: workspace.id, workspaceName: workspace.name, nextName: input.name, nextPlan: input.plan, reason: input.reason })
    const changes = [input.name ? `نام: «${workspace.name}» ← «${input.name}»` : null, input.plan ? `پلن: ${workspace.plan} ← ${input.plan}` : null].filter(Boolean).join(' · ')
    return { result: { readyForConfirmation: true }, proposal: { token, title: 'ویرایش کسب‌وکار', description: changes, tone: 'warning' } }
  }
  if (name === 'propose_set_agent_active') {
    const input = agentStateSchema.parse(args)
    const matches = await findAgents(input.agentQuery)
    if (matches.length !== 1) return { result: { error: 'AMBIGUOUS_AGENT', matches } }
    const agent = matches[0]
    const token = createAdminActionToken({ kind: 'SET_AGENT_ACTIVE', agentId: agent.id, workspaceId: agent.workspace.id, label: agent.name, active: input.active, reason: input.reason })
    return { result: { readyForConfirmation: true }, proposal: { token, title: input.active ? 'فعال‌سازی ایجنت' : 'غیرفعال‌سازی ایجنت', description: `ایجنت «${agent.name}» در «${agent.workspace.name}» ${input.active ? 'فعال' : 'غیرفعال'} می‌شود.`, tone: input.active ? 'warning' : 'danger' } }
  }
  if (name === 'propose_delete_user_account') {
    const input = userDeleteSchema.parse(args)
    const matches = await findUsers(input.userQuery)
    if (matches.length !== 1) return { result: { error: 'AMBIGUOUS_USER', matches } }
    const user = matches[0]
    if (user.platformRole === 'ADMIN') return { result: { error: 'PROTECTED_USER' } }
    const token = createAdminActionToken({ kind: 'DELETE_USER_ACCOUNT', userId: user.id, workspaceId: user.workspace.id, label: user.name || user.phone, reason: input.reason })
    return { result: { readyForConfirmation: true }, proposal: { token, title: 'حذف حساب کاربر', description: `${user.name || user.phone} از «${user.workspace.name}» حذف می‌شود. داده‌های کسب‌وکار برای سوابق حفظ می‌شوند و این عملیات در تاریخچه ادمین ثبت خواهد شد.`, tone: 'danger' } }
  }
  return { result: { error: 'UNKNOWN_TOOL' } }
}

export async function POST(request: Request) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!(await rateLimit('admin-vigento:owner', 18, 60))) return NextResponse.json({ error: 'RATE_LIMIT' }, { status: 429 })
  const parsed = inputSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'INVALID' }, { status: 400 })

  const history = await loadAdminHistory()
  await saveAdminMessage('user', parsed.data.message)

  async function answer(text: string, extra: Record<string, unknown> = {}) {
    await saveAdminMessage('assistant', text)
    return NextResponse.json({ answer: text, ...extra })
  }

  const fallback = await platformSummary(7)
  if (!getPlatformOpenRouterKey()) return answer(`در ۷ روز اخیر ${fallback.conversations.toLocaleString('fa-IR')} گفتگو، ${fallback.successfulPayments.toLocaleString('fa-IR')} پرداخت موفق و ${fallback.activeHandoffs.toLocaleString('fa-IR')} انتقال فعال ثبت شده است.`, { source: 'facts' })

  try {
    const config = await getPlatformAiConfig()
    if (!(await hasPlatformAiBudget(config))) return answer('سقف هزینه ماهانه OpenRouter رسیده است؛ آمار خام همچنان از صفحه داشبورد در دسترس است.', { source: 'facts' })
    // The owner copilot has its own explicitly selected model; customer-facing
    // enabledModels must not silently override this admin-only choice.
    const alias = config.vigentoModel
    const model = resolveModelId(alias, config.providerModels)
    const messages: ChatMessage[] = [
      { role: 'system', content: `You are Vigento Admin, the owner-only operations copilot for ${ADMIN_OWNER_NAME}. Reply in concise, clear Persian and use the conversation history for follow-ups. Use tools for every factual platform/database/file claim; never invent values. Each workspace has one owner account and there are no team roles or members. For person lookups, always use find_user and trust that exact user's platformRole. If multiple people match, show the candidates and ask for a phone or id. You may read aggregates, find users/workspaces/agents, inspect a conversation and read one safe project file. Mutations are strictly allow-listed and proposal-only: credit adjustment, resolve conversation, update workspace, toggle agent, and delete a non-platform-admin user account. Every mutation MUST return a confirmation card and is executed only after owner confirmation; never claim it already executed. Platform admins are protected. Secrets, raw SQL, .env and unrestricted deletion are inaccessible. Prefer toman in user-facing money. Ask for clarification when a target is ambiguous.` },
      ...history,
      { role: 'user', content: parsed.data.message },
    ]
    const first = await chatCompletion({ model, messages, tools: TOOLS, temperature: 0.1, maxTokens: 700 })
    if (!first.toolCalls.length) return answer(first.content || 'برای پاسخ دقیق‌تر، نام کسب‌وکار یا شناسه مورد را بفرستید.', { source: 'ai', modelAlias: alias })

    messages.push({ role: 'assistant', content: first.content, tool_calls: first.toolCalls })
    let proposal: Proposal | undefined
    for (const call of first.toolCalls.slice(0, 3)) {
      const output = await executeTool(call.function.name, call.function.arguments)
      proposal = proposal || output.proposal
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(output.result) })
    }
    if (proposal) return answer('عملیات آماده است. جزئیات را بررسی کنید و فقط در صورت اطمینان تأیید بزنید.', { source: 'ai', proposal, modelAlias: alias })
    const final = await chatCompletion({ model, messages, toolChoice: 'none', temperature: 0.1, maxTokens: 780 })
    return answer(final.content || 'داده پیدا شد، اما امکان خلاصه‌سازی پاسخ وجود نداشت.', { source: 'ai', modelAlias: alias })
  } catch (error) {
    const code = error instanceof Error ? error.message : 'UNKNOWN'
    return answer(`درخواست کامل نشد (${code}). داده‌ای تغییر نکرد.`, { source: 'error' })
  }
}
