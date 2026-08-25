import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  AGENT_MAX_RESPONSE_TOKENS,
  AGENT_RESPONSE_TEMPERATURE,
} from '@/lib/ai/agent-runtime'
import {
  hasCompleteCustomerIdentity,
  identificationInstruction,
} from '@/lib/ai/customer-identification'
import { resolveCustomerIdentificationPolicy } from '@/lib/customer-identification-policy'
import { agentCreateSchema } from '@/lib/validations/agent'

const source = (file: string) => readFileSync(path.join(process.cwd(), file), 'utf8')

describe('managed agent generation settings', () => {
  it('uses one bounded reply profile for customer-facing agents', () => {
    expect(AGENT_MAX_RESPONSE_TOKENS).toBe(600)
    expect(AGENT_RESPONSE_TEMPERATURE).toBe(0.3)
  })

  it('strips legacy client overrides from the agent API contract', () => {
    const parsed = agentCreateSchema.parse({
      name: 'Sales agent',
      temperature: 2,
      maxTokens: 1200,
    })
    expect(parsed).not.toHaveProperty('temperature')
    expect(parsed).not.toHaveProperty('maxTokens')
  })

  it('does not expose temperature or token fields in create/settings surfaces', () => {
    const settings = source('components/agents/agent-settings-form.tsx')
    const wizard = source('components/agent-builder/agent-wizard.tsx')
    expect(settings).not.toContain('form.temperature')
    expect(settings).not.toContain('form.maxTokens')
    expect(wizard).not.toContain('form.maxTokens')
  })

  it('opens prompt preview as an accessible portal dialog', () => {
    const settings = source('components/agents/agent-settings-form.tsx')
    expect(settings).toContain("onClick={() => setShowPreview(true)}")
    expect(settings).toContain('aria-label={tf(\'previewPrompt\')}')
    expect(settings).toContain('document.body')
  })
})

describe('required customer identification policy', () => {
  const disabledChannel = {
    leadCapture: false,
    leadCaptureRequired: false,
    leadCaptureMessage: null,
  }

  it('forces the same mandatory form in web surfaces when enabled on the agent', () => {
    expect(resolveCustomerIdentificationPolicy(disabledChannel, {
      requireCustomerInfo: true,
      customerInfoPrompt: 'Please introduce yourself.',
    })).toEqual({
      leadCapture: true,
      leadCaptureRequired: true,
      leadCaptureMessage: 'Please introduce yourself.',
    })
  })

  it('enforces the resolved policy in both public chat endpoints', () => {
    const widget = source('app/api/widget/[agentId]/chat/route.ts')
    const chatLink = source('app/api/chat-link/[slug]/chat/route.ts')
    for (const route of [widget, chatLink]) {
      expect(route).toContain('resolveCustomerIdentificationPolicy(settings, agent)')
      expect(route).toContain('identificationPolicy.leadCaptureRequired')
      expect(route).toContain("{ error: 'LEAD_REQUIRED' }")
    }
  })

  it('does not weaken independent channel settings when agent enforcement is off', () => {
    expect(resolveCustomerIdentificationPolicy(disabledChannel, {
      requireCustomerInfo: false,
    })).toBe(disabledChannel)
  })

  it('requires both name and phone before identification completes', () => {
    expect(hasCompleteCustomerIdentity({ name: 'علی', phone: null })).toBe(false)
    expect(hasCompleteCustomerIdentity({ name: null, phone: '+989123456789' })).toBe(false)
    expect(hasCompleteCustomerIdentity({ name: 'علی', phone: '+989123456789' })).toBe(true)
  })

  it('keeps both fields mandatory in the model fallback instruction', () => {
    const instruction = identificationInstruction(true)
    expect(instruction).toContain('هم نام و هم شماره معتبر')
    expect(instruction).not.toContain('فقط نام کافی است')
  })
})
