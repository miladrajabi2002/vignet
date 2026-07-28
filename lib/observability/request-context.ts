import { randomUUID } from 'node:crypto'

type HeaderSource = Pick<Headers, 'get'>

/** Reuse an upstream request id when safe, otherwise create a traceable id. */
export function getRequestId(headers: HeaderSource): string {
  const upstream = headers.get('x-request-id')?.trim()
  if (upstream && /^[a-zA-Z0-9._:-]{8,128}$/.test(upstream)) return upstream
  return randomUUID()
}

export function requestIdHeaders(requestId: string): Record<string, string> {
  return { 'X-Request-Id': requestId }
}
