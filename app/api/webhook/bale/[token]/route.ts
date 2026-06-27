import { handleWebhookRequest } from '@/lib/channels/webhook'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: { token: string } }) {
  return handleWebhookRequest('BALE', params.token, req)
}
