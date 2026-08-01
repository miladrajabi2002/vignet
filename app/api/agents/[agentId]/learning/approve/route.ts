import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { dispatchIngestion } from '@/lib/queue/jobs'
import { LEARNED_PREFIX } from '@/lib/ai/learning'
import {
  LEARNING_POLICY_VERSION,
  evaluateLearningEligibility,
  isEligibleOperatorLearningMetadata,
} from '@/lib/ai/learning-policy'

type Params = { params: Promise<{ agentId: string }> }

const bodySchema = z.object({
  messageId: z.string().min(1),
  question: z.string().min(1).max(2000),
  answer: z.string().min(1).max(8000),
  validUntil: z.coerce
    .date()
    .refine((date) => date.getTime() > Date.now(), 'validUntil must be in the future')
    .optional(),
})

function normalize(value: string): string {
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim()
}

function faqText(question: string, answer: string): string {
  return `سؤال: ${question}\nپاسخ: ${answer}`
}

async function redispatchExisting(sourceMessageRef: string, agentId: string) {
  const approval = await prisma.knowledgeApproval.findFirst({
    where: { sourceMessageRef, agentId },
    select: {
      knowledgeBaseId: true,
      question: true,
      answer: true,
    },
  })
  if (!approval) return null
  await dispatchIngestion({
    kbId: approval.knowledgeBaseId,
    text: faqText(approval.question, approval.answer),
  })
  return approval
}

/**
 * Promote one reviewed conversation Q&A into the knowledge base. The database
 * transaction owns the idempotency key (sourceMessageRef), the knowledge row,
 * provenance and queue resolution; a retry reuses and re-dispatches the same KB.
 */
export async function POST(req: Request, props: Params) {
  const params = await props.params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const agent = await prisma.agent.findFirst({
    where: { id: params.agentId, workspaceId: user.workspaceId },
    select: { id: true },
  })
  if (!agent) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  const json = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: 'INVALID' }, { status: 400 })

  const { messageId } = parsed.data
  const submittedAnswer = parsed.data.answer.trim()

  const replay = await prisma.knowledgeApproval.findFirst({
    where: { sourceMessageRef: messageId, agentId: agent.id },
    select: { knowledgeBaseId: true, question: true, answer: true },
  })
  if (replay) {
    try {
      await dispatchIngestion({
        kbId: replay.knowledgeBaseId,
        text: faqText(replay.question, replay.answer),
      })
    } catch {
      return NextResponse.json(
        { error: 'INGESTION_UNAVAILABLE', kbId: replay.knowledgeBaseId },
        { status: 503 },
      )
    }
    return NextResponse.json({ ok: true, kbId: replay.knowledgeBaseId, replayed: true })
  }

  try {
    const approved = await prisma.$transaction(async (tx) => {
      const existing = await tx.knowledgeApproval.findUnique({
        where: { sourceMessageRef: messageId },
        select: { knowledgeBaseId: true, question: true, answer: true, agentId: true },
      })
      if (existing) {
        if (existing.agentId !== agent.id) throw new Error('SOURCE_OWNERSHIP_MISMATCH')
        return { ...existing, replayed: true }
      }

      const sourceMessage = await tx.message.findFirst({
        where: {
          id: messageId,
          role: 'ASSISTANT',
          unanswered: true,
          conversation: { agentId: agent.id, workspaceId: user.workspaceId },
        },
        select: { id: true, conversationId: true, metadata: true },
      })
      if (!sourceMessage) throw new Error('LEARNING_SOURCE_NOT_PENDING')

      const metadata = sourceMessage.metadata as Record<string, unknown> | null
      const storedQuestion =
        metadata && typeof metadata.question === 'string'
          ? metadata.question.trim()
          : ''
      if (!storedQuestion) throw new Error('LEARNING_SOURCE_MISSING_QUESTION')
      if (normalize(storedQuestion) !== normalize(parsed.data.question)) {
        throw new Error('LEARNING_QUESTION_MISMATCH')
      }

      const operatorAuthored = metadata?.operator === true
      if (operatorAuthored && !isEligibleOperatorLearningMetadata(metadata)) {
        throw new Error('LEARNING_SOURCE_NOT_ELIGIBLE')
      }

      // Re-check the final edited answer at approval time. A safe suggestion
      // can become private or order-specific after an operator edits it.
      const eligibility = evaluateLearningEligibility(storedQuestion, submittedAnswer)
      if (!eligibility.eligible) throw new Error('LEARNING_CONTENT_NOT_ELIGIBLE')

      const title = storedQuestion.length > 80
        ? `${storedQuestion.slice(0, 80)}…`
        : storedQuestion
      const kb = await tx.knowledgeBase.create({
        data: {
          agentId: agent.id,
          workspaceId: user.workspaceId,
          name: `${LEARNED_PREFIX}${title}`,
          type: 'FAQ',
          status: 'PENDING',
        },
        select: { id: true },
      })

      const now = new Date()
      const contentHash = crypto
        .createHash('sha256')
        .update(`${normalize(storedQuestion)}\n${normalize(submittedAnswer)}`)
        .digest('hex')

      await tx.knowledgeApproval.create({
        data: {
          workspaceId: user.workspaceId,
          agentId: agent.id,
          knowledgeBaseId: kb.id,
          sourceMessageId: sourceMessage.id,
          sourceMessageRef: sourceMessage.id,
          sourceConversationId: sourceMessage.conversationId,
          source: operatorAuthored ? 'OPERATOR_REPLY' : 'AI_UNANSWERED',
          question: storedQuestion,
          answer: submittedAnswer,
          contentHash,
          verifiedByUserId: user.id,
          verifiedByUserRef: user.id,
          verifiedAt: now,
          validFrom: now,
          validUntil: parsed.data.validUntil,
          knowledgeVersion: 1,
          policyVersion: LEARNING_POLICY_VERSION,
        },
      })

      const resolved = await tx.message.updateMany({
        where: { id: sourceMessage.id, unanswered: true },
        data: { unanswered: false },
      })
      if (resolved.count !== 1) throw new Error('LEARNING_SOURCE_RACE')

      return {
        knowledgeBaseId: kb.id,
        question: storedQuestion,
        answer: submittedAnswer,
        agentId: agent.id,
        replayed: false,
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

    try {
      await dispatchIngestion({
        kbId: approved.knowledgeBaseId,
        text: faqText(approved.question, approved.answer),
      })
    } catch {
      return NextResponse.json(
        { error: 'INGESTION_UNAVAILABLE', kbId: approved.knowledgeBaseId },
        { status: 503 },
      )
    }

    return NextResponse.json({
      ok: true,
      kbId: approved.knowledgeBaseId,
      replayed: approved.replayed,
    })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2002' || error.code === 'P2034')
    ) {
      const existing = await redispatchExisting(messageId, agent.id).catch(() => null)
      if (existing) {
        return NextResponse.json({
          ok: true,
          kbId: existing.knowledgeBaseId,
          replayed: true,
        })
      }
    }

    const code = error instanceof Error ? error.message : 'LEARNING_APPROVAL_FAILED'
    const status = code === 'LEARNING_CONTENT_NOT_ELIGIBLE' ||
      code === 'LEARNING_SOURCE_NOT_ELIGIBLE'
      ? 422
      : code.startsWith('LEARNING_')
        ? 409
        : 500
    return NextResponse.json({ error: code }, { status })
  }
}
