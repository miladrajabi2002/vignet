import { Package } from 'lucide-react'
import { BaseNode } from './base-node'

export function ProductLookupNode({
  data,
}: {
  data: { label?: string; text?: string }
}) {
  return (
    <BaseNode
      icon={Package}
      title={data.label || 'Product lookup'}
      body={data.text || 'Search the product catalog'}
      sources={[
        { id: 'found', label: 'found', top: '35%' },
        { id: 'missing', label: 'none', top: '70%' },
      ]}
    />
  )
}
