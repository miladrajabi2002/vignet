import path from 'path'
import { readFile } from 'fs/promises'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { ADMIN_OWNER_NAME, isAdminAuthed } from '@/lib/admin/auth'
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
const workspaceUpdateSchema = z.object({
  workspaceQuery: z.string().trim().min(1).max(140),
  name: z.string().trim().min(2).max(80).optional(),
  plan: z.enum(['TRIAL', 'STARTER', 'PRO', 'BUSINESS']).optional(),
  reason: z.string().trim().min(2).max(180),
}).refine((value) => Boolean(value.name || value.plan), { message: 'NO_WORKSPACE_CHANGE' })
const agentStateSchema = z.object({ agentQuery: z.string().trim().min(1).max(140), active: z.boolean(), reason: z.string().trim().min(2).max(180) })
const memberCreateSchema = z.object({ workspaceQuery: z.string().trim().min(1).max(140), phone: z.string().trim().min(8).max(24), name: z.string().trim().min(2).max(80), role: z.enum(['ADMIN', 'MEMBER']), reason: z.string().trim().min(2).max(180) })
const memberUpdateSchema = z.object({ userQuery: z.string().trim().min(1).max(140), name: z.string().trim().min(2).max(80).optional(), role: z.enum(['ADMIN', 'MEMBER']).optional(), reason: z.string().trim().min(2).max(180) }).refine((value) => Boolean(value.name || value.role), { message: 'NO_MEMBER_CHANGE' })
const memberDeleteSchema = z.object({ userQuery: z.string().trim().min(1).max(140), reason: z.string().trim().min(2).max(180) })

const TOOLS: ChatTool[] = [
  { type: 'function', function: { name: 'get_platform_summary', description: 'Read live platform revenue, users, conversations, AI cost, handoffs and top workspaces for a date range.', parameters: { type: 'object', properties: { days: { type: 'integer', minimum: 1, maximum: 365 } }, required: ['days'] } } },
  { type: 'function', function: { name: 'find_workspace', description: 'Find a business/workspace and its owner by workspace name, owner name, phone or id.', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } } },
  { type: 'function', function: { name: 'inspect_conversation', description: 'Inspect one conversation by exact conversation id.', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } } },
  { type: 'function', function: { name: 'find_user', description: 'Find platform users by id, exact/partial name, phone, or workspace name. Returns role and workspace context without secrets.', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } } },
  { type: 'function', function: { name: 'find_agent', description: 'Find agents by id, name, or workspace name and inspect active state.', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } } },
  { type: 'function', function: { name: 'read_project_file', description: 'Read one safe non-secret source/config/documentation file from the deployed project. Never use for .env, secrets, credentials or node_modules.', parameters: { type: 'object', properties: { path: { type: 'string', description: 'Project-relative file path' } }, required: ['path'] } } },
  { type: 'function', function: { name: 'propose_credit_adjustment', description: 'Create a confirmation preview to increase or decrease a workspace AI wallet. This never executes until the platform owner confirms in the UI.', parameters: { type: 'object', properties: { workspaceQuery: { type: 'string' }, amountToman: { type: 'integer', minimum: 1 }, direction: { type: 'string', enum: ['increase', 'decrease'] }, reason: { type: 'string' } }, required: ['workspaceQuery', 'amountToman', 'direction', 'reason'] } } },
  { type: 'function', function: { name: 'propose_resolve_conversation', description: 'Create a confirmation preview to mark a conversation resolved and clear operator handoff state.', parameters: { type: 'object', properties: { conversationId: { type: 'string' }, reason: { type: 'string' } }, required: ['conversationId', 'reason'] } } },
  { type: 'function', function: { name: 'propose_update_workspace', description: 'Preview changing a workspace display name and/or plan. Requires owner confirmation and creates an audit receipt.', parameters: { type: 'object', properties: { workspaceQuery: { type: 'string' }, name: { type: 'string' }, plan: { type: 'string', enum: ['TRIAL', 'STARTER', 'PRO', 'BUSINESS'] }, reason: { type: 'string' } }, required: ['workspaceQuery', 'reason'] } } },
  { type: 'function', function: { name: 'propose_set_agent_active', description: 'Preview activating or deactivating one agent. Requires owner confirmation.', parameters: { type: 'object', properties: { agentQuery: { type: 'string' }, active: { type: 'boolean' }, reason: { type: 'string' } }, required: ['agentQuery', 'active', 'reason'] } } },
  { type: 'function', function: { name: 'propose_create_workspace_member', description: 'Preview creating a regular workspace ADMIN or MEMBER. Platform admin role is never granted. Requires owner confirmation.', parameters: { type: 'object', properties: { workspaceQuery: { type: 'string' }, phone: { type: 'string' }, name: { type: 'string' }, role: { type: 'string', enum: ['ADMIN', 'MEMBER'] }, reason: { type: 'string' } }, required: ['workspaceQuery', 'phone', 'name', 'role', 'reason'] } } },
  { type: 'function', function: { name: 'propose_update_workspace_member', description: 'Preview changing the name or workspace role of a non-owner member. Platform admins and workspace owners are protected.', parameters: { type: 'object', properties: { userQuery: { type: 'string' }, name: { type: 'string' }, role: { type: 'string', enum: ['ADMIN', 'MEMBER'] }, reason: { type: 'string' } }, required: ['userQuery', 'reason'] } } },
  { type: 'function', function: { name: 'propose_delete_workspace_member', description: 'Preview deleting a non-owner workspace member. Workspace owners and platform admins can never be deleted through this tool.', parameters: { type: 'object', properties: { userQuery: { type: 'string' }, reason: { type: 'string' } }, required: ['userQuery', 'reason'] } } },
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

