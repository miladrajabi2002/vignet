import { NextResponse } from 'next/server'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'

export const dynamic = 'force-dynamic'

/**
 * Plugin update info endpoint.
 *
 * Returns the WordPress plugin-update-info JSON consumed by the
 * `Vigent_Woo_Updater` class inside the WordPress plugin. The plugin
 * polls this endpoint (caching the response for 6 hours) and uses it to
 * decide whether an update is available, and to feed the WordPress
 * `pre_set_site_transient_update_plugins` + `plugins_api` filters so the
 * update shows up natively in the WordPress admin (Plugins page and the
 * Details modal).
 *
 * Schema (matches WordPress.org's plugins_api response shape):
 *   {
 *     "name":           "Vigent WooCommerce",
 *     "slug":           "vigent-woo",
 *     "version":        "4.1.0",
 *     "author":         "<a href='https://vigent.ir'>Vigent</a>",
 *     "author_profile": "https://vigent.ir",
 *     "homepage":       "https://vigent.ir/docs/woocommerce",
 *     "download_url":   "https://vigent.ir/api/downloads/wordpress-plugin",
 *     "tested":         "6.5",
 *     "requires":       "5.8",
 *     "requires_php":   "7.4",
 *     "last_updated":   "2026-07-25 10:00:00",
 *     "sections": {
 *       "description": "...",
 *       "changelog":   "..."
 *     }
 *   }
 *
 * The version is read straight out of the plugin's main PHP file
 * (`wordpress-plugin/vigent-woo/vigent-woo.php`) so that as soon as the
 * developer bumps `Version: x.y.z` in that header AND re-runs
 * `npm run plugin:zip`, this endpoint automatically serves the new
 * version number — no manual JSON editing required.
 *
 * The changelog is read from `CHANGES.md` at the repo root (best-effort:
 * if the file is missing or unreadable, an empty changelog is returned).
 */
export async function GET() {
    const phpPath = join(process.cwd(), 'wordpress-plugin', 'vigent-woo', 'vigent-woo.php')
    const readmePath = join(process.cwd(), 'wordpress-plugin', 'vigent-woo', 'readme.txt')
    const changesPath = join(process.cwd(), 'CHANGES.md')

    if (!existsSync(phpPath)) {
        return NextResponse.json(
            { error: 'Plugin source not found. Make sure wordpress-plugin/vigent-woo/vigent-woo.php exists.' },
            { status: 500 }
        )
    }

    // Parse the plugin header to extract Version, Requires, Requires PHP, Tested.
    const phpContent = readFileSync(phpPath, 'utf8')
    const headerField = (key: string): string => {
        // Matches ` * Version:           4.1.0` or `Version: 4.1.0`
        const m = phpContent.match(new RegExp(`^\\s*\\*?\\s*${key}:\\s+(.+)$`, 'mi'))
        return m ? m[1].trim() : ''
    }
    const version = headerField('Version') || '0.0.0'
    const requires = headerField('Requires at least') || '5.8'
    const requiresPhp = headerField('Requires PHP') || '7.4'
    const testedUpTo = headerField('Tested up to') || '6.5'

    // Prefer the plugin readme so WordPress shows the 4.2.0 release notes;
    // repository-wide changes are only a fallback.
    let changelog = ''
    try {
        if (existsSync(readmePath)) {
            const readme = readFileSync(readmePath, 'utf8')
            const marker = readme.indexOf('== Changelog ==')
            if (marker >= 0) {
                changelog = readme
                    .slice(marker + '== Changelog =='.length)
                    .trim()
                    .slice(0, 8000)
            }
        } else if (existsSync(changesPath)) {
            const md = readFileSync(changesPath, 'utf8')
            // Take the most recent ~3 sections (rough heuristic).
            const sections = md.split(/^##\s+/m).slice(0, 4)
            changelog = sections
                .map((s) => '## ' + s.trim())
                .join('\n\n')
                .slice(0, 8000) // hard cap so the response doesn't balloon
        }
    } catch {
        // ignore — empty changelog is fine.
    }

    // Use the PHP file's mtime as `last_updated` so a fresh deploy always
    // looks "newer" than the cached version the plugin stored.
    const stat = statSync(phpPath)
    const lastUpdated = stat.mtime.toISOString().slice(0, 19).replace('T', ' ')

    const info = {
        name: 'ویجنت — اتصال وردپرس و ووکامرس',
        slug: 'vigent-woo',
        version,
        author: '<a href="https://vigent.ir">Vigent</a>',
        author_profile: 'https://vigent.ir',
        homepage: 'https://vigent.ir/docs/woocommerce',
        download_url: 'https://vigent.ir/api/downloads/wordpress-plugin',
        tested: testedUpTo,
        requires,
        requires_php: requiresPhp,
        last_updated: lastUpdated,
        sections: {
            description:
                'سایت وردپرس شما را به ایجنت هوشمند ویجنت متصل می‌کند و محصولات و سفارش‌ها را همگام می‌سازد. با این نسخه، دکمه «بررسی بروزرسانی» در پنل افزونه قرار گرفته است تا به‌صورت خودکار یا دستی نسخه جدید را نصب کنید.',
            changelog: changelog || '—',
        },
        // Convenience flags consumed by the plugin's manual-check AJAX
        // handler (not part of the WordPress.org spec, but harmless).
        banners: {},
        icons: {},
    }

    return NextResponse.json(info, {
        status: 200,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            // Cache at the CDN/edge for a short window so we don't re-read
            // the PHP file on every request, but also don't serve stale
            // version info for too long after a deploy.
            'Cache-Control': 'public, max-age=300, s-maxage=600',
        },
    })
}
