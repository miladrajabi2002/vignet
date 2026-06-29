import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export type ErrorLevel = 'error' | 'warn'

/**
 * Record an application error so it shows up in the /admin monitoring
 * dashboard. Fire-and-forget: it always console.errors (so PM2 still sees it)
 * and never throws or blocks the caller — a failing logger must not break the
 * request it is reporting on.
 */
export function captureError(
  source: string,
  error: unknown,
  opts?: { level?: ErrorLevel; workspaceId?: string; metadata?: Record<string, unknown> },
): void {
  const message =
    error instanceof Error ? error.message : String(error ?? 'unknown error')
  const stack = error instanceof Error ? error.stack ?? null : null

  // Always surface to the process log too.
  console.error(`[${source}]`, error)

  prisma.errorLog
    .create({
      data: {
        level: opts?.level ?? 'error',
        source,
        message: message.slice(0, 4000),
        stack: stack?.slice(0, 8000) ?? null,
        workspaceId: opts?.workspaceId ?? null,
        metadata: (opts?.metadata as Prisma.InputJsonValue) ?? undefined,
      },
    })
    .catch((e) => {
      // Never recurse into captureError here — just note it on the console.
      console.error('[captureError] failed to persist error log:', e)
    })
}
