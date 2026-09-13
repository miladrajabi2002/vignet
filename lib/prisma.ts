import { Prisma, PrismaClient } from '@prisma/client'

/**
 * ── Soft-delete (undo) extension ────────────────────────────────────────────
 *
 * Contact / Conversation / Product / StoreOrder are soft-deleted: instead of
 * removing the row we stamp `deletedAt`. This powers the "بازگردانی" (undo)
 * snackbar shown after every bulk delete, and keeps a 7-day safety net before
 * the worker purges trashed rows for good (lib/maintenance/soft-delete-purge).
 *
 * The extension enforces the invariant globally so no query site can forget it:
 *
 *   1. READS (findUnique / findFirst / findMany / count / aggregate / groupBy)
 *      get `deletedAt: null` injected into their where — trashed rows are
 *      invisible everywhere (lists, dashboards, AI runtime, widget, admin),
 *      inside and outside transactions. A query that filters on `deletedAt`
 *      itself (restore endpoints, purge) is respected and never overwritten.
 *
 *   2. delete / deleteMany become UPDATE … SET "deletedAt" = now(). Callers
 *      keep receiving the same result shape, and database cascades (messages,
 *      catalog rows, …) simply don't fire — which is exactly what undo needs.
 *      The conversion runs on the ROOT client: it is intentionally correct for
 *      every root-level delete (the bulk routes). Code inside a
 *      `prisma.$transaction(async (tx) => …)` callback must NOT rely on the
 *      conversion for atomicity — transactional delete sites do the soft delete
 *      explicitly with `tx.<model>.updateMany({ data: { deletedAt } })`
 *      (see lib/channels/handler.ts persistInboundOnly, the contact delete
 *      route, and lib/crm/contact-identity.ts mergeDuplicates).
 *      Workspaces cascade at the DB level (FK onDelete: Cascade) and are not
 *      affected by this extension, so account deletion stays a hard delete.
 *
 *   3. upsert is resolved manually (find → update / create) because the
 *      partial unique indexes (migration 20260913090100) cannot serve as an
 *      `ON CONFLICT` arbiter for Prisma's generated SQL. A soft-deleted row
 *      holding the unique key is handled per model: StoreOrder/Product are
 *      brought back to life with the fresh payload (a re-sync means the data
 *      is live again), while Conversation starts a FRESH thread (messenger
 *      style — the trashed twin coexists until the purge).
 *
 * `prismaRaw` is the untouched client — used ONLY by the purge sweeper and
 * anything that must physically remove rows. Everything else must import
 * `prisma` so the soft-delete rules apply.
 */

const SOFT_DELETE_MODELS = new Set(['Contact', 'Conversation', 'Product', 'StoreOrder'])
const SOFT_READ_OPERATIONS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
])

type SoftModelKey = 'contact' | 'conversation' | 'product' | 'storeOrder'

function softModelKey(model: string): SoftModelKey | null {
  const key = model.charAt(0).toLowerCase() + model.slice(1)
  return (key === 'contact' || key === 'conversation' || key === 'product' || key === 'storeOrder')
    ? (key as SoftModelKey)
    : null
}

// Set right after the extended client is created below. The extension hooks
// only ever run once a query executes, long after module initialization, so
// the late assignment is safe. Going through the EXTENDED client (not the raw
// closure one) keeps the replacement reads/updates soft-delete-aware.
let extendedSelf: unknown = null

function selfDelegate(key: SoftModelKey): Record<string, (args: unknown) => Promise<unknown>> {
  if (!extendedSelf) throw new Error('soft-delete: client used before initialization')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (extendedSelf as any)[key]
}

/**
 * Upsert `where` uses the compound-unique wrapper form
 * (`{ integrationId_externalOrderId: { … } }`); findFirst wants the flat form.
 * In this schema every underscore-joined key in a WhereUniqueInput IS a
 * compound unique wrapper, and plain filters never carry underscores.
 */
