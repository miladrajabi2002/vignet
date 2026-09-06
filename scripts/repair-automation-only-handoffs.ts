import 'dotenv/config'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'

// Dry run by default. Apply only after deploying the automation-only routing fix:
// npx tsx scripts/repair-automation-only-handoffs.ts --apply
const reason = 'پیام بدون پاسخ خودکار (حالت فقط-اتوماسیون بدون سناریوی منطبق)'
const automaticReplies = new Set([
  'پیامتون دریافت شد و برای همکار ما ارسال شد. به‌زودی پاسخ می‌گیرید',
  'لطفاً کمی صبر کنید، همکار ما به‌زودی پاسخ می‌دهد',
])
const notificationTitles = ['گفتگو به اپراتور انسانی منتقل شد', 'پیام مشتری بدون پاسخ خودکار ماند']
const prisma = new PrismaClient()
const include = {
  messages: { orderBy: { id: 'asc' } },
  handoffAlerts: { orderBy: { id: 'asc' } },
  salesInsight: true,
} as const

async function main() {
  const apply = process.argv.includes('--apply')
  const conversations = await prisma.conversation.findMany({
    where: { channel: 'INSTAGRAM', handoffAlerts: { some: { reason, state: 'open' } } },
    include,
    orderBy: { id: 'asc' },
  })
  const eligible = conversations.filter((c) =>
    !c.handoffAlerts.some((a) => a.claimedBy || a.state === 'claimed' || (a.state !== 'resolved' && a.reason !== reason)) &&
    !c.messages.some((m) => (m.metadata as Record<string, unknown> | null)?.operator === true),
  )
  const workspaces = await prisma.workspace.findMany({
    where: { id: { in: [...new Set(eligible.map((c) => c.workspaceId))] } },
    select: { id: true, name: true },
  })
  const counts = workspaces.map((w) => ({
    ...w, conversations: eligible.filter((c) => c.workspaceId === w.id).length,
  }))
  console.log(JSON.stringify({ apply, found: conversations.length, eligible: eligible.length, skipped: conversations.length - eligible.length, workspaces: counts }))
  if (!apply || !eligible.length) return

  const notifications = await prisma.notification.findMany({
    where: { type: 'HANDOFF', title: { in: notificationTitles }, link: { in: eligible.map((c) => `/conversations/${c.id}`) } },
  })
  const backupDir = '/var/backups/vignet/automation-handoff-repair'
  await mkdir(backupDir, { recursive: true, mode: 0o700 })
  const backup = join(backupDir, `repair-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  // Preserve original rows before any mutation. Never delete customer messages.
  await writeFile(backup, JSON.stringify({ conversations: eligible, notifications }, null, 2), { mode: 0o600, flag: 'wx' })
  const results = { resolvedConversations: 0, reopenedConversations: 0, alerts: 0, notifications: 0, concurrentChangesSkipped: 0 }
  for (const snapshot of eligible) {
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.conversation.findUnique({ where: { id: snapshot.id }, include })
      // Skip concurrent user/operator edits; don't overwrite work made since backup.
      if (!current || JSON.stringify(current) !== JSON.stringify(snapshot)) return null
      const onlyAutomatic = current.messages.every((m) => m.role !== 'ASSISTANT' || automaticReplies.has(m.content))
      const status = current.status === 'RESOLVED' || onlyAutomatic ? 'RESOLVED' : 'OPEN'
      const alerts = await tx.handoffAlert.updateMany({
        where: { conversationId: current.id, reason, state: 'open', claimedBy: null },
        data: { state: 'resolved', resolvedAt: new Date() },
      })
      await tx.conversation.update({
        where: { id: current.id },
        data: { status, handedOff: false, summary: null },
      })
      const marked = await tx.notification.updateMany({
        where: { id: { in: notifications.filter((n) => n.workspaceId === current.workspaceId && n.link === `/conversations/${current.id}`).map((n) => n.id) }, read: false },
        data: { read: true },
      })
      return { status, alerts: alerts.count, notifications: marked.count }
    }, { isolationLevel: 'Serializable', timeout: 15_000 })
    if (!result) { results.concurrentChangesSkipped++; continue }
    if (result.status === 'RESOLVED') results.resolvedConversations++
    else results.reopenedConversations++
    results.alerts += result.alerts
    results.notifications += result.notifications
  }
  await writeFile(`${backup}.result.json`, JSON.stringify({ ...results, workspaces: counts }, null, 2), { mode: 0o600, flag: 'wx' })
  console.log(JSON.stringify({ backup, ...results }))
}

main().catch((error) => { console.error(error); process.exitCode = 1 }).finally(() => prisma.$disconnect())
