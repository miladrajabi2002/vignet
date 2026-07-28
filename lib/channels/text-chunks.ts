/**
 * Split an outbound platform message at readable boundaries without dropping
 * or duplicating content. Limits are measured in UTF-16 code units because
 * Telegram/Meta document their text caps that way.
 */
export function splitOutboundText(value: string, limit: number): string[] {
  const text = value.trim()
  if (!text) return []

  const chunkLimit = Math.max(32, Math.floor(limit))
  const chunks: string[] = []
  let start = 0

  while (start < text.length) {
    let end = Math.min(text.length, start + chunkLimit)
    // Never cut between a UTF-16 surrogate pair (emoji and some symbols).
    if (end < text.length && /[\uD800-\uDBFF]/.test(text[end - 1] ?? '')) end--

    if (end < text.length) {
      const window = text.slice(start, end)
      const candidates = [
        window.lastIndexOf('\n\n'),
        window.lastIndexOf('\n'),
        window.lastIndexOf('؟ '),
        window.lastIndexOf('! '),
        window.lastIndexOf('. '),
        window.lastIndexOf('، '),
        window.lastIndexOf(' '),
      ]
      const boundary = Math.max(...candidates)
      // Avoid tiny chunks just because an early whitespace exists.
      if (boundary >= Math.floor(chunkLimit * 0.55)) end = start + boundary + 1
    }

    const chunk = text.slice(start, end).trim()
    if (chunk) chunks.push(chunk)
    start = end
    while (start < text.length && /\s/.test(text[start])) start++
  }

  return chunks
}
