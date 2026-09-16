import { describe, expect, it } from 'vitest'
import { normalizeAudioForTranscription, supportedAudioFormat } from '@/lib/voice/audio-normalize'

function pcmWav(): Buffer {
  const samples = 1_600
  const dataSize = samples * 2
  const wav = Buffer.alloc(44 + dataSize)
  wav.write('RIFF', 0)
  wav.writeUInt32LE(36 + dataSize, 4)
  wav.write('WAVEfmt ', 8)
  wav.writeUInt32LE(16, 16)
  wav.writeUInt16LE(1, 20)
  wav.writeUInt16LE(1, 22)
  wav.writeUInt32LE(16_000, 24)
  wav.writeUInt32LE(32_000, 28)
  wav.writeUInt16LE(2, 32)
  wav.writeUInt16LE(16, 34)
  wav.write('data', 36)
  wav.writeUInt32LE(dataSize, 40)
  return wav
}

describe('STT audio normalization', () => {
  it('detects model-supported formats from bytes instead of an unreliable MIME header', () => {
    expect(supportedAudioFormat(pcmWav())).toBe('wav')
    expect(supportedAudioFormat(Buffer.from('fLaCdata'))).toBe('flac')
    expect(supportedAudioFormat(Buffer.from('ID3data'))).toBe('mp3')
    expect(supportedAudioFormat(Buffer.from('OggSdata'))).toBeNull()
  })

  it('does not re-encode an already supported WAV input', async () => {
    const input = pcmWav()
    const result = await normalizeAudioForTranscription(input)
    expect(result).toEqual({ audio: input, format: 'wav', converted: false })
  })
})
