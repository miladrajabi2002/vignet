export interface LeadCaptureSettings {
        leadCapture: boolean
        leadCaptureRequired: boolean
        leadCaptureMessage: string | null
}

/**
 * Agent-level customer identification is the source of truth. Channel-level
 * lead capture can still opt into a softer form, but it cannot weaken an agent
 * that requires both name and phone.
 */
export function resolveCustomerIdentificationPolicy<T extends LeadCaptureSettings>(
        settings: T,
        agent: { requireCustomerInfo: boolean; customerInfoPrompt?: string | null },
): T {
        if (!agent.requireCustomerInfo) return settings
        const prompt = agent.customerInfoPrompt?.trim()
        return {
                ...settings,
                leadCapture: true,
                leadCaptureRequired: true,
                leadCaptureMessage: prompt ? prompt.slice(0, 200) : settings.leadCaptureMessage,
        }
}

