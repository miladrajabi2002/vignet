import { z } from 'zod'

// ── 6-LAYER PROMPT CONFIG (F1) ──────────────────────────────────────
export const promptFormatSchema = z.object({
  bold: z.boolean().default(true),
  emoji: z.boolean().default(false),
  links: z.boolean().default(true),
  bullets: z.boolean().default(true),
  length: z.enum(['short', 'medium', 'long']).default('medium'),
})

export const promptQAPairSchema = z.object({
  question: z.string().max(500),
  answer: z.string().max(2000),
})

export const promptConfigSchema = z.object({
  personality: z.string().max(2000).default(''),
  tone: z.string().max(2000).default(''),
  doSay: z.array(z.string().max(500)).max(20).default([]),
  dontSay: z.array(z.string().max(500)).max(20).default([]),
  fallbackBehavior: z.string().max(2000).default(''),
  format: promptFormatSchema.default({
    bold: true,
    emoji: false,
    links: true,
    bullets: true,
    length: 'medium',
  }),
  qaPairs: z.array(promptQAPairSchema).max(20).default([]),
})

export const roleTemplateKeys = [
  'pre_sales',
  'sales_consult',
  'follow_up',
  'post_sale_support',
  'general_support',
  'custom',
] as const

export const agentCreateSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(280).optional(),
  systemPrompt: z
    .string()
    .max(8000)
    .optional()
    .default('تو یک دستیار هوشمند و مفید برای این کسب‌وکار هستی.'),
  model: z.string().max(120).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(8000).optional(),
  language: z.enum(['fa', 'en']).optional(),
  voiceEnabled: z.boolean().optional(),
  ttsVoice: z.string().max(40).optional(),
  welcomeMessage: z.string().max(500).optional(),
  fallbackMessage: z.string().max(500).optional(),
  handoffEnabled: z.boolean().optional(),
  handoffMessage: z.string().max(500).optional(),
  handoffKeywords: z.array(z.string().max(50)).max(20).optional(),
  // ─ F1: layered prompt
  promptConfig: promptConfigSchema.nullable().optional(),
  roleTemplate: z.enum(roleTemplateKeys).optional(),
  // ─ F3: customer identification
  requireCustomerInfo: z.boolean().optional(),
  customerInfoPrompt: z.string().max(1000).optional(),
})

/** A persisted visual-builder graph. Kept loose — it's a design artifact. */
export const flowConfigSchema = z.object({
  nodes: z.array(z.any()).max(200),
  edges: z.array(z.any()).max(400),
})

export const agentUpdateSchema = agentCreateSchema.partial().extend({
  active: z.boolean().optional(),
  flowConfig: flowConfigSchema.optional(),
})

export type FlowConfig = z.infer<typeof flowConfigSchema>
export type PromptConfig = z.infer<typeof promptConfigSchema>
export type PromptFormatConfig = z.infer<typeof promptFormatSchema>
export type PromptQAPair = z.infer<typeof promptQAPairSchema>
export type RoleTemplateKey = (typeof roleTemplateKeys)[number]

export type AgentCreateInput = z.infer<typeof agentCreateSchema>
export type AgentUpdateInput = z.infer<typeof agentUpdateSchema>
