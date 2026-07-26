import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function plugin(file: string) {
  return readFileSync(join(process.cwd(), 'wordpress-plugin', 'vigent-woo', file), 'utf8')
}

describe('WooCommerce plugin version stays consistent', () => {
  // A mismatch here breaks the WordPress update flow: /api/wordpress-plugin/info
  // reads the header version, so an un-bumped constant or readme ships an update
  // that WordPress immediately offers again.
  it('declares the same version in the header, the constant and the readme', () => {
    const main = plugin('vigent-woo.php')
    const readme = plugin('readme.txt')

    const header = main.match(/^\s*\*\s*Version:\s*([0-9.]+)\s*$/m)?.[1]
    const constant = main.match(/VIGENT_WOO_VERSION',\s*'([0-9.]+)'/)?.[1]
    const stable = readme.match(/^Stable tag:\s*([0-9.]+)\s*$/m)?.[1]

    expect(header).toBeTruthy()
    expect(constant).toBe(header)
    expect(stable).toBe(header)
    expect(readme).toContain(`= ${header} =`)
  })

  it('reports its version on every delivery, not only on a connection test', () => {
    // lib/integrations/woocommerce.ts persists job.pluginVersion, which the route
    // reads from this header; without it an auto-updated site kept reporting old.
    expect(plugin('includes/class-vigent-woo-core.php')).toContain('X-Vigent-Plugin-Version')
  })
})

describe('WooCommerce plugin delta queue cannot stall forever', () => {
  it('splits oversized batches instead of retrying a rejected body', () => {
    const sync = plugin('includes/class-vigent-woo-sync.php')

    expect(sync).toContain('const MAX_BATCH_BYTES')
    expect(sync).toContain('private function chunk_events_by_budget(')
    // Both the five-minute flush and the manual full push must respect it.
    expect(sync.match(/chunk_events_by_budget\(/g)?.length).toBeGreaterThanOrEqual(3)
    // The server rejects a body over 4MB, so the plugin budget must stay below it.
    const budget = Number(sync.match(/const MAX_BATCH_BYTES\s*=\s*(\d+)/)?.[1])
    expect(budget).toBeGreaterThan(0)
    expect(budget).toBeLessThan(4 * 1024 * 1024)
  })

  it('dead-letters an entry the server keeps rejecting', () => {
    const sync = plugin('includes/class-vigent-woo-sync.php')

    expect(sync).toContain('const MAX_DELTA_ATTEMPTS')
    expect(sync).toContain('if ( $attempts >= self::MAX_DELTA_ATTEMPTS )')
    // A silent drop would look like a healthy sync, so the count is reported.
    expect(sync).toContain("'dropped_total'")
    expect(plugin('includes/class-vigent-woo-admin.php')).toContain('vg-warn')
  })

  it('sends display-sized product images so chat cards stay light', () => {
    const core = plugin('includes/class-vigent-woo-core.php')

    expect(core).toContain('private function product_image_src(')
    expect(core).toContain("'woocommerce_single', 'large', 'full'")
    // No caller may go back to the raw upload for card images.
    expect(core).not.toContain("wp_get_attachment_image_url( $id, 'full' )")
  })
})
