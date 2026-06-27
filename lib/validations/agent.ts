import { z } from 'zod'

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

export type AgentCreateInput = z.infer<typeof agentCreateSchema>
export type AgentUpdateInput = z.infer<typeof agentUpdateSchema>
