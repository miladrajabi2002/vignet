import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { dispatchIngestion } from '@/lib/queue/jobs'
import { evaluateLearningEligibility, LEARNING_POLICY_VERSION } from '@/lib/ai/learning-policy'
import { LEARNED_PREFIX } from '@/lib/ai/learning'

const schema = z.object({
  question: z.string().trim().min(3).max(2000),
  answer: z.string().trim().min(3).max(8000),
  version: z.number().int().positive(),
})

export async function PATCH(req: Request, props: { params: Promise<{ agentId: string; kbId: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const { agentId, kbId } = await props.params
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'INVALID' }, { status: 400 })
  const { question, answer, version } = parsed.data
  if (!evaluateLearningEligibility(question, answer).eligible) return NextResponse.json({ error: 'LEARNING_CONTENT_NOT_ELIGIBLE' }, { status: 422 })
  try {
    await prisma.$transaction(async (tx) => {
      const approval = await tx.knowledgeApproval.findFirst({ where: { workspaceId: user.workspaceId, agentId, knowledgeBaseId: kbId } })
      if (!approval) throw new Error('NOT_FOUND')
      if (approval.knowledgeVersion !== version) throw new Error('VERSION_CONFLICT')
      await tx.knowledgeApproval.update({ where: { id: approval.id }, data: {
        question, answer, knowledgeVersion: { increment: 1 },
        verifiedAt: new Date(), verifiedByUserId: user.id, verifiedByUserRef: user.id,
        contentHash: crypto.createHash('sha256').update(`${question}\n${answer}`).digest('hex'),
        policyVersion: LEARNING_POLICY_VERSION,
      } })
      await tx.knowledgeBase.update({ where: { id: kbId }, data: {
        name: `${LEARNED_PREFIX}${question.slice(0, 80)}`, status: 'PENDING', errorMsg: null,
      } })
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  } catch (error) {
    const code = error instanceof Error ? error.message : 'UPDATE_FAILED'
    const conflict = code === 'VERSION_CONFLICT' || (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034')
    return NextResponse.json({ error: conflict ? 'VERSION_CONFLICT' : code === 'NOT_FOUND' ? code : 'UPDATE_FAILED' }, { status: code === 'NOT_FOUND' ? 404 : conflict ? 409 : 500 })
  }
  try {
    await dispatchIngestion({ kbId, text: `سؤال: ${question}\nپاسخ: ${answer}` })
  } catch {
    await prisma.knowledgeBase.updateMany({ where: { id: kbId, agentId, workspaceId: user.workspaceId, status: 'PENDING' }, data: { status: 'ERROR', errorMsg: 'INGESTION_UNAVAILABLE' } })
    return NextResponse.json({ error: 'INGESTION_UNAVAILABLE', saved: true }, { status: 503 })
  }
  return NextResponse.json({ ok: true })
}
