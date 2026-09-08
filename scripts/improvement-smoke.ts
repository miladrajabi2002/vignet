import 'dotenv/config'
import crypto from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { promptConfigSchema } from '@/lib/validations/agent'
import { processImprovement } from '@/lib/improvement/review'
import { previewImprovement } from '@/lib/improvement/actions'
import { improvementOverview } from '@/lib/improvement/service'
import { selectionSchema } from '@/lib/improvement/types'

/** Bounded provider smoke test: only synthetic, inactive, report-excluded data.
 * It calls the analysis model, but never applies a change or sends a message. */
async function main() {
  const tag = crypto.randomUUID()
  const workspace = await prisma.workspace.create({ data: { name: 'Improvement synthetic smoke', slug: `improvement-smoke-${tag}`, excludeFromAdminReports: true } })
  try {
    const user = await prisma.user.create({ data: { workspaceId: workspace.id, phone: `smoke-${tag}` } })
    const config = promptConfigSchema.parse({ personality: 'پشتیبان یک فروشگاه آزمایشی', format: { length: 'long' }, conversation: { avoidRepeatedGreetings: false } })
    const agent = await prisma.agent.create({ data: { workspaceId: workspace.id, name: 'Synthetic smoke agent', systemPrompt: 'پاسخ دقیق و کوتاه به درخواست مشتری بده.', promptConfig: config, active: false } })
    const conversation = await prisma.conversation.create({ data: { workspaceId: workspace.id, agentId: agent.id, channel: 'API', lastMessageAt: new Date(), messageCount: 4 } })
    const contents = [
      ['USER', 'سلام، چطور می‌توانم درخواست تعویض بدهم؟ لطفاً کوتاه جواب بده.'],
      ['ASSISTANT', 'سلام و خوش آمدید به فروشگاه ما! بسیار خوشحالیم که اینجا هستید. برای پاسخ به سؤال شما ابتدا می‌خواهم شما را با فروشگاه آشنا کنم. مجموعه ما همواره در تلاش است بهترین تجربه را برای مشتری فراهم کند. چطور می‌توانم به شما کمک کنم؟'],
      ['USER', 'گفتم چطور درخواست تعویض بدهم؟ فقط مراحلش را بگو.'],
      ['ASSISTANT', 'سلام و خوش آمدید! خیلی خوشحالم که با ما در ارتباط هستید. برای اینکه بتوانم کمک کنم لطفاً بگویید چه کمکی می‌خواهید.'],
    ] as const
    for (let i = 0; i < contents.length; i++) await prisma.message.create({ data: { conversationId: conversation.id, role: contents[i][0], content: contents[i][1], createdAt: new Date(Date.now() - 10000 + i * 1000) } })
    const run = await prisma.improvementRun.create({ data: { workspaceId: workspace.id, agentId: agent.id, createdBy: user.id, total: 1,
      filters: selectionSchema.parse({ count: 1 }), snapshot: { systemPrompt: agent.systemPrompt, promptConfig: config, roleTemplate: null, language: 'fa', model: null },
      reviews: { create: { conversationId: conversation.id } } } })
    await processImprovement({ runId: run.id })
    const saved = await prisma.improvementRun.findUniqueOrThrow({ where: { id: run.id } })
    if (saved.status !== 'DONE') throw new Error(`SMOKE_ANALYSIS_${saved.status}`)
    const overview = await improvementOverview(workspace.id, agent.id)
    if (!overview.suggestions.length) throw new Error('SMOKE_NO_FINDINGS')
    const behavior = overview.suggestions.find((s) => s.kind === 'BEHAVIOR')
    if (behavior) await previewImprovement(workspace.id, agent.id, behavior.id, behavior.version)
    await improvementOverview(workspace.id, agent.id, 1, true)
    console.log(JSON.stringify({ status: saved.status, findings: overview.suggestions.map((s) => s.kind), previewTested: !!behavior }))
  } finally {
    await prisma.workspace.delete({ where: { id: workspace.id } })
    await prisma.$disconnect()
  }
}
main().catch((error) => { console.error(error instanceof Error ? error.message : 'SMOKE_FAILED'); process.exitCode = 1 })
