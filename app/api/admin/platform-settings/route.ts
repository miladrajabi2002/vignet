import { NextResponse } from 'next/server'
import { z } from 'zod'
import { isAdminAuthed } from '@/lib/admin/auth'
import { revalidatePublicSite } from '@/lib/marketing/revalidate-site'
import { isProviderSlug, MAX_PROVIDER_ORDER } from '@/lib/ai/provider-routing'
import {
  getPlatformCommercialConfig,
  PLATFORM_STT_MODEL,
  PLATFORM_VISION_MODEL,
  updatePlatformCommercialConfig,
} from '@/lib/platform/commercial-config'

export const dynamic = 'force-dynamic'

const positiveInt = z.number().int().positive().max(2_000_000_000)
const nonNegativeInt = z.number().int().nonnegative().max(2_000_000_000)
const planSchema = z.object({
  priceIRR: nonNegativeInt,
  priceUSD: nonNegativeInt.max(100_000),
  maxChannels: positiveInt.max(10_000),
  maxProducts: positiveInt.max(1_000_000),
  maxOrders: positiveInt.max(10_000_000),
  maxCustomers: positiveInt.max(10_000_000),
  replyDiscountBps: nonNegativeInt.max(9_000),
  includedCreditIRR: nonNegativeInt,
})

const schema = z.object({
  sttModel: z.literal(PLATFORM_STT_MODEL),
  sttPricePerMinuteIRR: positiveInt,
  visionModel: z.literal(PLATFORM_VISION_MODEL),
  visionPricePerImageIRR: positiveInt,
  providerRouting: z.object({
    mode: z.enum(['order', 'sort']),
    sort: z.enum(['price', 'latency', 'throughput']),
    orders: z.record(
      z.string().trim().min(1).max(160),
      z.array(z.string().refine(isProviderSlug, 'Invalid provider slug')).max(MAX_PROVIDER_ORDER),
    ),
  }),
  replyPricesIRR: z.object({
    fast: positiveInt,
    smart: positiveInt,
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
  const config = await updatePlatformCommercialConfig(parsed.data)
  // Prices are baked into the static public pages (/, /pricing).
  revalidatePublicSite()
  return NextResponse.json(config)
}
