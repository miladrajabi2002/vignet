import { NextResponse } from 'next/server'
import { LONG_CHAT_THRESHOLD } from '@/lib/ai/handoff'

export const dynamic = 'force-static'

/**
 * Tiny public config endpoint. Exposes only the values the client UI needs
 * that come from server-side env vars. No secrets.
 */
export async function GET() {
	return NextResponse.json({
		longChatThreshold: LONG_CHAT_THRESHOLD,
	})
}
