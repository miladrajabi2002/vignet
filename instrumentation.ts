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
  const { captureError } = await import('@/lib/errors/capture')
  captureError('web:request-error', error, {
    metadata: {
      path: request.path,
      method: request.method,
      routerKind: context.routerKind,
      routePath: context.routePath,
      routeType: context.routeType,
      renderSource: context.renderSource,
    },
  })
}
