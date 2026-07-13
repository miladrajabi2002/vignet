import { z } from 'zod'
import { MODEL_ALIASES } from '@/lib/ai/models'

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
  // One complete recommended template per business type
  'commerce_recommended',
  'food_recommended',
  'appointments_recommended',
  'services_recommended',
  'education_recommended',
  'support_recommended',
  'social_recommended',
  'general_recommended',
  // Previous business-specific keys remain accepted for existing agents
  'commerce_sales',
  'commerce_after_sales',
  'commerce_product_support',
  'food_order_guide',
  'food_booking_host',
  'food_order_support',
  'appointments_reception',
  'appointments_service_guide',
  'appointments_follow_up',
  'services_consultant',
  'services_request_capture',
  'services_delivery_support',
  'education_course_advisor',
  'education_enrollment',
  'education_student_support',
  'support_frontline',
  'support_troubleshooter',
  'support_ticket_follow_up',
  'social_dm_sales',
  'social_engagement',
  'social_order_follow_up',
  'custom_full_service',
  'custom_sales',
  'custom_support',
  // Current need-based templates
  'full_service',
  'sales_consultant',
  'support_specialist',
  'after_sales',
  'lead_capture',
  'custom',
  // Legacy keys — still accepted so existing agents keep validating
  'pre_sales',
  'sales_consult',
  'follow_up',
  'post_sale_support',
  'general_support',
] as const

export const agentCreateSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(280).optional(),
  systemPrompt: z
    .string()
    .max(8000)
    .optional()
    .default('تو یک دستیار هوشمند و مفید برای این کسب‌وکار هستی.'),
  model: z.enum(MODEL_ALIASES).nullable().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(1200).optional(),
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

export const agentUpdateSchema = agentCreateSchema.partial().extend({
  active: z.boolean().optional(),
})

export type PromptConfig = z.infer<typeof promptConfigSchema>
export type PromptFormatConfig = z.infer<typeof promptFormatSchema>
export type PromptQAPair = z.infer<typeof promptQAPairSchema>
export type RoleTemplateKey = (typeof roleTemplateKeys)[number]

export type AgentCreateInput = z.infer<typeof agentCreateSchema>
export type AgentUpdateInput = z.infer<typeof agentUpdateSchema>
