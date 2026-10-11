/**
 * Single source of truth for the public support phone number.
 *
 * Previously this number was hardcoded in five places (homepage JSON-LD,
 * footer aria-labels, footer tel: link and footer display text), which let
 * copies drift apart when the number changed. Import from here everywhere.
 *
 * `e164` is for tel: links and structured data (schema.org telephone).
 * `display` is the human-readable national format shown in the UI.
 *
 * Telegram is reached by username, not by a t.me/+98… phone link: a phone
 * link only resolves when the account lets everyone find it by number.
 */
export const SUPPORT_PHONE_E164 = '+989128352271'
export const SUPPORT_PHONE_DISPLAY = '09128352271'
export const SUPPORT_TELEGRAM_USERNAME = 'vigent_ir'
export const SUPPORT_TELEGRAM_URL = `https://t.me/${SUPPORT_TELEGRAM_USERNAME}`
