import { GitBranch } from 'lucide-react'
import { BaseNode } from './base-node'

export function ConditionNode({
  data,
}: {
  data: { label?: string; text?: string }
}) {
  return (
    <BaseNode
      icon={GitBranch}
      title={data.label || 'Condition'}
      body={data.text}
      sources={[
        { id: 'true', label: 'yes', top: '35%' },
        { id: 'false', label: 'no', top: '70%' },
      ]}
    />
  )
}
