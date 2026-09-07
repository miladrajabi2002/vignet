/**
 * Purge dead woo-webhook jobs: failed with WEBHOOK_DELIVERY_NOT_FOUND —
 * their backing StoreWebhookDelivery rows were already cleaned up, so they
 * can never succeed. Removes them from the failed set via BullMQ API.
 * Run on the server: npx tsx -r dotenv/config scripts/purge-woo-dead.ts
 */
import { Queue } from 'bullmq'
import { createQueueConnection } from '../lib/queue/connection'

async function main() {
  const q = new Queue('woo-webhook', {
    connection: createQueueConnection({ failFast: true }),
  })
  const failed = await q.getFailed(0, -1)
  console.log(`failed jobs: ${failed.length}`)
  let removed = 0
  let kept = 0
  for (const job of failed) {
    const reason = job.failedReason ?? ''
    if (reason.startsWith('WEBHOOK_DELIVERY_NOT_FOUND')) {
      await job.remove()
      removed++
    } else {
      kept++
      console.log(`kept ${job.id} (${reason.slice(0, 60)})`)
    }
  }
  console.log(`removed ${removed} dead jobs, kept ${kept}`)
  await q.close()
  process.exit(0)
}

main().catch((e) => {
  console.error('purge-woo-dead failed:', e)
  process.exit(1)
})
