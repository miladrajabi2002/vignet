import { NextResponse } from 'next/server'
import { z } from 'zod'
import { isAdminAuthed } from '@/lib/admin/auth'
import {
  getPlatformCommercialConfig,
  updatePlatformCommercialConfig,
} from '@/lib/platform/commercial-config'

export const dynamic = 'force-dynamic'

const positiveInt = z.number().int().positive().max(2_000_000_000)
const nonNegativeInt = z.number().int().nonnegative().max(2_000_000_000)
const planSchema = z.object({
  priceIRR: nonNegativeInt,
  priceUSD: nonNegativeInt.max(100_000),
  maxAgents: positiveInt.max(10_000),
  replyDiscountBps: nonNegativeInt.max(9_000),
  includedCreditIRR: nonNegativeInt,
})

const schema = z.object({
  sttModel: z.string().trim().min(3).max(180),
  ttsModel: z.string().trim().min(3).max(180),
  providerSort: z.enum(['price', 'latency', 'throughput']),
  zeroDataRetention: z.boolean(),
  replyPricesIRR: z.object({
    fast: positiveInt,
    standard: positiveInt,
    balanced: positiveInt,
    premium: positiveInt,
  }),
  trialCreditIRR: positiveInt,
  financeUsdToIRR: positiveInt.nullable(),
  plans: z.object({
    TRIAL: planSchema,
    STARTER: planSchema,
    PRO: planSchema,
    BUSINESS: planSchema,
  }),
})

export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  return NextResponse.json(await getPlatformCommercialConfig())
}

export async function PUT(request: Request) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_SETTINGS', issues: parsed.error.flatten() }, { status: 400 })
  }
  return NextResponse.json(await updatePlatformCommercialConfig(parsed.data))
}
