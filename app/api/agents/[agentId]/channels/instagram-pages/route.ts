import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { listFacebookPagesWithInstagram } from '@/lib/channels/instagram'

type Params = { params: Promise<{ agentId: string }> }

const bodySchema = z.object({
	/**
	 * A Facebook User Access Token (EAA…) from the Graph API Explorer, OR an
	 * existing Page Access Token. The wizard uses it to list the Pages the user
	 * administers and, for each, the linked Instagram account.
	 */
	userToken: z.string().min(10).max(2000),
})

/**
 * POST /api/agents/[agentId]/channels/instagram-pages
 *
 * Step 1 of the Instagram connection wizard. The operator pastes a User Access
 * Token (EAA… from Graph API Explorer). We exchange it for the list of Facebook
 * Pages they administer, enrich each with the linked Instagram Business/Creator
 * account (if any), and return the lot so the operator can pick the right Page.
 *
 * The chosen Page's Page Access Token is then POSTed to the existing
 * /api/agents/[agentId]/channels/messenger endpoint to actually connect the
 * channel — same shape as WhatsApp/Telegram, just with the Page token instead
 * of the original User token.
 *
 * This endpoint does NOT persist anything; it's a pure lookup. Auth is the
 * logged-in workspace user (same as every other /api/agents/[agentId]/* route).
 */
export async function POST(req: Request, props: Params) {
	const params = await props.params
	const user = await getCurrentUser()
	if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

	// Confirm the agent belongs to the caller's workspace (so a logged-in user
	// can't enumerate another workspace's agent by guessing ids).
	const agent = await prisma.agent.findFirst({
		where: { id: params.agentId, workspaceId: user.workspaceId },
		select: { id: true },
	})
	if (!agent) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

	const json = await req.json().catch(() => null)
	const parsed = bodySchema.safeParse(json)
	if (!parsed.success) {
		return NextResponse.json({ error: 'INVALID', issues: parsed.error.flatten() }, { status: 400 })
	}

	const result = await listFacebookPagesWithInstagram(parsed.data.userToken)
	return NextResponse.json(result, { status: 200 })
}
