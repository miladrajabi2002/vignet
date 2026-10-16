import { stripProductTokens } from '@/lib/widget/config'
import { cardPayHeading, parseCardPayDirective, payToman } from '@/lib/payments/card/pay-card'

/**
 * One-line preview of a message for inbox rows and "latest conversations"
 * lists. Agent replies are stored as Markdown; a list row shows plain text,
 * so the markers are dropped and only the words stay.
 */
export function conversationPreviewText(content: string): string {
        // A payment card previews as what it pays for and its amount, never as its JSON.
        const { cardPay } = parseCardPayDirective(content)
        if (cardPay) {
                const words = previewWords(content).replace(/\s*👇\s*$/u, '')
                const card = `💳 ${cardPayHeading(cardPay)} · ${payToman(cardPay.amount, cardPay.lang)}`
                return words ? `${words} — ${card}` : card
        }
        const text = previewWords(content)
        if (text) return text
        // A message that is only product cards previews as the product names.
        const names = [...content.matchAll(/\[\[product:(\{[\s\S]*?\})\]\]/g)]
                .map((match) => {
                        try {
                                const name = (JSON.parse(match[1]) as { name?: unknown }).name
                                return typeof name === 'string' ? name.trim() : ''
                        } catch {
                                return ''
                        }
                })
                .filter(Boolean)
        return names.length ? `🛍 ${names.join('، ')}` : ''
}

function previewWords(content: string): string {
        return stripProductTokens(content)
                .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
                .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
                .replace(/(\*\*|__)(.+?)\1/g, '$2')
                .replace(/`([^`]+)`/g, '$1')
                .replace(/^\s{0,3}(#{1,6}|>|[-*+])\s+/gm, '')
                .replace(/\*\*|__/g, '')
                .replace(/\s+/g, ' ')
                .trim()
}
