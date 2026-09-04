import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function plugin(file: string) {
  return readFileSync(join(process.cwd(), 'wordpress-plugin', 'vigent-woo', file), 'utf8')
}

function source(file: string) {
  return readFileSync(join(process.cwd(), file), 'utf8')
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

  it('preserves the active plugin state while updating from its admin screen', () => {
    const ajax = plugin('includes/class-vigent-woo-ajax.php')
    const installMethod = ajax.slice(
      ajax.indexOf('public function ajax_install_update()'),
      ajax.indexOf('\n        }\n}', ajax.indexOf('public function ajax_install_update()')),
    )

    expect(installMethod).toContain('$upgrader->bulk_upgrade( array( $plugin_file ) )')
    expect(installMethod).not.toContain('$upgrader->upgrade(')
    expect(installMethod).not.toMatch(/^\s*activate_plugin\(/m)
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

describe('WooCommerce shipment tracking sync', () => {
  it('does not confuse the customer postal code with a tracking number', () => {
    const core = plugin('includes/class-vigent-woo-core.php')

    expect(core).toContain("'postcode', 'post_code', 'postal_code', 'postalcode', 'zip'")
    expect(core).not.toContain("'track', 'ship', 'post', 'tipax', 'chapar', 'rahgiri'")
    expect(core).not.toMatch(/^\s*'_post_code',\s*$/m)
    expect(core).not.toMatch(/^\s*'_post_id',\s*$/m)
  })

  it('supports current 24-digit Iran Post barcodes and direct meta saves', () => {
    const core = plugin('includes/class-vigent-woo-core.php')
    const sync = plugin('includes/class-vigent-woo-sync.php')

    expect(core).toContain("preg_match( '/^[0-9]{13,24}$/', $code )")
    expect(core).toContain('private function scan_all_meta_for_courier_name(')
    expect(core).toContain("'tracking_provider'")
    expect(sync).toContain("add_action( 'updated_post_meta'")
    expect(sync).toContain("add_action( 'woocommerce_order_note_added'")
    expect(sync).toContain("$this->queue_order( $object_id, 'order.updated' )")
  })

  it('repairs optional tracking fields across all existing orders in resumable pages', () => {
    const main = plugin('vigent-woo.php')
    const sync = plugin('includes/class-vigent-woo-sync.php')
    const core = plugin('includes/class-vigent-woo-core.php')
    const server = source('lib/integrations/woocommerce.ts')

    expect(main).toContain("get_option( 'vigent_woo_migrated_4_3_11'")
    expect(main).toContain("wp_schedule_single_event( time() + 10, 'vigent_woo_tracking_backfill' )")
    expect(sync).toContain('const TRACKING_BACKFILL_BATCH_SIZE = 200')
    expect(sync).toContain('public function backfill_all_order_tracking()')
    expect(sync).toContain("'paginate' => true")
    expect(sync).toContain("'orderby'  => 'ID'")
    expect(sync).toContain("$this->schedule_tracking_backfill( 20 )")
    expect(sync).toContain("$this->make_event( 'order.tracking.updated'")
    expect(core).toContain('public function order_tracking_to_payload(')
    expect(server).toContain("event.topic === 'order.tracking.updated'")
  })

  it('keeps shipment fields empty until a real tracking code exists', () => {
    const core = plugin('includes/class-vigent-woo-core.php')
    const server = source('lib/integrations/woocommerce.ts')

    expect(core).toContain("if ( '' === $info['tracking_code'] )")
    expect(server).toContain('if (!trackingCode)')
    expect(server).toContain('trackingCode: null')
    expect(server).toContain('courierName: null')
  })
})