function flattenCompoundUniqueWhere(where: Record<string, unknown>): Record<string, unknown> {
  const flat: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(where)) {
    if (key.includes('_') && value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(flat, value as Record<string, unknown>)
    } else {
      flat[key] = value
    }
  }
  return flat
}

const softDeleteExtension = Prisma.defineExtension((client) =>
  client.$extends({
    name: 'softDelete',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || !SOFT_DELETE_MODELS.has(model) || !args) return query(args)
          const key = softModelKey(model)
          if (!key) return query(args)

          // 1) Reads: hide trashed rows unless the caller filters explicitly.
          if (SOFT_READ_OPERATIONS.has(operation)) {
            const where = (args as { where?: Record<string, unknown> }).where
            if (!where || !('deletedAt' in where)) {
              ;(args as { where?: Record<string, unknown> }).where = {
                ...(where ?? {}),
                deletedAt: null,
              }
            }
            return query(args)
          }

          const delegate = selfDelegate(key)

          // 2) delete → soft delete via update (same return shape).
          if (operation === 'delete') {
            return delegate.update({ ...args, data: { deletedAt: new Date() } })
          }
          if (operation === 'deleteMany') {
            const where = (args as { where?: unknown }).where
            return delegate.updateMany({
              ...(where === undefined ? {} : { where }),
              data: { deletedAt: new Date() },
            })
          }

          // 3) upsert → find live row, handle a trashed twin, or create.
          if (operation === 'upsert') {
            const { where, create, update, ...rest } = args as {
              where: Record<string, unknown>
              create: Record<string, unknown>
              update: Record<string, unknown>
              select?: unknown
              include?: unknown
            }
            const flatWhere = flattenCompoundUniqueWhere(where)
            // The extension already injects `deletedAt: null` into this read,
            // so only a live row can be found here.
            const live = await delegate.findFirst({ where: flatWhere, select: { id: true } })
            if (live) {
              return delegate.update({ where: { id: (live as { id: string }).id }, data: update, ...rest })
            }
            const trashed = await delegate.findFirst({
              where: { ...flatWhere, deletedAt: { not: null } },
              select: { id: true },
            })
            if (trashed) {
              if (model === 'Conversation') {
                // A thread that became active again after its previous
                // conversation was trashed starts FRESH (messenger-style),
                // instead of dragging the deleted history back. The partial
                // unique index lets both rows coexist; the twin purges later.
                return delegate.create({ data: create, ...rest })
              }
              // Products / orders: the unique key is held by a trashed row —
              // bring it back to life with the fresh payload (a re-sync of a
              // deleted row means the data is live again).
              return delegate.update({
                where: { id: (trashed as { id: string }).id },
                data: { ...update, deletedAt: null },
                ...rest,
              })
            }
            return delegate.create({ data: create, ...rest })
          }

          return query(args)
        },
      },
    },
  }),
)

// Prevent multiple PrismaClient instances during dev hot-reload.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  prismaSoft: ReturnType<typeof applySoftDelete> | undefined
}

const basePrisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = basePrisma

function applySoftDelete() {
  return basePrisma.$extends(softDeleteExtension)
}

/**
 * The transaction-scoped client type produced by the extended (soft-delete)
 * `prisma`. Helpers that receive a `tx` from `prisma.$transaction(...)` must
 * use this instead of `Prisma.TransactionClient` — the extension changes the
 * delegate signatures, so the plain type no longer accepts the extended tx.
 */
export type Tx = Parameters<Parameters<ReturnType<typeof applySoftDelete>['$transaction']>[0]>[0]

/**
 * The default client every feature should use. Soft-delete rules apply:
 * trashed rows are invisible and `delete`/`deleteMany` trash instead of drop.
 */
export const prisma = globalForPrisma.prismaSoft ?? applySoftDelete()

extendedSelf = prisma

if (process.env.NODE_ENV !== 'production') globalForPrisma.prismaSoft = prisma

/**
 * Un-extended client for physical row removal — currently only the soft-delete
 * purge sweeper (worker) may use it. Never import this for feature code.
 */
export const prismaRaw = basePrisma

export default prisma
