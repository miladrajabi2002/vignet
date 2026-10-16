import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { latestWooPluginVersion, wooPluginUpdateHint } from '@/lib/integrations/woo-plugin-release'

const header = readFileSync(join(process.cwd(), 'wordpress-plugin', 'vigent-woo', 'vigent-woo.php'), 'utf8')
  .match(/^\s*\*\s*Version:\s*([0-9.]+)\s*$/m)?.[1]

describe('webhook answers announce a newer plugin release', () => {
  it('reads the release from the plugin header', () => {
    expect(latestWooPluginVersion()).toBe(header)
  })

  it('names the release only to stores on an older one', () => {
    expect(wooPluginUpdateHint('5.0.1')).toEqual({ plugin_latest: header })
    expect(wooPluginUpdateHint(header)).toBeNull()
    expect(wooPluginUpdateHint('99.0.0')).toBeNull()
    expect(wooPluginUpdateHint(null)).toBeNull()
  })

  it('is read by the plugin from every successful webhook answer', () => {
    const core = readFileSync(join(process.cwd(), 'wordpress-plugin', 'vigent-woo', 'includes', 'class-vigent-woo-core.php'), 'utf8')
    expect(core).toContain('$this->handle_update_hint( $resp_body );')
    expect(core).toContain("note_latest_release(")
  })
})
