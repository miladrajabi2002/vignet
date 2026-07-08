import { NextResponse } from 'next/server'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

/**
 * Diagnostic endpoint — GET /api/uploads/instagram/diag
 *
 * Returns the upload route version + ffmpeg availability so the operator can
 * verify that the latest code is running (after a rebuild). When voice notes
 * still save as .m4a, hitting this endpoint tells you whether the new code
 * is live and whether ffmpeg is installed.
 */
export const dynamic = 'force-dynamic'

export async function GET() {
        const info: Record<string, unknown> = {
                routeVersion: 'v3-mp3',
                message: 'If you see this, the NEW upload route code is running.',
                voiceFormat: 'mp3 (libmp3lame)',
        }

        // Check ffmpeg
        try {
                const { stdout } = await execFileAsync('ffmpeg', ['-version'], { timeout: 5000 })
                info.ffmpeg = 'installed'
                info.ffmpegVersion = stdout.split('\n')[0]
        } catch {
                info.ffmpeg = 'NOT INSTALLED — run: apt install ffmpeg'
        }

        // Check ffprobe
        try {
                await execFileAsync('ffprobe', ['-version'], { timeout: 5000 })
                info.ffprobe = 'installed'
        } catch {
                info.ffprobe = 'NOT INSTALLED'
        }

        return NextResponse.json(info, { headers: { 'Cache-Control': 'no-store' } })
}
