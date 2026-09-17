import { spawn } from 'node:child_process'
import ffmpegPath from 'ffmpeg-static'

export type TranscriptionAudio = {
  audio: Buffer
  format: 'wav' | 'mp3' | 'flac' | 'mp4' | 'ogg' | 'webm'
}

const CONVERSION_TIMEOUT_MS = 30_000
const MAX_CONVERTED_BYTES = 50 * 1024 * 1024
const MAX_ERROR_TEXT = 4_000

/** Detect GPT Transcribe formats from bytes instead of unreliable CDN MIME labels. */
export function supportedAudioFormat(audio: Buffer): TranscriptionAudio['format'] | null {
  if (audio.length >= 12
    && audio.subarray(0, 4).toString('ascii') === 'RIFF'
    && audio.subarray(8, 12).toString('ascii') === 'WAVE') return 'wav'
  if (audio.length >= 4 && audio.subarray(0, 4).toString('ascii') === 'fLaC') return 'flac'
  if (audio.length >= 3 && audio.subarray(0, 3).toString('ascii') === 'ID3') return 'mp3'
  if (audio.length >= 2
    && audio[0] === 0xff
    && (audio[1] & 0xe0) === 0xe0
    && audio[1] !== 0xf1
    && audio[1] !== 0xf9) return 'mp3'
  if (audio.length >= 12 && audio.subarray(4, 8).toString('ascii') === 'ftyp') return 'mp4'
  if (audio.length >= 4 && audio.subarray(0, 4).toString('ascii') === 'OggS') return 'ogg'
  if (audio.length >= 4
    && audio[0] === 0x1a
    && audio[1] === 0x45
    && audio[2] === 0xdf
    && audio[3] === 0xa3) return 'webm'
  return null
}

/**
 * GPT Transcribe accepts the common channel containers directly, including
 * MP4/M4A, Ogg and WebM. Preserve those original bytes to avoid a lossy and
 * CPU-heavy re-encode. Keep ffmpeg only as a fallback for raw AAC, malformed
 * labels and uncommon containers.
 */
export async function normalizeAudioForTranscription(
  audio: Buffer,
): Promise<TranscriptionAudio> {
  const directFormat = supportedAudioFormat(audio)
  if (directFormat) return { audio, format: directFormat }
  const binaryPath = ffmpegPath
  if (!binaryPath) throw new Error('STT_FFMPEG_UNAVAILABLE')

  return new Promise<TranscriptionAudio>((resolve, reject) => {
    const child = spawn(binaryPath, [
      '-hide_banner',
      '-loglevel', 'error',
      '-i', 'pipe:0',
      '-map', '0:a:0',
      '-vn',
      '-ac', '1',
      '-ar', '16000',
      '-codec:a', 'libmp3lame',
      '-b:a', '64k',
      '-f', 'mp3',
      'pipe:1',
    ], { stdio: ['pipe', 'pipe', 'pipe'] })

    const output: Buffer[] = []
    const errors: Buffer[] = []
    let outputSize = 0
    let errorSize = 0
    let settled = false

    const fail = (error: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      child.kill('SIGKILL')
      reject(error)
    }
    const timer = setTimeout(() => fail(new Error('STT_AUDIO_CONVERSION_TIMEOUT')), CONVERSION_TIMEOUT_MS)

    child.stdout.on('data', (chunk: Buffer) => {
      outputSize += chunk.length
      if (outputSize > MAX_CONVERTED_BYTES) {
        fail(new Error('STT_AUDIO_CONVERSION_TOO_LARGE'))
        return
      }
      output.push(Buffer.from(chunk))
    })
    child.stderr.on('data', (chunk: Buffer) => {
      if (errorSize < MAX_ERROR_TEXT) {
        errors.push(Buffer.from(chunk))
        errorSize += chunk.length
      }
    })
    child.on('error', (error) => fail(new Error('STT_AUDIO_CONVERSION_FAILED', { cause: error })))
    child.on('close', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (code !== 0 || outputSize === 0) {
        const detail = Buffer.concat(errors).toString('utf8').trim().slice(0, MAX_ERROR_TEXT)
        reject(new Error('STT_AUDIO_CONVERSION_FAILED', { cause: detail || `ffmpeg exit ${code}` }))
        return
      }
      resolve({ audio: Buffer.concat(output), format: 'mp3' })
    })
    // ffmpeg may close stdin early for malformed input; the process close event
    // above carries the useful diagnostic and owns promise settlement.
    child.stdin.on('error', () => {})
    child.stdin.end(audio)
  })
}
