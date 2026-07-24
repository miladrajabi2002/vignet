import { NextResponse } from 'next/server'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'

export const dynamic = 'force-dynamic'

/**
 * Plugin download endpoint with cache-busting headers.
 *
 * Serves the WordPress plugin zip from /public/downloads/vigent-wordpress.zip
 * but with no-cache headers so the browser always fetches the latest version.
 *
 * The query string ?v=<timestamp> can also be used for additional cache busting
 * at the URL level (already done in the UI links).
 *
 * If the file doesn't exist, returns a 404 with a helpful message.
 */
export async function GET() {
    const zipPath = join(process.cwd(), 'public', 'downloads', 'vigent-wordpress.zip')

    if (!existsSync(zipPath)) {
        return new NextResponse('Plugin zip not found. Run `npm run plugin:zip` to rebuild it.', {
            status: 404,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        })
    }

    const data = readFileSync(zipPath)
    const stat = statSync(zipPath)
    const filename = `vigent-wordpress-v3-${Math.floor(stat.mtimeMs)}.zip`

    return new NextResponse(data, {
        status: 200,
        headers: {
            'Content-Type': 'application/zip',
            'Content-Length': String(data.length),
            'Content-Disposition': `attachment; filename="${filename}"`,
            // Strong cache-busting headers — browser MUST revalidate every time.
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
            'Pragma': 'no-cache',
            'Expires': '0',
            'Last-Modified': stat.mtime.toUTCString(),
            // ETag based on file size + mtime for conditional requests.
            'ETag': `"${stat.size}-${stat.mtimeMs}"`,
        },
    })
}
