export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { installProcessErrorObservers } = await import('@/lib/observability/process-errors')
  installProcessErrorObservers('web')
}

export async function onRequestError(
  error: unknown,
  request: { path?: string; method?: string; headers?: Record<string, string | string[] | undefined> },
  context: { routerKind?: string; routePath?: string; routeType?: string; renderSource?: string },
) {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { captureError, captureWarning } = await import('@/lib/errors/capture')

  // Node 22 webstreams teardown race during App Router streaming SSR:
  // "controller[kState].transformAlgorithm is not a function". The stack is
  // 100% node:internal/webstreams — a transform that was already queued in the
  // microtask queue fires after the client disconnected and the stream's
  // algorithms were cleared. The request was already being torn down, so the
  // response is unaffected; the site renders fine. Downgrade this signature to
  // a warning so the error dashboard stays reserved for actionable failures
  // while occurrences remain trackable.
  const err = error as { name?: string; message?: string; stack?: string } | null
  const isStreamTeardownRace =
    err?.name === 'TypeError' &&
    typeof err.message === 'string' &&
    err.message.includes('transformAlgorithm is not a function') &&
    typeof err.stack === 'string' &&
    err.stack.includes('node:internal/webstreams')

  const metadata = {
    path: request.path,
    method: request.method,
    routerKind: context.routerKind,
    routePath: context.routePath,
    routeType: context.routeType,
    renderSource: context.renderSource,
  }

  if (isStreamTeardownRace) {
    captureWarning('web:request-error:stream-teardown', error, { metadata })
    return
  }

  captureError('web:request-error', error, { metadata })
}
