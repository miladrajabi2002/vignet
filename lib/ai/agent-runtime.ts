/**
 * Customer-facing agent generation is intentionally managed by the platform.
 * Keeping these values out of agent forms prevents confusing per-agent knobs
 * and gives every web/messenger surface the same predictable reply profile.
 */
// Customer-facing business answers benefit from lower variance: it keeps
// policy boundaries, one-question flow and catalog wording stable while the
// prompt still carries the brand's conversational tone.
export const AGENT_RESPONSE_TEMPERATURE = 0.3
export const AGENT_MAX_RESPONSE_TOKENS = 600
