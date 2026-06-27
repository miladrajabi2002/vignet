import { MessageSquare } from 'lucide-react'
import { BaseNode } from './base-node'

export function MessageNode({
  data,
}: {
  data: { label?: string; text?: string }
}) {
  return (
    <BaseNode
      icon={MessageSquare}
      title={data.label || 'Message'}
      body={data.text}
    />
  )
}
