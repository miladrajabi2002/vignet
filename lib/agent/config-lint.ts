/**
 * Owner-facing checks of an agent's own configuration: settings that make the
 * agent promise one thing and do another.
 *
 * The agent behind the 2026-10-19 thread that never reached a person had
 * proactive handoff switched off, while its personality said «به اپراتور
 * تحویل بده» and «همکارت تماس می‌گیرد». The customer was promised a call
 * three times; nothing told the owner the two settings disagree.
 */

/** Words an owner uses when telling the agent to pass a chat to a person. */
const HANDOFF_WORDS = [
  'اپراتور', 'انتقال', 'تحویل بده', 'منتقل کن', 'ارجاع', 'همکارت', 'همکارم', 'کارشناس انسانی',
  'پشتیبان انسانی', 'تماس بگیرد', 'تماس می‌گیرد', 'تماس میگیرد',
  'operator', 'human agent', 'hand off', 'handoff', 'transfer', 'escalate',
]

function configText(agent: { systemPrompt?: string | null; promptConfig?: unknown }): string {
  return `${agent.systemPrompt ?? ''}\n${agent.promptConfig ? JSON.stringify(agent.promptConfig) : ''}`
    .normalize('NFKC')
    .replace(/‌/g, ' ')
    .toLowerCase()
}

/** The prompt asks for transfers to a person while proactive handoff is off. */
export function handoffPromptMismatch(agent: {
  handoffEnabled: boolean
  systemPrompt?: string | null
  promptConfig?: unknown
}): string[] {
  if (agent.handoffEnabled) return []
  const text = configText(agent)
  return HANDOFF_WORDS.filter((word) => text.includes(word.replace(/‌/g, ' ').toLowerCase()))
}
