import { NextResponse } from 'next/server'
import { corsHeaders, corsOptions } from '@/lib/cors'
import { getCachedWidgetConfig } from '@/lib/widget/cache'

type Params = { params: { agentId: string } }

export function OPTIONS() {
	return corsOptions()
}

// Public widget config — only safe, non-sensitive fields + appearance settings.
// Reads through the cache (60s TTL, invalidated on dashboard save).
export async function GET(_req: Request, { params }: Params) {
	const cached = await getCachedWidgetConfig(params.agentId)
	if (!cached) {
		return NextResponse.json(
			{ error: 'NOT_FOUND' },
			{ status: 404, headers: corsHeaders },
		)
	}
	// Cache hit returns the same shape as a fresh fetch.
	const { agent, settings } = cached

	return NextResponse.json(
		{
			id: agent.id,
			name: settings.headerTitle ?? agent.name,
			welcomeMessage: agent.welcomeMessage,
			language: agent.language,
			avatar: agent.avatar,
			// Appearance — consumed by loader.js to theme the widget.
			theme: settings.theme,
			primaryColor: settings.primaryColor,
			position: settings.position,
			launcherLabel: settings.launcherLabel,
			font: settings.font,
			icon: settings.icon,
			subtitle: settings.subtitle,
			corners: settings.corners,
			cornerRadius: settings.cornerRadius,
			autoGreet: settings.autoGreet,
			autoGreetDelayMs: settings.autoGreetDelayMs,
			leadCapture: settings.leadCapture,
			leadCaptureMessage: settings.leadCaptureMessage,
		},
		{ headers: corsHeaders },
	)
}
