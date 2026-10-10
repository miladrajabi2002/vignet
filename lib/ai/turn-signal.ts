/**
 * TURN SIGNAL — conversation analytics carried by the reply request itself.
 *
 * The reply model already reads the whole thread to answer the customer, so
 * it is asked to append one hidden status line describing what it just saw:
 * the customer's mood, how close they are to buying, whether the reply
 * actually resolved the request, the topic and a few observable cues. That
 * costs ~20 output tokens on a request that is being made anyway — no second
 * model call.
 *
 * Three rules keep it trustworthy:
 *   1. The line never reaches a customer. It is stripped from the final text
 *      in both engines and held back while streaming.
 *   2. The model reports observable facts, not a score. Satisfaction and
 *      buyer probability are computed here, in code, so they stay stable
 *      across models and cannot be inflated by an optimistic reply model.
 *   3. It is optional. A missing or malformed line leaves the deterministic
 *      heuristic in charge; handoff policy never reads these signals.
 */

export const TURN_SIGNAL_VERSION = 1

export type TurnMood = 'pos' | 'neu' | 'neg' | 'ang'
export type TurnAnswer = 'y' | 'p' | 'n'
export type TurnBuyLevel = 0 | 1 | 2 | 3

export const TURN_TOPICS = [
        'product',
        'price',
        'stock',
        'shipping',
        'payment',
        'order',
        'return',
        'booking',
        'info',
        'complaint',
        'chat',
] as const
export type TurnTopic = (typeof TURN_TOPICS)[number]

export const TURN_CUES = [
        'thanks',
        'praise',
        'repeat',
        'confused',
        'complaint',
        'human',
        'decline',
        'pricey',
        'distrust',
] as const
export type TurnCue = (typeof TURN_CUES)[number]

export const TURN_OFFERS = ['order', 'restock', 'showcase', 'booking'] as const
export type TurnOffer = (typeof TURN_OFFERS)[number]

export interface TurnSignal {
        v: number
        mood: TurnMood
        buy: TurnBuyLevel
        answered: TurnAnswer
        topic: TurnTopic | null
        cues: TurnCue[]
        /**
         * What this reply ends by offering or asking the customer to confirm.
         * Stored as the conversation's pending offer, so the next «آره» is
         * resolved from state instead of regex over the agent's own words.
         */
        offer?: TurnOffer
}

/**
 * Appended to the very end of the system prompt. English on purpose: it is a
 * format contract, not customer-facing copy, and every supported model follows
 * it regardless of the reply language.
 */
export const TURN_SIGNAL_INSTRUCTION = `=== Hidden status line (mandatory, every reply) ===
End every reply with one extra final line in exactly this format. It is removed before the customer sees anything; never mention it.
[[st:m=<pos|neu|neg|ang>;b=<0|1|2|3>;a=<y|p|n>;t=<topic>;c=<cues or ->;o=<offer>]]
m = the customer's mood in their LAST message: pos only if they literally thank or praise; neu for plain questions, confirmations and requests (the default), including when they report a problem, say something does not work or ask for a person in a normal tone; neg only if they say they are unhappy, disappointed or impatient with the business or its answers; ang if angry or insulting.
b = buying stage of their LAST message: 0 not about buying; 1 exploring what is offered; 2 asking about a specific item (price, stock, delivery, payment terms, comparison); 3 says they want it, asks how to order or pay, confirms an order, gives order details or says they paid.
a = whether your reply resolves their request: y fully (or nothing needed answering); p partly; n you lack the information or ability.
t = main topic, one of: product, price, stock, shipping, payment, order, return, booking, info, complaint, chat.
c = cues literally present in their LAST message, comma-separated, or "-": thanks, praise, repeat (asks again for something still unresolved), confused, complaint (unhappy with the business, an order or the service; a problem report or a request for help is not a complaint), human (wants a person), decline (will not buy, or not now), pricey (finds it expensive), distrust.
o = what YOUR reply ends by offering or asking them to confirm: order (offered to register/place the order), restock (offered to notify when back in stock), showcase (offered to show/send products), booking (asked to confirm an appointment), or - for nothing.
The status lines on earlier replies describe earlier messages. Judge the LAST message afresh; never copy an earlier line.`

/** Render a signal back into the wire format (used to tag history replies). */
export function formatTurnSignal(signal: Pick<TurnSignal, 'mood' | 'buy' | 'answered' | 'topic' | 'cues'>): string {
        return `[[st:m=${signal.mood};b=${signal.buy};a=${signal.answered};t=${signal.topic ?? 'info'};c=${signal.cues.join(',') || '-'}]]`
}

