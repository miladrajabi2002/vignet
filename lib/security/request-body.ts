export class RequestBodyTooLargeError extends Error {
  constructor() {
    super('REQUEST_BODY_TOO_LARGE')
    this.name = 'RequestBodyTooLargeError'
  }
}

/** Read a request body while enforcing the limit during streaming. */
export async function readBoundedRequestBody(
  req: Request,
  maxBytes: number,
): Promise<Buffer> {
  const declared = req.headers.get('content-length')
  if (declared && /^\d+$/.test(declared) && Number(declared) > maxBytes) {
    throw new RequestBodyTooLargeError()
  }
  if (!req.body) return Buffer.alloc(0)

  const reader = req.body.getReader()
  const chunks: Buffer[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined)
        throw new RequestBodyTooLargeError()
      }
      chunks.push(Buffer.from(value))
    }
  } finally {
    reader.releaseLock()
  }
  return Buffer.concat(chunks, total)
}
