import { handleWebhookRequest } from '@/lib/channels/webhook'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  return handleWebhookRequest('RUBIKA', params.token, req)
}