const MOOD_ALIASES: Record<string, TurnMood> = {
        pos: 'pos', positive: 'pos', happy: 'pos',
        neu: 'neu', neutral: 'neu',
        neg: 'neg', negative: 'neg',
        ang: 'ang', angry: 'ang',
}

const ANSWER_ALIASES: Record<string, TurnAnswer> = {
        y: 'y', yes: 'y', full: 'y',
        p: 'p', partial: 'p', partly: 'p',
        n: 'n', no: 'n', none: 'n',
}

/** A complete status line, tolerant of spacing, single brackets and backticks. */
const COMPLETE_TAG = /`?\[{1,2}\s*st\s*:([^\]\n]*)\]{1,2}`?/gi
/** A status line that was cut off (max tokens) or is still being streamed. */
const TRAILING_PARTIAL_TAG = /`?\[{1,2}\s*(?:s(?:t(?:\s*:[^\]\n]*\]?)?)?)?$/i

function parseFields(body: string): TurnSignal | null {
        const fields = new Map<string, string>()
        for (const part of body.split(/[;|]/)) {
                const separator = part.search(/[=:]/)
                if (separator < 1) continue
                const key = part.slice(0, separator).trim().toLowerCase().replace(/["'{}]/g, '')
                const value = part.slice(separator + 1).trim().toLowerCase().replace(/["'{}<>]/g, '')
                if (key && !fields.has(key)) fields.set(key, value)
        }

        const mood = MOOD_ALIASES[fields.get('m') ?? '']
        const buyRaw = Number.parseInt(fields.get('b') ?? '', 10)
        // Mood and buying level are the two readings every consumer depends on;
        // without both the line is treated as absent rather than half-trusted.
        if (!mood || !Number.isInteger(buyRaw) || buyRaw < 0 || buyRaw > 3) return null

        const topicRaw = fields.get('t') ?? ''
        const topic = (TURN_TOPICS as readonly string[]).includes(topicRaw) ? (topicRaw as TurnTopic) : null
        const cues = Array.from(new Set(
                (fields.get('c') ?? '')
                        .split(/[,\s/]+/)
                        .map((cue) => cue.trim())
                        .filter((cue): cue is TurnCue => (TURN_CUES as readonly string[]).includes(cue)),
        ))

        const offerRaw = fields.get('o') ?? ''
        const offer = (TURN_OFFERS as readonly string[]).includes(offerRaw) ? offerRaw as TurnOffer : null
        return {
                v: TURN_SIGNAL_VERSION,
                mood,
                buy: buyRaw as TurnBuyLevel,
                answered: ANSWER_ALIASES[fields.get('a') ?? ''] ?? 'y',
                topic,
                cues,
                ...(offer ? { offer } : {}),
        }
}

/**
 * Split a raw model reply into the customer-visible text and the signal.
 * Every status line is removed wherever the model placed it; the last valid
 * one wins. A line truncated by the token limit is removed as well.
 */
export function extractTurnSignal(raw: string): { text: string; signal: TurnSignal | null } {
        if (!raw || !raw.includes('[')) return { text: raw, signal: null }
        let signal: TurnSignal | null = null
        let text = raw.replace(COMPLETE_TAG, (_match, body: string) => {
                signal = parseFields(body) ?? signal
                return ''
        })
        text = text.replace(TRAILING_PARTIAL_TAG, (match) => (/s\s*t|\[\[/i.test(match) ? '' : match))
        if (text === raw) return { text: raw, signal: null }
        return { text: text.replace(/[ \t]+\n/g, '\n').trimEnd(), signal }
}

/** Text that is safe to show while the model is still writing. */
export function visibleWhileStreaming(textSoFar: string): string {
        if (!textSoFar.includes('[')) return textSoFar
        return textSoFar
                .replace(COMPLETE_TAG, '')
                .replace(TRAILING_PARTIAL_TAG, '')
                .trimEnd()
}

/**
 * Delta filter for the streaming engine: emits everything except the status
 * line, holding back only the few characters that could still turn into one.
 */
export function createTurnSignalStreamFilter(): { push(delta: string): string } {
        let seen = ''
        let emitted = 0
        return {
                push(delta: string): string {
                        seen += delta
                        const visible = visibleWhileStreaming(seen).trimEnd()
                        // Trailing whitespace is withheld too: it usually precedes the
                        // status line, and the final `replace` event settles the text.
                        if (visible.length <= emitted) return ''
                        const out = visible.slice(emitted)
                        emitted = visible.length
                        return out
                },
        }
}

const normalizeForCues = (value: string) => value
        .normalize('NFKC')
        .toLowerCase()
        .replace(/[يى]/g, 'ی')
        .replace(/ك/g, 'ک')
        .replace(/[\u200c\u200d]/g, ' ')

const GRATITUDE = /ممنون|مرسی|تشکر|متشکر|سپاس|دمت(?:ون)? گرم|دست(?:ت|تون|تان)? درد نکن|لطف (?:کردی|دارید|داری)|\bthanks?\b|\bthank you\b|\bthx\b|\btnx\b|\bty\b|🙏/u
const PRAISE = /عالی|خیلی خوب|حرف نداره|حرف نداشت|فوق العاده|پسندیدم|راضی(?:م| هستم| بودم)|دوست داشتم|معرکه|\bgreat\b|\bperfect\b|\bawesome\b|\bexcellent\b|\blove it\b|😍|❤|👍|👌|🌹|💐/u

/** The customer literally thanked the business. */
export function saysThanks(text: string): boolean {
        return GRATITUDE.test(normalizeForCues(text))
}

/** The customer literally praised the product, the answer or the service. */
export function saysPraise(text: string): boolean {
        const normalized = normalizeForCues(text)
        return PRAISE.test(normalized) && !/ناراضی|راضی نیستم|راضی نبودم/.test(normalized)
}

/**
 * Asymmetric trust. Reply models lean optimistic about their own
 * conversations, so a positive reading only stands when the customer's words
 * support it; negative readings are kept as reported, because that is exactly
 * what a keyword list tends to miss.
 */
export function groundTurnSignal(signal: TurnSignal, customerMessage: string): TurnSignal {
        const thanked = saysThanks(customerMessage)
        const praised = saysPraise(customerMessage)
        const cues = signal.cues.filter((cue) =>
                cue === 'thanks' ? thanked : cue === 'praise' ? praised : true,
        )
        const mood: TurnMood = signal.mood === 'pos' && !thanked && !praised ? 'neu' : signal.mood
        if (mood === signal.mood && cues.length === signal.cues.length) return signal
        return { ...signal, mood, cues }
}

/** Read a stored signal back from `Message.metadata`. */
export function readTurnSignal(metadata: unknown): TurnSignal | null {
        if (!metadata || typeof metadata !== 'object') return null
        const raw = (metadata as Record<string, unknown>).turnSignal
        if (!raw || typeof raw !== 'object') return null
        const value = raw as Record<string, unknown>
        const mood = MOOD_ALIASES[String(value.mood ?? '')]
        const buy = Number(value.buy)
        if (!mood || !Number.isInteger(buy) || buy < 0 || buy > 3) return null
        const topic = String(value.topic ?? '')
        return {
                v: Number(value.v) || TURN_SIGNAL_VERSION,
                mood,
                buy: buy as TurnBuyLevel,
                answered: ANSWER_ALIASES[String(value.answered ?? '')] ?? 'y',
                topic: (TURN_TOPICS as readonly string[]).includes(topic) ? (topic as TurnTopic) : null,
                cues: Array.isArray(value.cues)
                        ? value.cues.filter((cue): cue is TurnCue => (TURN_CUES as readonly string[]).includes(String(cue)))
                        : [],
                ...((TURN_OFFERS as readonly string[]).includes(String(value.offer)) ? { offer: value.offer as TurnOffer } : {}),
        }
}

// ─ Scoring ────────────────────────────────────────────────────────────────

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const MOOD_BASE: Record<TurnMood, number> = { pos: 84, neu: 62, neg: 30, ang: 8 }

const CUE_EFFECT: Record<TurnCue, number> = {
        thanks: 8,
        praise: 12,
        repeat: -18,
        confused: -8,
        complaint: -22,
        // Wanting a person says where the customer wants to talk, not how they feel.
        human: 0,
        decline: 0,
        pricey: -3,
        distrust: -8,
}

/** Cues that say something about satisfaction (a decline or a price remark does not). */
const SATISFACTION_CUES = new Set<TurnCue>(['thanks', 'praise', 'repeat', 'confused', 'complaint', 'distrust'])

/** 0–100 reading of a single exchange. */
export function turnSatisfaction(signal: TurnSignal): number {
        let score = MOOD_BASE[signal.mood]
        for (const cue of signal.cues) score += CUE_EFFECT[cue]
        if (signal.answered === 'n') score -= 12
        else if (signal.answered === 'p') score -= 5
        else score += 4
        return Math.round(clamp(score, 0, 100))
}

/** A plain neutral question says little; a mood or a cue says a lot. */
function evidenceStrength(signal: TurnSignal): number {
        if (signal.mood !== 'neu') return 1
        if (signal.cues.some((cue) => SATISFACTION_CUES.has(cue))) return 1
        return signal.answered === 'y' ? 0.3 : 0.6
}

const SATISFACTION_WINDOW = 8
const SATISFACTION_DECAY = 0.72

/**
 * Conversation satisfaction from newest-first signals. Recency-weighted so
 * the way a conversation ends counts most (a resolved complaint reads as
 * resolved), and evidence-weighted so one clear «ممنون» is not drowned out by
 * several neutral questions.
 */
export function conversationSatisfaction(signalsNewestFirst: TurnSignal[]): number | null {
        const recent = signalsNewestFirst.slice(0, SATISFACTION_WINDOW)
        if (recent.length === 0) return null
        let total = 0
        let weightSum = 0
        for (const [age, signal] of recent.entries()) {
                const weight = SATISFACTION_DECAY ** age * evidenceStrength(signal)
                total += turnSatisfaction(signal) * weight
                weightSum += weight
        }
        return weightSum > 0 ? Math.round(total / weightSum) : null
}

/** The customer showed they are unhappy in this exchange (not merely asked for help). */
export function showsFriction(signal: Pick<TurnSignal, 'mood' | 'cues'>): boolean {
        return signal.mood === 'neg' || signal.mood === 'ang' || signal.cues.includes('complaint') || signal.cues.includes('repeat')
}

/**
 * What became of the customer's last sign of friction:
 *   none     — they never showed any;
 *   open     — nothing after it says it was dealt with;
 *   attended — a person answered afterwards, or the customer moved on to a
 *              request the reply fully resolved;
 *   resolved — the customer said so themselves (or thanked afterwards).
 */
export type FrictionOutcome = 'none' | 'open' | 'attended' | 'resolved'

/** Lowest score of a conversation whose friction was dealt with: neutral. */
export const ATTENDED_FLOOR = 55
export const RESOLVED_FLOOR = 62
export const THANKED_FLOOR = 72

/**
 * A score describes how the conversation stands now, so what happened after
 * the last complaint outranks the complaint: «ناراضی» is kept for customers
 * who showed friction that nobody has dealt with yet. Anger is only lifted by
 * the customer's own words.
 */
export function settleSatisfaction(
        score: number | null,
        outcome: { friction: FrictionOutcome; angry: boolean; thanked: boolean },
): number | null {
        if (score === null) return null
        if (outcome.friction === 'none') return Math.max(score, DISSATISFIED_BELOW)
        if (outcome.friction === 'resolved') return Math.max(score, outcome.thanked ? THANKED_FLOOR : RESOLVED_FLOOR)
        if (outcome.friction === 'attended' && !outcome.angry) return Math.max(score, ATTENDED_FLOOR)
        return score
}

export type SatisfactionBucket = 'satisfied' | 'neutral' | 'dissatisfied'

export const SATISFIED_FROM = 70
export const DISSATISFIED_BELOW = 45

export function satisfactionBucket(score: number): SatisfactionBucket {
        if (score >= SATISFIED_FROM) return 'satisfied'
        if (score < DISSATISFIED_BELOW) return 'dissatisfied'
        return 'neutral'
}

const BUY_LEVEL_PROBABILITY: Record<TurnBuyLevel, number> = { 0: 6, 1: 30, 2: 58, 3: 90 }
const BUY_WINDOW = 6
const BUY_DECAY = 0.88

export interface BuySignalReading {
        /** 0–100, before stage calibration. */
        probability: number
        /** Strongest buying level seen in the last few exchanges. */
        level: TurnBuyLevel
        /** The customer's latest message turned the purchase down. */
        declined: boolean
}

/** Buying intent from newest-first signals: the strongest recent level, fading with age. */
export function buySignalReading(signalsNewestFirst: TurnSignal[]): BuySignalReading | null {
        const recent = signalsNewestFirst.slice(0, BUY_WINDOW)
        if (recent.length === 0) return null
        let probability = 0
        for (const [age, signal] of recent.entries()) {
                probability = Math.max(probability, BUY_LEVEL_PROBABILITY[signal.buy] * BUY_DECAY ** age)
        }
        const level = Math.max(...recent.slice(0, 3).map((signal) => signal.buy)) as TurnBuyLevel
        const declined = recent[0].cues.includes('decline')
        return {
                probability: Math.round(declined ? Math.min(probability, 15) : probability),
                level: declined ? 0 : level,
                declined,
        }
}

/** Topics in the order the customer raised them most, strongest first. */
export function topicsFromSignals(signalsNewestFirst: TurnSignal[], limit = 3): TurnTopic[] {
        const counts = new Map<TurnTopic, number>()
        for (const signal of signalsNewestFirst) {
                if (!signal.topic || signal.topic === 'chat') continue
                counts.set(signal.topic, (counts.get(signal.topic) ?? 0) + 1)
        }
        return Array.from(counts.entries())
                .sort((left, right) => right[1] - left[1])
                .slice(0, limit)
                .map(([topic]) => topic)
}
