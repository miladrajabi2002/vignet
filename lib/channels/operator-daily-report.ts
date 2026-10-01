import { prisma } from '@/lib/prisma'
import { getRedis } from '@/lib/redis'
import { decrypt } from '@/lib/crypto'
import { captureError } from '@/lib/errors/capture'
import { TELEGRAM_BASE } from '@/lib/channels/telegram'
import { dailyReportScreen, readOperatorPrefs } from '@/lib/channels/operator-bot-screens'

const TEHRAN_OFFSET_MS = 210 * 60 * 1000
const REPORT_HOUR = 9

/**
 * Morning report from the manager bot: once per Tehran day, from 09:00, to
 * every workspace whose bot is connected and has «گزارش صبحگاهی» on. A Redis
 * key per workspace/day makes the send idempotent across sweeps and restarts.
 */
export async function sweepOperatorDailyReports(): Promise<void> {
  const tehranNow = new Date(Date.now() + TEHRAN_OFFSET_MS)
  const hour = tehranNow.getUTCHours()
  if (hour < REPORT_HOUR || hour >= REPORT_HOUR + 3) return
  const day = tehranNow.toISOString().slice(0, 10)

  const channels = await prisma.operatorChannel.findMany({
    where: { active: true, operatorChatId: { not: null } },
    select: { id: true, workspaceId: true, botToken: true, operatorChatId: true, active: true, prefs: true },
  })
  const redis = getRedis()
  for (const channel of channels) {
    if (!readOperatorPrefs(channel.prefs).daily) continue
    const acquired = await redis.set(`opbot:daily:${channel.workspaceId}:${day}`, '1', 'EX', 2 * 24 * 3600, 'NX')
    if (!acquired) continue
    try {
      const token = decrypt(channel.botToken)
      const screen = await dailyReportScreen(channel)
      await fetch(`${TELEGRAM_BASE}/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: channel.operatorChatId, text: screen.text, parse_mode: 'HTML', reply_markup: screen.keyboard }),
        signal: AbortSignal.timeout(8_000),
      })
    } catch (error) {
      captureError('operator-bot:daily-report', error, { workspaceId: channel.workspaceId })
    }
  }
}
