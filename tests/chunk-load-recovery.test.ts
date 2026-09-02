import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  isChunkLoadError,
  withChunkRetryParam,
} from '@/lib/observability/chunk-load-recovery'

describe('Next.js chunk load recovery', () => {
  it('recognizes browser and webpack chunk failure variants', () => {
    expect(isChunkLoadError(Object.assign(new Error('Loading chunk 586 failed.'), { name: 'ChunkLoadError' }))).toBe(true)
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module'))).toBe(true)
    // Webpack throws this when stale route code requests a module factory that
    // is absent from the currently loaded runtime after a deployment.
    expect(isChunkLoadError(new TypeError("Cannot read properties of undefined (reading 'call')"))).toBe(true)
    expect(isChunkLoadError(new Error('ordinary render failure'))).toBe(false)
  })

  it('adds a cache-busting retry without losing the current route or query', () => {
    expect(withChunkRetryParam('https://vigent.ir/admin/users/user-1?tab=usage', 1234)).toBe(
      'https://vigent.ir/admin/users/user-1?tab=usage&_vigent_chunk_retry=1234',
    )
  })

  it('keeps previous release assets during deploy and installs root recovery', () => {
    const deploy = readFileSync(path.join(process.cwd(), 'deploy/deploy.sh'), 'utf8')
    const layout = readFileSync(path.join(process.cwd(), 'app/layout.tsx'), 'utf8')

    expect(deploy).toContain('cp -a .next/static/. "${previous_static_dir}/"')
    expect(deploy).toContain('cp -an "${previous_static_dir}/." .next/static/')
    expect(deploy).toContain('find .next/static -type f -mmin +1440 -delete')
    expect(layout).toContain('<ChunkLoadRecovery />')
  })
})
