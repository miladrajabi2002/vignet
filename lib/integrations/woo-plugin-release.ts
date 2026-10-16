/**
 * Newest WooCommerce plugin release, for the answer to a store's webhook.
 *
 * A store only asks /api/wordpress-plugin/info when its own update cache runs
 * out, so a release could stay invisible for hours. Every webhook answer from
 * an older store carries `plugin_latest`; from 5.2.2 the plugin then refreshes
 * its update info at once.
 */
import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { pluginVersionAtLeast } from '@/lib/commerce/checkout-link'

const PLUGIN_FILE = join(process.cwd(), 'wordpress-plugin', 'vigent-woo', 'vigent-woo.php')

let cached: { mtimeMs: number; version: string | null } | null = null

/** The header version of the plugin this server hands out, read again only when the file changes. */
export function latestWooPluginVersion(): string | null {
  try {
    const { mtimeMs } = statSync(PLUGIN_FILE)
    if (cached?.mtimeMs !== mtimeMs) {
      const version = readFileSync(PLUGIN_FILE, 'utf8').match(/^\s*\*?\s*Version:\s+([0-9][0-9.]*)\s*$/m)?.[1] ?? null
      cached = { mtimeMs, version }
    }
    return cached.version
  } catch {
    return null
  }
}

/** `plugin_latest` for a store on an older release; nothing when it is current or unknown. */
export function wooPluginUpdateHint(storeVersion: string | null | undefined): { plugin_latest: string } | null {
  const latest = latestWooPluginVersion()
  if (!storeVersion || !latest || pluginVersionAtLeast(storeVersion, latest)) return null
  return { plugin_latest: latest }
}
