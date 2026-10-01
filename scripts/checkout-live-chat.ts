/**
 * Live in-chat checkout conversation driver.
 *
 * Talks to a running Vigent server through the public chat-link API exactly
 * like the /c/<slug> page does (SSE stream, conversation token), with the real
 * model and the real catalog. Prints every turn and, at the end, the checkout
 * link the agent issued.
 *
 *   npx tsx scripts/checkout-live-chat.ts <baseUrl> <slug | widget:agentId> "<msg 1>" "<msg 2>" …
 *   CHAT_STATE=/path/state.json keeps the conversation across invocations.
 */
import fs from 'node:fs'

type State = { conversationId?: string; token?: string }

async function send(base: string, slug: string, message: string, state: State): Promise<string> {
  // «widget:<agentId>» talks to the embeddable web widget API instead.
  const widgetAgent = slug.startsWith('widget:') ? slug.slice(7) : null
  const url = widgetAgent ? `${base}/api/widget/${widgetAgent}/chat` : `${base}/api/chat-link/${slug}/chat`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Forwarded-For': '10.99.0.7',
      ...(widgetAgent ? { Origin: 'https://vigent.ir', Referer: 'https://vigent.ir/demo-shop/' } : {}),
    },
    body: JSON.stringify({ message, conversationId: state.conversationId ?? null, conversationToken: state.token ?? null }),
  })
  if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}: ${await response.text()}`)
  const token = response.headers.get('x-vigent-conversation-token')
  if (token) state.token = token
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let reply = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const events = buffer.split('\n\n')
    buffer = events.pop() ?? ''
    for (const event of events) {
      const line = event.split('\n').find((part) => part.startsWith('data:'))
      if (!line) continue
      const data = JSON.parse(line.slice(5).trim()) as { type: string; text?: string; conversationId?: string; error?: string }
      if (data.type === 'meta' && data.conversationId) state.conversationId = data.conversationId
      if (data.type === 'delta' && data.text) reply += data.text
      if (data.type === 'replace' && data.text != null) reply = data.text
      if (data.type === 'error') throw new Error(`stream error ${data.error}`)
    }
  }
  return reply
}

async function main() {
  const [base, slug, ...messages] = process.argv.slice(2)
  const statePath = process.env.CHAT_STATE
  const state: State = statePath && fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : {}
  let lastLink: string | null = null
  for (const message of messages) {
    const started = Date.now()
    const reply = await send(base, slug, message, state)
    const marker = /\[\[checkout:(\{[\s\S]*?\})\]\](?!\])/.exec(reply)
    if (marker) lastLink = (JSON.parse(marker[1]) as { url: string }).url
    console.log(`\n👤 ${message}\n🤖 (${((Date.now() - started) / 1000).toFixed(1)}s) ${reply.replace(/\[\[(?:checkout|product):\{[\s\S]*?\}\]\](?!\])/g, (token) => token.startsWith('[[checkout') ? '[کارت پرداخت]' : '[کارت محصول]')}`)
  }
  if (statePath) fs.writeFileSync(statePath, JSON.stringify(state))
  console.log(`\nconversationId=${state.conversationId}`)
  if (lastLink) console.log(`CHECKOUT_LINK=${lastLink}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
