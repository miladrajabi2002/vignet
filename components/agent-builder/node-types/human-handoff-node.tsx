import { UserRound } from 'lucide-react'
import { BaseNode } from './base-node'

export function HumanHandoffNode({
  data,
}: {
  data: { label?: string; text?: string }
}) {
  return (
    <BaseNode
      icon={UserRound}
      title={data.label || 'Human handoff'}
      body={data.text}
      sources={[]}
    />
  )
}
