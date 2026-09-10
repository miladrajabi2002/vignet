import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { rateLimit } from '@/lib/ratelimit'
import { getPlatformOpenRouterKey } from '@/lib/ai/openrouter'
import { getPlatformAiConfig, hasPlatformAiBudget } from '@/lib/ai/platform-config'
import { createWorkspaceVigentoContext } from '@/lib/vigento/access'
import { VIGENTO_USER_SKILL_VERSION } from '@/lib/vigento/profiles'
import { WorkspaceVigentoRepository } from '@/lib/vigento/workspace-repository'
import { runWorkspaceVigento } from '@/lib/vigento/workspace-agent'

const inputSchema = z.object({
  message: z.string().trim().min(2).max(1000),
  language: z.enum(['fa', 'en']).default('fa'),
}).strict()

type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>

function createRuntime(user: CurrentUser) {
  const context = createWorkspaceVigentoContext(user)
  return { context, repository: new WorkspaceVigentoRepository(context) }
}

async function fallbackAnswer(
  repository: WorkspaceVigentoRepository,
  language: 'fa' | 'en',
): Promise<string> {
  const overview = await repository.getOverview(1)
  const conversationCount = Object.values(overview.conversations)
    .reduce((sum, count) => sum + count, 0)
  return language === 'fa'
    ? `در ۲۴ ساعت اخیر ${conversationCount.toLocaleString('fa-IR')} گفتگو و ${overview.messages.toLocaleString('fa-IR')} پیام ثبت شده است. ${overview.activeAppointments.toLocaleString('fa-IR')} رزرو فعال دارید و هزینهٔ ثبت‌شدهٔ AI ${overview.ai.chargedToman.toLocaleString('fa-IR')} تومان بوده است.`
    : `In the last 24 hours, ${conversationCount} conversations and ${overview.messages} messages were recorded. You have ${overview.activeAppointments} active bookings, and recorded AI cost was ${overview.ai.chargedToman} toman.`
}

function failureCode(error: unknown): string {
  const value = error instanceof Error ? error.message : 'VIGENTO_FAILED'
  return /^[A-Z0-9_]+$/.test(value) ? value.slice(0, 80) : 'VIGENTO_FAILED'
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const { repository } = createRuntime(user)
  return NextResponse.json({ messages: await repository.loadHistory(40) })
}

export async function DELETE() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const { repository } = createRuntime(user)
  await repository.clearHistory()
  return NextResponse.json({ ok: true })
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!(await rateLimit(`vigento-assistant:${user.workspaceId}:${user.id}`, 8, 60))) {
    return NextResponse.json({ error: 'RATE_LIMIT' }, { status: 429 })
  }
  const parsed = inputSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'INVALID' }, { status: 400 })

  const startedAt = Date.now()
  const { context, repository } = createRuntime(user)
  const { message, language } = parsed.data
  await repository.saveMessage('USER', message)

  const answerWithFallback = async (code: string) => {
    const answer = await fallbackAnswer(repository, language)
    await repository.saveMessage('ASSISTANT', answer)
    await prisma.vigentoRun.create({
      data: {
        workspaceId: user.workspaceId,
        status: 'FAILED',
        skillVersion: VIGENTO_USER_SKILL_VERSION,
        toolNames: [],
        principalKind: context.kind,
        durationMs: Date.now() - startedAt,
        failureCode: code,
      },
    }).catch(() => null)
    return NextResponse.json({ answer, source: 'facts', skillVersion: VIGENTO_USER_SKILL_VERSION })
  }

  if (!getPlatformOpenRouterKey()) return answerWithFallback('PLATFORM_AI_NOT_CONFIGURED')

  try {
    const config = await getPlatformAiConfig()
    if (!(await hasPlatformAiBudget(config))) return answerWithFallback('PLATFORM_AI_BUDGET_REACHED')

    const history = await repository.loadHistory(18)
    const result = await runWorkspaceVigento({
      repository,
      language,
      history: history.slice(0, -1),
      message,
    })
    await repository.saveMessage('ASSISTANT', result.answer)
    await Promise.all([
      prisma.usageLog.create({
        data: {
          workspaceId: user.workspaceId,
          type: 'VIGENTO_ASSISTANT',
          model: result.providerModel,
          promptTokens: result.usage.promptTokens,
          completionTokens: result.usage.completionTokens,
          reasoningTokens: result.usage.reasoningTokens,
          cachedTokens: result.usage.cachedTokens,
          providerRequestId: result.usage.providerRequestId,
          cost: result.usage.costUSD,
        },
      }).catch(() => null),
      prisma.vigentoRun.create({
        data: {
          workspaceId: user.workspaceId,
          status: 'SUCCEEDED',
          modelAlias: result.modelAlias,
          skillVersion: VIGENTO_USER_SKILL_VERSION,
          toolNames: result.toolNames,
          principalKind: context.kind,
          durationMs: Date.now() - startedAt,
        },
      }).catch(() => null),
    ])
    return NextResponse.json({
      answer: result.answer,
      source: 'ai',
      modelAlias: result.modelAlias,
      skillVersion: VIGENTO_USER_SKILL_VERSION,
    })
  } catch (error) {
    return answerWithFallback(failureCode(error))
  }
}
