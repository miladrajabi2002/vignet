
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // 1. Find all automations with PRODUCT_LIST using raw SQL
  const automations = await prisma.$queryRaw<{ id: string; action: any; agentId: string }[]>`
    SELECT id, action, "agentId"
    FROM "InstagramAutomation"
    WHERE action::text LIKE '%PRODUCT_LIST%'
  `
  console.log(`Found ${automations.length} automations with PRODUCT_LIST`)

  // 2. Collect all product IDs referenced
  const allProductIds = new Set<string>()
  for (const auto of automations) {
    const action = auto.action as any
    if (!action?.messages) continue
    for (const msg of action.messages) {
      if (msg.type === 'PRODUCT_LIST' && Array.isArray(msg.productIds)) {
        for (const id of msg.productIds) {
          if (typeof id === 'string') allProductIds.add(id)
        }
      }
    }
  }
  console.log(`Total unique product IDs in automations: ${allProductIds.size}`)

  // 3. Check which exist
  const existing = await prisma.product.findMany({
    where: { id: { in: [...allProductIds] } },
    select: { id: true, name: true },
  })
  const existingIds = new Set(existing.map(p => p.id))
  const orphaned = [...allProductIds].filter(id => !existingIds.has(id))
  console.log(`Existing: ${existingIds.size}, Orphaned: ${orphaned.length}`)
  if (orphaned.length > 0) {
    console.log('Orphaned IDs:', orphaned)
  }

  // 4. Clean up
  const orphanedSet = new Set(orphaned)
  let updated = 0
  for (const auto of automations) {
    const action = auto.action as any
    if (!action?.messages) continue
    let changed = false
    const newMessages = action.messages.map((msg: any) => {
      if (msg.type !== 'PRODUCT_LIST' || !Array.isArray(msg.productIds)) return msg
      const filtered = msg.productIds.filter((id: string) => !orphanedSet.has(id))
      if (filtered.length !== msg.productIds.length) {
        changed = true
        return { ...msg, productIds: filtered }
      }
      return msg
    })
    if (changed) {
      await prisma.instagramAutomation.update({
        where: { id: auto.id },
        data: { action: { ...action, messages: newMessages } as any },
      })
      updated++
      console.log(`  Cleaned automation ${auto.id} (${auto.action?.name ?? 'unnamed'})`)
    }
  }
  console.log(`\n✓ Updated ${updated} automations`)
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
