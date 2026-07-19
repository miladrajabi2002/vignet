function startsWith(buffer: Buffer, signature: readonly number[]): boolean {
  return signature.every((byte, index) => buffer[index] === byte)
}

export function matchesImageSignature(buffer: Buffer, mime: string): boolean {
  switch (mime.toLowerCase()) {
    case 'image/jpeg':
      return startsWith(buffer, [0xff, 0xd8, 0xff])
    case 'image/png':
      return startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    case 'image/gif': {
      const header = buffer.subarray(0, 6).toString('ascii')
      return header === 'GIF87a' || header === 'GIF89a'
    }
    case 'image/webp':
      return (
        buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
        buffer.subarray(8, 12).toString('ascii') === 'WEBP'
      )
    case 'image/avif': {
      if (buffer.subarray(4, 8).toString('ascii') !== 'ftyp') return false
      const brands = buffer.subarray(8, 32).toString('ascii')
      return brands.includes('avif') || brands.includes('avis')
    }
    default:
      return false
  }
}

export function matchesPdfSignature(buffer: Buffer): boolean {
  return buffer.subarray(0, 5).toString('ascii') === '%PDF-'
}

export function isProbablyUtf8Text(buffer: Buffer): boolean {
  if (buffer.includes(0)) return false
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buffer)
    return true
  } catch {
    return false
  }
}
