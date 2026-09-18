// Micro-benchmark: lexicon build cost (DB time, token count, Redis size) for agent آناهیتا
import { PrismaClient } from '@prisma/client'
import { getRedis } from '@/lib/redis'
import { getAgentCatalogLexicon } from '@/lib/ai/catalog-lexicon'

const prisma = new PrismaClient()
const AGENT_ID = 'cmtpul0dx000zeok453jjkavr'

async function main() {
  // 1. cold-ish: force memory cache miss by using a fresh import path is not possible here,
  //    so measure the public accessor twice — first call populates cache if expired
  const t0 = Date.now()
  const lex = await getAgentCatalogLexicon(AGENT_ID)
  const coldMs = Date.now() - t0
  console.log(`FIRST call (cache-miss if expired): ${coldMs}ms | products=${lex.productCount} | identityTokens=${lex.identityTokens.size}`)

  // 2. warm (memory cache) — what a hot conversation pays per turn
  const t1 = Date.now()
  await getAgentCatalogLexicon(AGENT_ID)
  console.log(`WARM (memory cache): ${Date.now() - t1}ms`)

  // 3. Redis footprint of the cached lexicon
  const redis = getRedis()
  if (redis) {
    const key = `lex:agent:${AGENT_ID}`
    const exists = await redis.exists(key)
    if (exists) {
      const val = await redis.get(key)
      const ttl = await redis.ttl(key)
      console.log(`Redis: value length=${val ? Buffer.byteLength(val) : 0} bytes (~serialized lexicon) | TTL=${ttl}s`)
      await redis.del(key).catch(() => {})
    } else {
      console.log('Redis: key expired already (TTL 300s) — rebuilt on demand')
    }
  }
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('BENCH FAILED:', e)
  process.exit(1)
})
