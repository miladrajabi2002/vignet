/**
 * Shared by the manual agent-quality scripts (agent-bench, agent-quality-review,
 * agent-improve): show the estimated OpenRouter cost and the account balance,
 * and run nothing until the operator types «y». Nothing here runs on a schedule.
 */
import readline from 'node:readline'

export async function openRouterBalanceUSD(): Promise<number | null> {
  const key = process.env.OPENROUTER_MANAGEMENT_KEY || process.env.OPENROUTER_API_KEY
  if (!key) return null
  try {
    const response = await fetch('https://openrouter.ai/api/v1/credits', { headers: { Authorization: `Bearer ${key}` } })
    const body = await response.json() as { data?: { total_credits?: number; total_usage?: number } }
    if (typeof body.data?.total_credits !== 'number' || typeof body.data?.total_usage !== 'number') return null
    return body.data.total_credits - body.data.total_usage
  } catch {
    return null
  }
}

/** Print the estimate; resolve true only on an explicit yes (or --yes on the command line). */
export async function confirmCost(lines: string[], estimateUSD: number, maxUSD?: number): Promise<boolean> {
  const balance = await openRouterBalanceUSD()
  console.log('')
  for (const line of lines) console.log(`  ${line}`)
  console.log(`  ≈ estimated cost: $${estimateUSD.toFixed(3)}${maxUSD ? ` (hard cap $${maxUSD.toFixed(2)})` : ''}`)
  if (balance != null) console.log(`  OpenRouter balance now: $${balance.toFixed(2)} (also pays live customer replies)`)
  if (balance != null && balance - estimateUSD < 3) console.log('  ⚠ the balance would drop under $3 — live agents stop answering at $0')
  console.log('')
  if (process.argv.includes('--yes')) return true
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const answer = await new Promise<string>((resolve) => rl.question('Run it? [y/N] ', resolve))
  rl.close()
  return answer.trim().toLowerCase() === 'y' || answer.trim() === 'بله'
}

export function arg(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] ?? null : null
}
