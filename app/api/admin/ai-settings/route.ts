import { NextResponse } from 'next/server'
import { z } from 'zod'
import { isAdminAuthed } from '@/lib/admin/auth'
import { MODEL_ALIASES } from '@/lib/ai/models'
import { getPlatformAiConfig, updatePlatformAiConfig } from '@/lib/ai/platform-config'

export const dynamic = 'force-dynamic'

const schema = z.object({
  defaultModel: z.enum(MODEL_ALIASES),
  enabledModels: z.array(z.enum(MODEL_ALIASES)).min(1),
  trialModel: z.enum(MODEL_ALIASES),
  providerModels: z.record(z.string(), z.string().trim().min(1).max(160)).default({}),
  monthlyBudgetUSD: z.number().positive().max(1_000_000).nullable(),
})

export async function GET() {
  if (!isAdminAuthed()) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  return NextResponse.json(await getPlatformAiConfig())
}

export async function PUT(req: Request) {
  if (!isAdminAuthed()) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'INVALID' }, { status: 400 })
  try {
    return NextResponse.json(await updatePlatformAiConfig(parsed.data))
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'INVALID' },
      { status: 400 },
    )
  }
}
