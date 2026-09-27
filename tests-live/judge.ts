/**
 * Strict LLM judge shared by the live eval and the re-judge script, so the
 * "before" and "after" transcripts are scored by the exact same rubric/model.
 */
export type JudgeVerdict = {
  naturalness: number
  helpfulness: number
  grounding: number
  memory: number
  tells: string[]
  verdict: string
}

export type JudgedTurn = { user: string; reply: string; error?: string }

const MODELS = [process.env.EVAL_JUDGE_MODEL || 'anthropic/claude-sonnet-5', 'anthropic/claude-sonnet-4.6']

export function stripMarkers(reply: string): string {
  return reply.replace(/\[\[product:[^\n]*?\]\]/g, (marker) => {
    const name = marker.match(/"name":"([^"]+)"/)?.[1]
    return name ? `[کارت محصول: ${name}]` : '[کارت محصول]'
  }).trim()
}

export async function judgeTranscript(title: string, turns: JudgedTurn[]): Promise<JudgeVerdict | null> {
  const transcript = turns
    .map((t) => `مشتری: ${t.user}\nایجنت: ${stripMarkers(t.reply) || `(خطا: ${t.error ?? 'empty'})`}`)
    .join('\n\n')
  const system = `You are a strict senior reviewer of Persian e-commerce chat agents (Instagram/Telegram DM for a furniture brand). Score the AGENT only. Be harsh: 5 = indistinguishable from an excellent human sales expert, 3 = acceptable but clearly bot-like or partly unhelpful, 1 = wrong/confusing.
"[کارت محصول: X]" means the agent attached a real product card (photo, price, buy button) for X — that is good when relevant, spammy when repeated for no reason.
Return ONLY JSON: {"naturalness":1-5,"helpfulness":1-5,"grounding":1-5,"memory":1-5,"tells":["short list of robotic/AI tells or mistakes"],"verdict":"one short Persian sentence"}
- naturalness: human DM tone, no filler, no repeated greetings, no parroting, no over-formal/bureaucratic Persian, sensible length.
- helpfulness: answers exactly what was asked, moves the sale forward sensibly, asks at most one needed question.
- grounding: no invented facts/promises/completed actions (order registered, reserved, "I transferred you", etc.).
- memory: uses earlier turns/known facts correctly; never re-asks known info; 5 if not applicable.
Scenario intent: ${title}`
  for (const model of MODELS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            temperature: 0,
            max_tokens: 700,
            messages: [{ role: 'system', content: system }, { role: 'user', content: transcript }],
          }),
          signal: AbortSignal.timeout(120_000),
        })
        const json = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
        const text = String(json?.choices?.[0]?.message?.content ?? '')
        const start = text.indexOf('{')
        const end = text.lastIndexOf('}')
        if (start === -1 || end <= start) throw new Error(`no JSON (${response.status})`)
        const parsed = JSON.parse(text.slice(start, end + 1)) as JudgeVerdict
        if (typeof parsed.naturalness !== 'number') throw new Error('bad shape')
        return parsed
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 2_000 * (attempt + 1)))
      }
    }
  }
  return null
}
