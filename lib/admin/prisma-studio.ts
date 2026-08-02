const DEFAULT_PRODUCTION_PORT = '8443'
const DEFAULT_DEVELOPMENT_URL = 'http://127.0.0.1:5555/'

function parseHttpUrl(value: string | undefined): URL | null {
  if (!value?.trim()) return null

  try {
    const url = new URL(value.trim())
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null
  } catch {
    return null
  }
}

/**
 * Resolve the browser-facing Prisma Studio URL without exposing DATABASE_URL.
 * Production Studio must use HTTPS because it receives the secure admin cookie.
 */
export function resolvePrismaStudioUrl(env: NodeJS.ProcessEnv = process.env): URL | null {
  const configured = parseHttpUrl(env.PRISMA_STUDIO_URL)
  if (configured) {
    if (env.NODE_ENV === 'production' && configured.protocol !== 'https:') return null
    return configured
  }

  if (env.NODE_ENV !== 'production') return new URL(DEFAULT_DEVELOPMENT_URL)

  const appUrl = parseHttpUrl(env.NEXT_PUBLIC_APP_URL) ?? parseHttpUrl(env.NEXTAUTH_URL)
  if (!appUrl || appUrl.protocol !== 'https:') return null

  const studioUrl = new URL(appUrl)
  studioUrl.port = DEFAULT_PRODUCTION_PORT
  studioUrl.pathname = '/'
  studioUrl.search = ''
  studioUrl.hash = ''
  return studioUrl
}
