/**
 * Retry failed woo-webhook jobs using BullMQ's own retry() API (safe —
 * preserves internal job state bookkeeping).
 * Run on the server: npx tsx -r dotenv/config scripts/retry-woo-failed.ts
 */
import { Queue } from 'bullmq'
import { createQueueConnection } from '../lib/queue/connection'

async function main() {
  const q = new Queue('woo-webhook', {
    connection: createQueueConnection({ failFast: true }),
  })
  const failed = await q.getFailed(0, -1)
  console.log(`found ${failed.length} failed woo-webhook jobs`)
  let ok = 0
  let skipped = 0
  for (const job of failed) {
    try {
      await job.retry()
      ok++
    } catch (e) {
      skipped++
      console.warn(`job ${job.id} not retryable: ${(e as Error).message}`)
    }
  }
  console.log(`retrying ${ok} jobs, skipped ${skipped}`)
  await q.close()
  process.exit(0)
}

main().catch((e) => {
  console.error('retry-woo-failed failed:', e)
  process.exit(1)
})
