import { prisma } from '@/lib/prisma'
import { LEARNING_REVIEW_VERSION, learningRecord, uniqueLearningItems } from '@/lib/ai/learning-candidates'

export async function getLearningQueue(workspaceId: string, agentId: string) {
  const rows = await prisma.message.findMany({
    where: { role: 'ASSISTANT', unanswered: true, conversation: { agentId, workspaceId } },
    orderBy: { createdAt: 'desc' }, take: 200,
    select: { id: true, metadata: true, conversationId: true },
  })
  return {
    items: uniqueLearningItems(rows),
    unanalyzedCount: rows.filter((row) => typeof learningRecord(row.metadata).question === 'string' &&
      learningRecord(learningRecord(row.metadata).learningReview).version !== LEARNING_REVIEW_VERSION).length,
    excludedCount: rows.filter((row) => {
      const review = learningRecord(learningRecord(row.metadata).learningReview)
      return review.version === LEARNING_REVIEW_VERSION && review.eligible === false
    }).length,
  }
}
