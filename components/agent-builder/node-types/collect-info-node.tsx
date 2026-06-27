import { ClipboardList } from 'lucide-react'
import { BaseNode } from './base-node'

export function CollectInfoNode({
  data,
}: {
  data: { label?: string; text?: string }
}) {
  return (
    <BaseNode
      icon={ClipboardList}
      title={data.label || 'Collect info'}
      body={data.text || 'Ask the user for details'}
    />
  )
}
