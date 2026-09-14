/**
 * Live smoke test for the A14 vision pipeline (run with tsx + dotenv).
 * Downloads the real Instagram CDN image the customer sent and describes it
 * with the platform vision model, exercising downloadImage + describeImage +
 * vision billing exactly as the channel handler does.
 */
import { downloadImage, describeImage } from '../lib/ai/vision'

async function main() {
  const url = process.argv[2]
  if (!url) throw new Error('usage: tsx scripts/vision-live-smoke.ts <image-url>')

  console.log('[1] downloadImage …')
  const dl = await downloadImage(url)
  if (!dl) {
    console.error('DOWNLOAD FAILED')
    process.exit(1)
  }
  console.log(`    ok: ${dl.image.length} bytes, mime=${dl.mime}`)

  console.log('[2] describeImage …')
  const result = await describeImage({
    image: dl.image,
    mime: dl.mime,
    language: 'fa',
    workspaceId: 'cmrluel250000eoivhfd6vih3',
    agentId: 'cmrlv4xcs0004eoivgp4euuoe',
    idempotencyKey: `vision:smoke:${Date.now()}`,
  })
  if (result.status !== 'ok') {
    console.error(`DESCRIBE FAILED: ${result.status}`)
    process.exit(1)
  }
  console.log('---- DESCRIPTION ----')
  console.log(result.description)
  console.log('---------------------')
  process.exit(0)
}

main().catch((e) => {
  console.error('FATAL:', e)
  process.exit(1)
})
