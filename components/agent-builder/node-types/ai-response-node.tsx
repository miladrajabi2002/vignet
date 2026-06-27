import { Sparkles } from 'lucide-react'
import { BaseNode } from './base-node'

export function AiResponseNode({
  data,
}: {
  data: { label?: string; text?: string }
}) {
  return (
    <BaseNode
      icon={Sparkles}
      title={data.label || 'AI response'}
      body={data.text || 'Answer from knowledge base'}
    />
  )
}
