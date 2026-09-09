const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()
const WS = 'cmqxoy39y0000eoapw2pt9yat'

async function main() {
  const r1 = await p.storeOrder.deleteMany({ where: { workspaceId: WS, externalOrderId: { startsWith: 'SKEL-' } } })
  const r2 = await p.product.deleteMany({ where: { workspaceId: WS, sku: 'skeleton-e2e-test' } })
  const r3 = await p.productCategory.deleteMany({ where: { workspaceId: WS, slug: { startsWith: 'skel-' } } })
  const r4 = await p.storeIntegration.deleteMany({ where: { workspaceId: WS, storeUrl: 'https://skeleton-test.example.com' } })
  console.log(JSON.stringify({ orders: r1.count, products: r2.count, categories: r3.count, integrations: r4.count }))
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => p.$disconnect())