async function findUsers(query: string) {
  const normalized = query.replace(/\s+/g, ' ').trim()
  const phone = normalizePhone(normalized)
  return prisma.user.findMany({
    where: {
      OR: [
        { id: normalized },
        { name: { contains: normalized, mode: 'insensitive' } },
        ...(phone ? [{ phone }] : []),
        { workspace: { name: { contains: normalized, mode: 'insensitive' } } },
      ],
    },
    take: 8,
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, phone: true, role: true, platformRole: true, createdAt: true, workspace: { select: { id: true, name: true, plan: true } } },
  })
}

async function findAgents(query: string) {
  const normalized = query.replace(/\s+/g, ' ').trim()
  return prisma.agent.findMany({
    where: { OR: [{ id: normalized }, { name: { contains: normalized, mode: 'insensitive' } }, { workspace: { name: { contains: normalized, mode: 'insensitive' } } }] },
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
  if (name === 'propose_create_workspace_member') {
    const input = memberCreateSchema.parse(args)
    const matches = await findWorkspaces(input.workspaceQuery)
    if (matches.length !== 1) return { result: { error: 'AMBIGUOUS_WORKSPACE', matches } }
    const phone = normalizePhone(input.phone)
    if (!phone) return { result: { error: 'INVALID_PHONE' } }
    const existing = await prisma.user.findUnique({ where: { phone }, select: { id: true, name: true, workspace: { select: { name: true } } } })
    if (existing) return { result: { error: 'PHONE_ALREADY_EXISTS', existing } }
    const workspace = matches[0]
    const token = createAdminActionToken({ kind: 'CREATE_WORKSPACE_MEMBER', workspaceId: workspace.id, workspaceName: workspace.name, phone, name: input.name, role: input.role, reason: input.reason })
    return { result: { readyForConfirmation: true }, proposal: { token, title: 'افزودن عضو کسب‌وکار', description: `${input.name} با نقش ${input.role} و شماره ${phone} به «${workspace.name}» اضافه می‌شود. نقش پلتفرمی او همیشه USER باقی می‌ماند.`, tone: 'warning' } }
  }
  if (name === 'propose_update_workspace_member') {
    const input = memberUpdateSchema.parse(args)
    const matches = await findUsers(input.userQuery)
    if (matches.length !== 1) return { result: { error: 'AMBIGUOUS_USER', matches } }
    const user = matches[0]
    if (user.platformRole === 'ADMIN' || user.role === 'OWNER') return { result: { error: 'PROTECTED_USER' } }
    const token = createAdminActionToken({ kind: 'UPDATE_WORKSPACE_MEMBER', userId: user.id, workspaceId: user.workspace.id, label: user.name || user.phone, nextName: input.name, nextRole: input.role, reason: input.reason })
    const changes = [input.name ? `نام جدید: ${input.name}` : null, input.role ? `نقش جدید: ${input.role}` : null].filter(Boolean).join(' · ')
    return { result: { readyForConfirmation: true }, proposal: { token, title: 'ویرایش عضو', description: `${user.name || user.phone} در «${user.workspace.name}» · ${changes}`, tone: 'warning' } }
  }
  if (name === 'propose_delete_workspace_member') {
    const input = memberDeleteSchema.parse(args)
    const matches = await findUsers(input.userQuery)
    if (matches.length !== 1) return { result: { error: 'AMBIGUOUS_USER', matches } }
    const user = matches[0]
    if (user.platformRole === 'ADMIN' || user.role === 'OWNER') return { result: { error: 'PROTECTED_USER' } }
    const token = createAdminActionToken({ kind: 'DELETE_WORKSPACE_MEMBER', userId: user.id, workspaceId: user.workspace.id, label: user.name || user.phone, reason: input.reason })
    return { result: { readyForConfirmation: true }, proposal: { token, title: 'حذف عضو کسب‌وکار', description: `${user.name || user.phone} از «${user.workspace.name}» حذف می‌شود. این عملیات در تاریخچه ادمین ثبت خواهد شد.`, tone: 'danger' } }
  }
  return { result: { error: 'UNKNOWN_TOOL' } }
}

export async function POST(request: Request) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!(await rateLimit('admin-vigento:owner', 18, 60))) return NextResponse.json({ error: 'RATE_LIMIT' }, { status: 429 })
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
      { role: 'system', content: `You are Vigento Admin, the owner-only operations copilot for ${ADMIN_OWNER_NAME}. Reply in concise Persian. Use tools for every factual platform/database/file claim; never invent values. You may read aggregates, find users/workspaces/agents, inspect a conversation and read one safe project file. Mutations are strictly allow-listed and proposal-only: credit adjustment, resolve conversation, update workspace, toggle agent, and create/update/delete a non-owner workspace member. Every mutation MUST return a confirmation card and is executed only after owner confirmation; never claim it already executed. Workspace owners and platform admins are protected. Creating a member must always keep platformRole USER. Secrets, raw SQL, .env and unrestricted deletion are inaccessible. Prefer toman in user-facing money. Ask for clarification when a target is ambiguous.` },
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
