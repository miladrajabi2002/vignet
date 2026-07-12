import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'
import { chatCompletion, getPlatformOpenRouterKey } from '@/lib/ai/openrouter'
import { resolveModelId } from '@/lib/ai/models'
import {
  applyPlatformModelPolicy,
  getPlatformAiConfig,
  hasPlatformAiBudget,
} from '@/lib/ai/platform-config'
import {
  extractVigentoDraft,
  fallbackVigentoDraft,
  vigentoSystemPrompt,
} from '@/lib/ai/vigento-draft'
import { rateLimit } from '@/lib/ratelimit'

const requestSchema = z.object({
  description: z.string().min(20).max(4000),
  language: z.enum(['fa', 'en']).default('fa'),
})

async function recordRun(params: {
  workspaceId: string
  status: 'SUCCEEDED' | 'FAILED'
  modelAlias: string | null
  durationMs: number
  failureCode?: string
}) {
  return prisma.vigentoRun.create({
    data: {
      workspaceId: params.workspaceId,
      status: params.status,
      modelAlias: params.modelAlias,
      durationMs: params.durationMs,
      failureCode: params.failureCode,
    },
    select: { id: true },
  })
}

export async function POST(req: Request) {
  const startedAt = Date.now()
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const allowed = await rateLimit(`vigento-draft:${user.workspaceId}`, 6, 60)
  if (!allowed) return NextResponse.json({ error: 'RATE_LIMIT' }, { status: 429 })

  const json = await req.json().catch(() => null)
  const parsed = requestSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID', issues: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const fallback = fallbackVigentoDraft(parsed.data.description, parsed.data.language)
  if (!getPlatformOpenRouterKey()) {
    const run = await recordRun({
      workspaceId: user.workspaceId,
      status: 'FAILED',
      modelAlias: null,
      durationMs: Date.now() - startedAt,
      failureCode: 'AI_UNAVAILABLE',
    })
    return NextResponse.json({ draft: fallback, runId: run.id, source: 'fallback' })
  }

  let modelAlias = 'fast'
  try {
    const config = await getPlatformAiConfig()
    if (!(await hasPlatformAiBudget(config))) {
      const run = await recordRun({
        workspaceId: user.workspaceId,
        status: 'FAILED',
        modelAlias: null,
        durationMs: Date.now() - startedAt,
        failureCode: 'BUDGET_BLOCKED',
      })
      return NextResponse.json({ draft: fallback, runId: run.id, source: 'fallback' })
    }

    modelAlias = applyPlatformModelPolicy('fast', config)
    const model = resolveModelId(modelAlias, config.providerModels)
    const completion = await chatCompletion({
      model,
      messages: [
        { role: 'system', content: vigentoSystemPrompt(parsed.data.language) },
        { role: 'user', content: parsed.data.description },
      ],
      temperature: 0.25,
      maxTokens: 1800,
    })
    const draft = extractVigentoDraft(completion.content)
    const run = await recordRun({
      workspaceId: user.workspaceId,
      status: 'SUCCEEDED',
      modelAlias,
      durationMs: Date.now() - startedAt,
    })

    await prisma.usageLog
      .create({
        data: {
          workspaceId: user.workspaceId,
          type: 'VIGENTO_DRAFT',
          model,
          promptTokens: completion.usage.promptTokens,
          completionTokens: completion.usage.completionTokens,
          reasoningTokens: completion.usage.reasoningTokens,
          cachedTokens: completion.usage.cachedTokens,
          providerRequestId: completion.usage.providerRequestId,
          cost: completion.usage.costUSD,
        },
      })
      .catch(() => {})

    return NextResponse.json({ draft, runId: run.id, source: 'ai' })
  } catch (error) {
    const failureCode = error instanceof z.ZodError
      ? 'INVALID_MODEL_OUTPUT'
      : error instanceof SyntaxError
        ? 'INVALID_MODEL_JSON'
        : 'PROVIDER_FAILED'
    const run = await recordRun({
      workspaceId: user.workspaceId,
      status: 'FAILED',
      modelAlias,
      durationMs: Date.now() - startedAt,
      failureCode,
    })
    return NextResponse.json({ draft: fallback, runId: run.id, source: 'fallback' })
  }
}
