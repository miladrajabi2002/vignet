/**
 * Shared types for the Instagram Automation dashboard (v2).
 *
 * These mirror the expanded `InstagramAutomation.action` JSON shape that the
 * BACKEND-AUTO-V2 API expects (zod-validated in
 * `app/api/agents/[agentId]/instagram/automations/route.ts`), plus the new
 * channel-level `InstagramAutomationSettings` exposed at
 * `GET/PATCH /api/agents/{agentId}/instagram/settings`.
 *
 * NOTE: the backend zod schemas are still being expanded by the parallel
 * BACKEND-AUTO-V2 agent. The shapes below match the *target* contract described
 * in FRONTEND-AUTO-V2 and gracefully degrade when fields are missing — every
 * reader uses optional chaining + fallback defaults. As long as the backend
 * accepts the JSON we send and echoes back a `InstagramAutomation` row, the UI
 * keeps working; unknown/legacy fields are simply preserved when present.
 */

export type AutomationType = 'DIRECT_MESSAGE' | 'COMMENT' | 'STORY'

export type MatchMode = 'EXACT' | 'CONTAINS' | 'STARTS_WITH'

export type StoryScope = 'ALL' | 'KEYWORD'

// ── Expanded reply modes (BACKEND-AUTO-V2) ───────────────────────────────
//   STATIC        → fixed text/media reply (uses messages[])
//   AI            → route through the agent's LLM engine
//   FLOW          → route through the flow builder (legacy alias of AI for now)
//   SILENT        → no reply (mute the trigger)
//   STOP_AI       → stop AI replies for this user/thread
//   MULTI_MESSAGE → pick one message from a list (used for COMMENT replies)
export type ReplyMode = 'STATIC' | 'AI' | 'FLOW' | 'SILENT' | 'STOP_AI' | 'MULTI_MESSAGE'

export type GateMode = 'SOFT' | 'STORY_MENTION'

// ── Message types (inside action.messages[]) ─────────────────────────────
//   TEXT    → plain text body (uses `text`)
//   IMAGE   → single image with optional caption (uses `mediaUrl` + `text`)
//   AUDIO   → voice clip (uses `mediaUrl`)
//   VIDEO   → video clip (uses `mediaUrl`)
//   PRODUCT → product card (uses `productId`)
export type MessageType = 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'PRODUCT'

export type MediaType = 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'PRODUCT'

/** A single message inside an action's `messages[]` list. */
export interface AutomationMessage {
  id: string // client-generated stable id for React keys + reordering
  type: MessageType
  text: string
  mediaUrl?: string
  mediaType?: MediaType
  productId?: string
  // Optional quick-reply buttons attached to this message (up to 3).
  quickReplies?: string[]
}

export interface AutomationTrigger {
  keywords: string[]
  matchMode: MatchMode
  storyScope: StoryScope
  postIds: string[]
}

export interface AutomationAction {
  // ── Expanded (BACKEND-AUTO-V2) ────────────────────────────────────────
  replyMode: ReplyMode
  /** Ordered list of messages (used by STATIC, MULTI_MESSAGE). */
  messages?: AutomationMessage[]
  /** Convenience: for STATIC with a single TEXT message, the body. */
  replyText?: string
  /** Legacy/compat field — kept so existing rows still round-trip. */
  mediaType?: MediaType
  mediaUrl?: string
  productId?: string
  // ── Comment funnel ────────────────────────────────────────────────────
  dmOnComment?: boolean
  // ── Follow gate (kept for v1 compatibility) ───────────────────────────
  followGate?: boolean
  gateMode?: GateMode
  gatePrompt?: string
  gateConfirmKeyword?: string
  gateQuickReply?: string
  contentText?: string
  aiAgentEnabled?: boolean
  // ── Follow-up (delayed second message after the main reply) ───────────
  followUpEnabled?: boolean
  /** NOTE: the backend column is named `followUpDelayMin` (matches the Prisma
   *  model), NOT `followUpDelayMinutes`. The backend zod schema rejects the
   *  wrong name (strips it silently and uses the default). */
  followUpDelayMin?: number
  followUpMessage?: string
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

// ── Channel-level settings (BACKEND-AUTO-V2) ──────────────────────────────
export type ReplyPolicy =
  | 'ALL_AGENT' // every message goes through the AI agent
  | 'AGENT_EXCEPT_SCENARIOS' // agent handles everything EXCEPT matched scenarios (default)
  | 'AUTOMATION_ONLY' // only automation scenarios reply; agent is silent

export interface InstagramAutomationSettings {
  replyPolicy: ReplyPolicy
  stopWords: string[]
  welcomeMessage: string
  // Follow-up at the channel level (sent when the agent has been silent for
  // `followUpDelayMin` after the user's last message). The backend column is
  // `followUpDelayMin` (matches the Prisma model).
  followUpEnabled: boolean
  followUpDelayMin: number
  followUpMessage: string
  /** Master AI toggle (sent by backend, not edited in this UI yet). */
  aiEnabled?: boolean
}

export const DEFAULT_SETTINGS: InstagramAutomationSettings = {
  replyPolicy: 'AGENT_EXCEPT_SCENARIOS',
  stopWords: [],
  welcomeMessage: '',
  followUpEnabled: false,
  followUpDelayMin: 60,
  followUpMessage: '',
  aiEnabled: true,
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
  AI: 'پاسخ هوشمند',
  FLOW: 'فلو',
  SILENT: 'بدون پاسخ',
  STOP_AI: 'توقف هوش مصنوعی',
  MULTI_MESSAGE: 'چند پیام',
}

export const REPLY_MODE_SHORT_LABEL: Record<ReplyMode, string> = {
  STATIC: 'ثابت',
  AI: 'هوشمند',
  FLOW: 'فلو',
  SILENT: 'بی‌صدا',
  STOP_AI: 'توقف AI',
  MULTI_MESSAGE: 'چندگزینه‌ای',
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

export const REPLY_POLICY_LABEL: Record<ReplyPolicy, string> = {
  ALL_AGENT: 'همه پیام‌ها توسط ایجنت',
  AGENT_EXCEPT_SCENARIOS: 'ایجنت به جز سناریوها',
  AUTOMATION_ONLY: 'فقط اتوماسیون',
}

export const MESSAGE_TYPE_LABEL: Record<MessageType, string> = {
  TEXT: 'متن',
  IMAGE: 'عکس',
  AUDIO: 'وویس',
  VIDEO: 'ویدیو',
  PRODUCT: 'محصول',
}

/** Generate a short stable id for a new AutomationMessage (client-only). */
export function newMessageId(): string {
  // crypto.randomUUID exists in all modern browsers; fall back to a counter
  // for SSR + tests where the API isn't available.
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}
