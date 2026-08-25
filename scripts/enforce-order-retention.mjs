#!/usr/bin/env node
/**
 * One-shot script to enforce order retention on all integrations.
 * Run with: node scripts/enforce-order-retention.mjs
 *
 * Deletes the oldest orders (by orderDate, then createdAt) for each
 * integration that has more than MAX_ORDERS_PER_INTEGRATION orders.
 * This is the same logic that runs incrementally after every order
 * upsert in lib/integrations/woocommerce.ts — this script just catches
 * up existing data in one pass.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const MAX_ORDERS_PER_INTEGRATION = 2000

async function main() {
  console.log(`Enforcing order retention: max ${MAX_ORDERS_PER_INTEGRATION} per integration`)
  
  const integrations = await prisma.storeIntegration.findMany({
    where: { type: 'WOOCOMMERCE' },
    select: { id: true, storeUrl: true },
  })
  
  let totalDeleted = 0
  
  for (const integration of integrations) {
    const count = await prisma.storeOrder.count({ where: { integrationId: integration.id } })
    if (count <= MAX_ORDERS_PER_INTEGRATION) {
      console.log(`  ${integration.storeUrl}: ${count} orders — OK (under cap)`)
      continue
    }
    
    const excess = count - MAX_ORDERS_PER_INTEGRATION
    console.log(`  ${integration.storeUrl}: ${count} orders — deleting ${excess} oldest...`)
    
    const oldOrderIds = await prisma.storeOrder.findMany({
      where: { integrationId: integration.id },
      orderBy: [{ orderDate: 'asc' }, { createdAt: 'asc' }],
      take: excess,
      select: { id: true },
    })
    
    if (oldOrderIds.length === 0) continue
    
    const result = await prisma.storeOrder.deleteMany({
      where: { id: { in: oldOrderIds.map((o) => o.id) } },
    })
    
    console.log(`    deleted ${result.count} orders`)
    totalDeleted += result.count
  }
  
  console.log(`\nDone. Total deleted: ${totalDeleted}`)
  
  // Show final counts
  const finalCounts = await prisma.storeIntegration.findMany({
    where: { type: 'WOOCOMMERCE' },
    select: {
      storeUrl: true,
      _count: { select: { orders: true } },
    },
  })
  console.log('\nFinal order counts:')
  for (const i of finalCounts) {
    console.log(`  ${i.storeUrl}: ${i._count.orders}`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
