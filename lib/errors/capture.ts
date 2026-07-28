import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'
export type ErrorLevel = LogLevel

export type LogOptions = {
  level?: LogLevel
  workspaceId?: string
  metadata?: Record<string, unknown>
  /** Persist debug records too. Debug is console-only by default. */
  persist?: boolean
  /** Deliberate, narrowly-scoped exception for the `otpCode` metadata field. */
  exposeOtpCode?: boolean
}

const SENSITIVE_KEY = /(authorization|cookie|password|passwd|secret|token|api.?key|private.?key|session|credential)/i
const ONE_TIME_CODE_KEY = /^(otp|otpCode|code|verificationCode)$/i
const MAX_DEPTH = 6
const MAX_ARRAY_ITEMS = 50
const MAX_STRING_LENGTH = 8_000

function truncate(value: string, max = MAX_STRING_LENGTH): string {
  return value.length > max ? `${value.slice(0, max)}…[truncated]` : value
}

function sanitizeValue(
  value: unknown,
  key: string,
  exposeOtpCode: boolean,
  seen: WeakSet<object>,
  depth = 0,
): unknown {
  const sensitive = SENSITIVE_KEY.test(key) || ONE_TIME_CODE_KEY.test(key)
  if (sensitive && !(exposeOtpCode && key === 'otpCode')) return '[REDACTED]'
  if (value === undefined) return null
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'string') return truncate(value)
  if (typeof value === 'function') return `[Function ${value.name || 'anonymous'}]`
  if (depth >= MAX_DEPTH) return '[MAX_DEPTH]'
  if (value instanceof Date) return value.toISOString()
  if (value instanceof Error) {
    return {
      name: value.name,
      message: truncate(value.message),
      stack: value.stack ? truncate(value.stack) : null,
      cause: value.cause
        ? sanitizeValue(value.cause, 'cause', exposeOtpCode, seen, depth + 1)
        : null,
    }
  }
  if (typeof value !== 'object') return truncate(String(value))
  if (seen.has(value)) return '[CIRCULAR]'
  seen.add(value)

  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => sanitizeValue(item, '', exposeOtpCode, seen, depth + 1))
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => [
      childKey,
      sanitizeValue(childValue, childKey, exposeOtpCode, seen, depth + 1),
    ]),
  )
}

function sanitizeMetadata(
  metadata: Record<string, unknown> | undefined,
  exposeOtpCode = false,
): Record<string, unknown> | undefined {
  if (!metadata) return undefined
  return sanitizeValue(metadata, '', exposeOtpCode, new WeakSet()) as Record<string, unknown>
}

function errorDetails(error: unknown): { message: string; stack: string | null; name?: string } {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: truncate(error.message || error.name, 4_000),
      stack: error.stack ? truncate(error.stack, 8_000) : null,
    }
  }
  return { message: truncate(String(error ?? 'unknown error'), 4_000), stack: null }
}

function emitConsole(
  level: LogLevel,
  source: string,
  message: string,
  metadata?: Record<string, unknown>,
): void {
  const payload = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    source,
    message,
    ...(metadata && Object.keys(metadata).length ? { metadata } : {}),
  })
  const method = level === 'debug' ? console.debug : level === 'info' ? console.info : level === 'warn' ? console.warn : console.error
  method(payload)
}

/**
 * Write one structured, searchable application event to the process log and
 * (except debug by default) the admin-visible ErrorLog table. Logger failures
 * are swallowed so observability can never break the operation being observed.
 */
export async function persistLog(
  level: LogLevel,
  source: string,
  value: unknown,
  opts?: Omit<LogOptions, 'level'>,
): Promise<void> {
  const details = errorDetails(value)
  const metadata = sanitizeMetadata(
    {
      ...(opts?.metadata ?? {}),
      ...(details.name ? { errorName: details.name } : {}),
      ...(value instanceof Error && value.cause ? { cause: value.cause } : {}),
    },
    opts?.exposeOtpCode,
  )

  emitConsole(level, source, details.message, metadata)
  if (opts?.persist === false || (level === 'debug' && opts?.persist !== true)) return

  try {
    await prisma.errorLog.create({
      data: {
        level,
        source: truncate(source, 255),
        message: details.message,
        stack: details.stack,
        workspaceId: opts?.workspaceId ?? null,
        metadata: metadata as Prisma.InputJsonValue | undefined,
      },
    })
  } catch (loggerError) {
    const fallback = errorDetails(loggerError)
    emitConsole('error', 'logger:persistence', fallback.message, {
      originalLevel: level,
      originalSource: source,
    })
  }
}

export function captureLog(
  level: LogLevel,
  source: string,
  value: unknown,
  opts?: Omit<LogOptions, 'level'>,
): void {
  void persistLog(level, source, value, opts)
}

export function captureError(
  source: string,
  error: unknown,
  opts?: LogOptions,
): void {
  const { level = 'error', ...rest } = opts ?? {}
  captureLog(level, source, error, rest)
}

export function captureWarning(
  source: string,
  warning: unknown,
  opts?: Omit<LogOptions, 'level'>,
): void {
  captureLog('warn', source, warning, opts)
}

export function captureInfo(
  source: string,
  message: string,
  opts?: Omit<LogOptions, 'level'>,
): void {
  captureLog('info', source, message, opts)
}

export function captureDebug(
  source: string,
  message: string,
  opts?: Omit<LogOptions, 'level'>,
): void {
  captureLog('debug', source, message, opts)
}
