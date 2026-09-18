import { prisma } from '@/lib/prisma'
import { getRedis } from '@/lib/redis'
import { tokenizeCatalogText, PRODUCT_STOP_WORDS } from '@/lib/ai/conversation'

/**
 * Corpus-derived catalog lexicon (per agent, workspace-scoped).
 *
 * WHY THIS EXISTS
 * The legacy intent router is vocabulary-driven: PRODUCT_NOUNS is a global,
 * hand-curated list of ~150 retail nouns. Any vertical outside that list
 * (kitchenware, men's fashion, electronics, furniture families like «پاف»)
 * silently fails intent detection — the catalog is never consulted and the
 * customer gets a knowledge-only or "not found" answer. Every fix meant
 * editing code, and global nouns collide across verticals («میز» vs «میزان»).
 *
 * THE FIX (data-driven vocabulary)
 * The agent's OWN catalog already names everything the store sells: product
 * names, category names, tags and SKUs. Tokenizing those identity fields
 * yields the exact vocabulary this tenant's customers use. A message token
 * that appears in that lexicon is product-intent evidence — no code change
 * is ever needed for a new vertical, and two tenants' vocabularies never
 * interfere because the lexicon is scoped to the agent's assigned catalog.
 *
 * Only identity fields (name/category/tags/SKU) feed the lexicon: a word that
 * appears solely inside a long description is weak evidence and must not
 * flip a general support question into a shopping turn.
 */

/** Tokens derived from identity fields of the agent's assigned active catalog. */
export interface AgentCatalogLexicon {
  /** Normalized tokens (and their plural-stripped bases) from names/categories/tags/SKUs. */
  identityTokens: Set<string>
  /** When the lexicon snapshot was built (ms epoch). */
  builtAt: number
  /** Number of products the snapshot covered (diagnostics). */
  productCount: number
}

const REDIS_KEY = (agentId: string) => `lex:agent:${agentId}`
/** Redis TTL — product syncs invalidate eagerly, this is the safety net. */
const REDIS_TTL_SEC = 300
/** In-process TTL so a hot agent does not hammer Postgres/Redis per turn. */
const MEMORY_TTL_MS = 60_000
/** Product cap for one lexicon build (protects very large catalogs). */
const MAX_PRODUCTS = 2_000

const memoryCache = new Map<string, AgentCatalogLexicon>()
const memoryCacheAt = new Map<string, number>()

function isCacheableValue(value: string): boolean {
  return value.length >= 2 && !PRODUCT_STOP_WORDS.has(value)
}

/**
 * Build the lexicon from the identity fields of the agent's active catalog.
 * Tokenization mirrors extractProductTerms (same normalization and plural
 * stripping) so customer-side search terms line up with catalog-side tokens.
 */
async function buildLexicon(agentId: string): Promise<AgentCatalogLexicon> {
  const rows = await prisma.product.findMany({
    where: { active: true, catalogItems: { some: { agentId } } },
    select: {
      name: true,
      sku: true,
      tags: true,
      category: { select: { name: true } },
    },
    take: MAX_PRODUCTS,
    orderBy: { updatedAt: 'desc' },
  })

  const identityTokens = new Set<string>()
  for (const row of rows) {
    for (const field of [row.name, row.sku ?? '', row.category?.name ?? '', row.tags.join(' ')]) {
      for (const token of tokenizeCatalogText(field)) {
        if (isCacheableValue(token)) identityTokens.add(token)
      }
    }
  }
  return { identityTokens, builtAt: Date.now(), productCount: rows.length }
}

/**
 * Resolve the agent's catalog lexicon: in-process → Redis → rebuild.
 * Fails open with an empty lexicon (behaviour falls back to the global
 * vocabulary routing) so a Redis/DB hiccup can never break a chat turn.
 */
export async function getAgentCatalogLexicon(agentId: string): Promise<AgentCatalogLexicon> {
  const now = Date.now()
  const cachedAt = memoryCacheAt.get(agentId)
  if (cachedAt != null && now - cachedAt < MEMORY_TTL_MS) {
    const cached = memoryCache.get(agentId)
    if (cached) return cached
  }

  try {
    const raw = await getRedis().get(REDIS_KEY(agentId))
    if (raw) {
      const parsed = JSON.parse(raw) as { identityTokens: string[]; builtAt: number; productCount: number }
      const lexicon: AgentCatalogLexicon = {
        identityTokens: new Set(parsed.identityTokens),
        builtAt: parsed.builtAt,
        productCount: parsed.productCount,
      }
      memoryCache.set(agentId, lexicon)
      memoryCacheAt.set(agentId, now)
      return lexicon
    }
  } catch {
    // Redis unavailable — fall through to a rebuild.
  }

  const lexicon = await buildLexicon(agentId)
  memoryCache.set(agentId, lexicon)
  memoryCacheAt.set(agentId, now)
  try {
    void getRedis().set(
      REDIS_KEY(agentId),
      JSON.stringify({ identityTokens: [...lexicon.identityTokens], builtAt: lexicon.builtAt, productCount: lexicon.productCount }),
      'EX',
      REDIS_TTL_SEC,
    )
  } catch {
    // Best-effort cache fill.
  }
  return lexicon
}

/**
 * Invalidate the lexicon after catalog changes (product embed / sync).
 * The next chat turn rebuilds from the fresh catalog state.
 */
export function invalidateAgentCatalogLexicon(agentId: string): void {
  memoryCache.delete(agentId)
  memoryCacheAt.delete(agentId)
  try {
    void getRedis().del(REDIS_KEY(agentId))
  } catch {
    // Best-effort — TTL covers us anyway.
  }
}
