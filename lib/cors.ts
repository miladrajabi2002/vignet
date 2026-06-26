/** Permissive CORS headers for the public web widget endpoints. */
export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
}

export function corsOptions(): Response {
  return new Response(null, { status: 204, headers: corsHeaders })
}
