/**
 * Shared types for the Instagram Automation dashboard.
 *
 * These mirror the backend Prisma model `InstagramAutomation` and the JSON
 * shapes persisted in its `trigger` / `action` columns (validated by zod in
 * `app/api/agents/[agentId]/instagram/automations/route.ts`). The server page
 * serializes rows into `Automation` before handing them to the client manager.
 */

export type AutomationType = 'DIRECT_MESSAGE' | 'COMMENT' | 'STORY'

export type MatchMode = 'EXACT' | 'CONTAINS' | 'STARTS_WITH'

export type StoryScope = 'ALL' | 'KEYWORD'

export type ReplyMode = 'STATIC' | 'AI' | 'FLOW'

export type GateMode = 'SOFT' | 'STORY_MENTION'

export interface AutomationTrigger {
  keywords: string[]
  matchMode: MatchMode
  storyScope: StoryScope
  postIds: string[]
}

export interface AutomationAction {
  replyMode: ReplyMode
  replyText: string
  dmOnComment: boolean
  followGate: boolean
  gateMode: GateMode
  gatePrompt: string
  gateConfirmKeyword: string
  gateQuickReply: string
  contentText: string
  aiAgentEnabled: boolean
}

export interface Automation {
  id: string
  agentId: string
  channelId: string
  type: AutomationType
  name: string
  active: boolean
  priority: number
  trigger: AutomationTrigger
  action: AutomationAction
  createdAt: string
  updatedAt: string
}

/** Shape sent to POST /api/agents/{agentId}/instagram/automations */
export interface CreateAutomationPayload {
  type: AutomationType
  name: string
  active: boolean
  priority: number
  trigger: AutomationTrigger
  action: AutomationAction
}

/** Shape sent to PATCH /api/agents/{agentId}/instagram/automations/{id} (partial) */
export interface UpdateAutomationPayload {
  name?: string
  active?: boolean
  priority?: number
  trigger?: AutomationTrigger
  action?: AutomationAction
}

// ── UI label maps (Persian, inline per task instructions) ────────────────

export const MATCH_MODE_LABEL: Record<MatchMode, string> = {
  EXACT: 'دقیق',
  CONTAINS: 'شامل',
  STARTS_WITH: 'شروع با',
}

export const STORY_SCOPE_LABEL: Record<StoryScope, string> = {
  ALL: 'همه استوری‌ها',
  KEYWORD: 'بر اساس کلمه‌کلیدی',
}

export const REPLY_MODE_LABEL: Record<ReplyMode, string> = {
  STATIC: 'متن ثابت',
  AI: 'هوش مصنوعی (ایجنت)',
  FLOW: 'فلو',
}

export const GATE_MODE_LABEL: Record<GateMode, string> = {
  SOFT: 'نرم (اعتماد)',
  STORY_MENTION: 'سخت (منشن استوری)',
}

export const TYPE_LABEL: Record<AutomationType, string> = {
  DIRECT_MESSAGE: 'دایرکت',
  COMMENT: 'کامنت',
  STORY: 'استوری',
}
