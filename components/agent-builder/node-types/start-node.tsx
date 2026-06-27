import { Play } from 'lucide-react'
import { BaseNode } from './base-node'

export function StartNode({ data }: { data: { label?: string } }) {
  return (
    <BaseNode
      icon={Play}
      title={data.label || 'Start'}
      hasTarget={false}
      accent
    />
  )
}
