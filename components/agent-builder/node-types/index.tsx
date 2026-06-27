import type { LucideIcon } from 'lucide-react'
import {
  Play,
  MessageSquare,
  GitBranch,
  Sparkles,
  UserRound,
  ClipboardList,
  Package,
} from 'lucide-react'
import { StartNode } from './start-node'
import { MessageNode } from './message-node'
import { ConditionNode } from './condition-node'
import { AiResponseNode } from './ai-response-node'
import { HumanHandoffNode } from './human-handoff-node'
import { CollectInfoNode } from './collect-info-node'
import { ProductLookupNode } from './product-lookup-node'

/** React Flow node type registry. */
export const nodeTypes = {
  start: StartNode,
  message: MessageNode,
  condition: ConditionNode,
  aiResponse: AiResponseNode,
  humanHandoff: HumanHandoffNode,
  collectInfo: CollectInfoNode,
  productLookup: ProductLookupNode,
}

export type FlowNodeType = keyof typeof nodeTypes

/** Palette entries shown in the builder toolbar. `start` is created implicitly. */
export const PALETTE: {
  type: FlowNodeType
  labelKey: string
  descKey: string
  icon: LucideIcon
}[] = [
  { type: 'message', labelKey: 'nodeMessage', descKey: 'descMessage', icon: MessageSquare },
  { type: 'aiResponse', labelKey: 'nodeAi', descKey: 'descAi', icon: Sparkles },
  { type: 'condition', labelKey: 'nodeCondition', descKey: 'descCondition', icon: GitBranch },
  { type: 'collectInfo', labelKey: 'nodeCollect', descKey: 'descCollect', icon: ClipboardList },
  { type: 'productLookup', labelKey: 'nodeProduct', descKey: 'descProduct', icon: Package },
  { type: 'humanHandoff', labelKey: 'nodeHandoff', descKey: 'descHandoff', icon: UserRound },
]

export const START_ICON = Play
