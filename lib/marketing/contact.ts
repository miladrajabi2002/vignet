/**
 * Single source of truth for the public support phone number.
 *
 * Previously this number was hardcoded in five places (homepage JSON-LD,
 * footer aria-labels, footer tel: link and footer display text), which let
 * copies drift apart when the number changed. Import from here everywhere.
 *
 * `e164` is for tel: links and structured data (schema.org telephone).
 * `display` is the human-readable national format shown in the UI.
 */
export const SUPPORT_PHONE_E164 = '+989128352271'
export const SUPPORT_PHONE_DISPLAY = '09128352271'
