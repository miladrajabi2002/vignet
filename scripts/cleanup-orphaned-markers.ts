
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const PRODUCT_PREFIX = '[[product:'

function findTokenBounds(raw: string, jsonStart: number): { jsonEnd: number; tokenEnd: number } | null {
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
    if (char === '"') { quoted = true; continue }
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

async function main() {
  // 1. Find all messages with product markers
  const messages = await prisma.message.findMany({
    where: { content: { contains: PRODUCT_PREFIX } },
    select: { id: true, content: true, conversationId: true },
  })
  console.log(`Found ${messages.length} messages with product markers`)

  // 2. Extract all unique product IDs from markers
  const productIds = new Set<string>()
  for (const msg of messages) {
    let cursor = 0
    while (cursor < msg.content.length) {
      const start = msg.content.indexOf(PRODUCT_PREFIX, cursor)
      if (start < 0) break
      const jsonStart = start + PRODUCT_PREFIX.length
      const bounds = findTokenBounds(msg.content, jsonStart)
      if (!bounds) break
      try {
        const parsed = JSON.parse(msg.content.slice(jsonStart, bounds.jsonEnd))
        if (parsed.id) productIds.add(parsed.id)
      } catch {}
      cursor = bounds.tokenEnd
    }
  }
  console.log(`Found ${productIds.size} unique product IDs in markers`)

  // 3. Check which product IDs still exist
  const existingProducts = await prisma.product.findMany({
    where: { id: { in: [...productIds] } },
    select: { id: true },
  })
  const existingIds = new Set(existingProducts.map(p => p.id))
  const orphanedIds = [...productIds].filter(id => !existingIds.has(id))
  console.log(`Existing: ${existingIds.size}, Orphaned: ${orphanedIds.length}`)
  if (orphanedIds.length > 0) {
    console.log('Orphaned product IDs:', orphanedIds)
  }

  // 4. Clean up orphaned markers
  const orphanedSet = new Set(orphanedIds)
  let updated = 0
  for (const msg of messages) {
    let result = ''
    let cursor = 0
    let changed = false
    while (cursor < msg.content.length) {
      const start = msg.content.indexOf(PRODUCT_PREFIX, cursor)
      if (start < 0) { result += msg.content.slice(cursor); break }
      result += msg.content.slice(cursor, start)
      const jsonStart = start + PRODUCT_PREFIX.length
      const bounds = findTokenBounds(msg.content, jsonStart)
      if (!bounds) { result += msg.content.slice(start); break }
      
      let shouldRemove = false
      try {
        const parsed = JSON.parse(msg.content.slice(jsonStart, bounds.jsonEnd))
        if (parsed.id && orphanedSet.has(parsed.id)) shouldRemove = true
      } catch {}
      
      if (shouldRemove) {
        changed = true
      } else {
        result += msg.content.slice(start, bounds.tokenEnd)
      }
      cursor = bounds.tokenEnd
    }
    
    if (changed) {
      const cleaned = result.replace(/\n{3,}/g, '\n\n').trim()
      await prisma.message.update({
        where: { id: msg.id },
        data: { content: cleaned },
      })
      updated++
      console.log(`  Cleaned message ${msg.id}`)
    }
  }
  console.log(`\n✓ Updated ${updated} messages`)
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
