/**
 * Live smoke test for the inbound voice pipeline (run with tsx + dotenv):
 * downloadAudio (UA + video/mp4 container fix) → transcribeAudio (OpenRouter).
 */
import { downloadAudio, transcribeAudio } from '../lib/voice/stt'

async function main() {
  const url = process.argv[2]
  if (!url) throw new Error('usage: tsx scripts/stt-live-smoke.ts <audio-url>')

  console.log('[1] downloadAudio …')
  const dl = await downloadAudio(url)
  if (!dl) {
    console.error('DOWNLOAD FAILED')
    process.exit(1)
  }
  console.log(`    ok: ${dl.audio.length} bytes, mime=${dl.mime}`)

  console.log('[2] transcribeAudio …')
  const transcript = await transcribeAudio({
    audio: dl.audio,
    mime: dl.mime,
    workspaceId: 'cmrluel250000eoivhfd6vih3',
    agentId: 'cmrlv4xcs0004eoivgp4euuoe',
    idempotencyKey: `stt:smoke:${Date.now()}`,
  })
  if (!transcript) {
    console.error('TRANSCRIBE FAILED (empty)')
    process.exit(1)
  }
  console.log('---- TRANSCRIPT ----')
  console.log(transcript)
  console.log('--------------------')
  process.exit(0)
}

main().catch((e) => {
  console.error('FATAL:', e)
  process.exit(1)
})
