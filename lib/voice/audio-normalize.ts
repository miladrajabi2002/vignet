import { spawn } from 'node:child_process'
import ffmpegPath from 'ffmpeg-static'

export type TranscriptionAudio = {
  audio: Buffer
  format: 'wav' | 'mp3' | 'flac'
  converted: boolean
}

const CONVERSION_TIMEOUT_MS = 30_000
const MAX_CONVERTED_BYTES = 50 * 1024 * 1024
const MAX_ERROR_TEXT = 4_000

/** Detect formats that MAI-Transcribe accepts without relying on CDN MIME labels. */
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
  return null
}

/**
 * MAI-Transcribe's Azure backend accepts WAV, MP3 and FLAC. Instagram commonly
 * sends AAC in an MP4/M4A container (and sometimes Ogg bytes behind a video/mp4
 * header), so normalize every unsupported container to a compact 16 kHz mono
 * MP3 before upload. Keeping ffmpeg in an npm dependency makes worker hosts
 * independent of a system-level ffmpeg installation.
 */
export async function normalizeAudioForTranscription(
  audio: Buffer,
): Promise<TranscriptionAudio> {
  const directFormat = supportedAudioFormat(audio)
  if (directFormat) return { audio, format: directFormat, converted: false }
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
      resolve({ audio: Buffer.concat(output), format: 'mp3', converted: true })
    })
    // ffmpeg may close stdin early for malformed input; the process close event
    // above carries the useful diagnostic and owns promise settlement.
    child.stdin.on('error', () => {})
    child.stdin.end(audio)
  })
}
