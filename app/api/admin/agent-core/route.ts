import { NextResponse } from 'next/server'
import { z } from 'zod'
import { isAdminAuthed } from '@/lib/admin/auth'
import {
  UNDERSTANDING_DOMAINS,
  getUnderstandingConfig,
  saveUnderstandingConfig,
} from '@/lib/agent/understand/mode'

export const dynamic = 'force-dynamic'

const modeSchema = z.enum(['off', 'shadow', 'on'])

const schema = z.object({
  mode: modeSchema,
  domains: z.object(Object.fromEntries(UNDERSTANDING_DOMAINS.map((domain) => [domain, z.boolean()])) as Record<(typeof UNDERSTANDING_DOMAINS)[number], z.ZodBoolean>),
  timeoutMs: z.number().int().min(1_500).max(15_000),
  workspaces: z.record(z.string().trim().min(1).max(64), modeSchema).default({}),
})

export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  return NextResponse.json(await getUnderstandingConfig())
}

export async function PUT(req: Request) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'INVALID' }, { status: 400 })
  if (Object.keys(parsed.data.workspaces).length > 500) return NextResponse.json({ error: 'INVALID' }, { status: 400 })
  try {
    return NextResponse.json(await saveUnderstandingConfig(parsed.data))
  } catch (error) {
    console.error('[admin/agent-core] save failed:', error)
    return NextResponse.json({ error: 'SAVE_FAILED' }, { status: 500 })
  }
}
