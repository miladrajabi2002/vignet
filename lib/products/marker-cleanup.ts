/**
 * Product marker cleanup utilities.
 *
 * When a product is deleted, its `[[product:{…}]]` markers remain embedded
 * in old assistant messages. Without cleanup, those messages continue to
 * render product cards in the inbox/showcase — but the product no longer
 * exists, so the card either shows stale data or (worse) breaks the UI
 * when an operator clicks through to a missing product page.
 *
 * These functions find and strip markers that reference a given set of
 * product IDs, leaving all other text and markers intact.
 */

const PRODUCT_PREFIX = '[[product:'

/**
 * Find the end of a `[[product:{…}]]` token starting at `jsonStart`.
 * Counts brace depth and respects string literals so nested JSON objects
 * (attributes, specs) are handled correctly.
 */
function findTokenBounds(
  raw: string,
  jsonStart: number,
): { jsonEnd: number; tokenEnd: number } | null {
  let depth = 0
  let quoted = false
  let escaped = false
  for (let index = jsonStart; index < raw.length; index += 1) {
    const char = raw[index]
    if (quoted) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') quoted = false
      continue
    }
    if (char === '"') {
      quoted = true
      continue
    }
    if (char === '{') depth += 1
    else if (char === '}') {
      depth -= 1
      if (depth === 0 && raw.slice(index + 1, index + 3) === ']]') {
        return { jsonEnd: index + 1, tokenEnd: index + 3 }
      }
    }
  }
  return null
}

/**
 * Remove every `[[product:{…}]]` marker whose JSON `id` field matches any
 * ID in `productIdsToRemove`. All other content (text + markers for other
 * products) is preserved exactly.
 *
 * Returns the cleaned content. If no markers matched, returns the original
 * string unchanged (pointer-equal, so callers can cheaply skip DB writes).
 */
export function stripProductMarkers(
  content: string,
  productIdsToRemove: Set<string>,
): string {
  if (productIdsToRemove.size === 0 || !content.includes(PRODUCT_PREFIX)) {
    return content
  }

  let result = ''
  let cursor = 0
  let changed = false

  while (cursor < content.length) {
    const start = content.indexOf(PRODUCT_PREFIX, cursor)
    if (start < 0) {
      result += content.slice(cursor)
      break
    }
    // Keep everything before the marker
    result += content.slice(cursor, start)

    const jsonStart = start + PRODUCT_PREFIX.length
    const bounds = findTokenBounds(content, jsonStart)
    if (!bounds) {
      // Malformed/incomplete marker — keep the rest as-is
      result += content.slice(start)
      break
    }

    const jsonStr = content.slice(jsonStart, bounds.jsonEnd)
    let shouldRemove = false
    try {
      const parsed = JSON.parse(jsonStr) as Record<string, unknown>
      const id = typeof parsed.id === 'string' ? parsed.id : ''
      if (id && productIdsToRemove.has(id)) {
        shouldRemove = true
      }
    } catch {
      // Can't parse — keep the marker as-is
    }

    if (shouldRemove) {
      changed = true
      // Don't add the marker to result — effectively removing it
      // Also clean up any trailing newline that would leave a blank line
    } else {
      result += content.slice(start, bounds.tokenEnd)
    }
    cursor = bounds.tokenEnd
  }

  if (!changed) return content

  // Clean up: remove empty lines left by removed markers (a marker was
  // typically on its own line, so removing it leaves a blank line)
  return result
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Batch-clean all messages in a workspace that contain product markers
 * referencing any of the given product IDs. Returns the number of messages
 * updated.
 *
 * This is the function to call from a product DELETE endpoint.
 */
export async function cleanupProductMarkersFromMessages(
  workspaceId: string,
  productIds: string[],
): Promise<number> {
  if (productIds.length === 0) return 0

  const { prisma } = await import('@/lib/prisma')
  const idSet = new Set(productIds)

  // Find candidate messages — only those containing the product marker prefix.
  // This avoids scanning every message in the workspace.
  const candidates = await prisma.message.findMany({
    where: {
      content: { contains: PRODUCT_PREFIX },
      conversation: { workspaceId },
    },
    select: { id: true, content: true },
  })

  let updated = 0
  for (const msg of candidates) {
    const cleaned = stripProductMarkers(msg.content, idSet)
    if (cleaned !== msg.content) {
      await prisma.message.update({
        where: { id: msg.id },
        data: { content: cleaned },
      })
      updated += 1
    }
  }

  return updated
}
