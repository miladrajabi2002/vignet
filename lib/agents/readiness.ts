export interface AgentReadinessSignal {
  key: string
  done: boolean
  required: boolean
}

export interface AgentReadinessSummary {
  complete: boolean
  doneCount: number
  totalCount: number
  progress: number
  optionalRemaining: number
}

export function summarizeAgentReadiness(
  signals: AgentReadinessSignal[],
): AgentReadinessSummary {
  const requiredSignals = signals.filter((signal) => signal.required)
  const doneCount = requiredSignals.filter((signal) => signal.done).length
  const totalCount = requiredSignals.length

  return {
    complete: totalCount > 0 && doneCount === totalCount,
    doneCount,
    totalCount,
    progress: totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0,
    optionalRemaining: signals.filter(
      (signal) => !signal.required && !signal.done,
    ).length,
  }
}
