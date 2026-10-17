/**
 * The agent's built-in transfer lines. A leaf module: the handoff policy
 * sends them, and the handoff summary recognises them exactly (no pattern)
 * so the transfer line is never mistaken for the agent's last real answer.
 */
export const HANDOFF_REPLIES = {
        explicit: {
                en: 'Of course. I’ll transfer this conversation with a summary to a human specialist, so you won’t need to repeat the details.',
                fa: 'حتماً؛ گفتگو را همراه با خلاصه همین صحبت‌ها به یک کارشناس منتقل می‌کنم تا لازم نباشد اطلاعات را دوباره توضیح دهید.',
        },
        order: {
                en: 'I’ve passed your order details to a specialist who will follow up on this right away; you won’t need to repeat anything.',
                fa: 'جزئیات سفارشتون رو برای کارشناس پیگیری فرستادم؛ بدون نیاز به توضیح مجدد سریع پیگیری می‌کنه',
        },
        risk: {
                en: 'To have this handled carefully and promptly, I’m transferring the conversation with a complete summary to a human specialist now.',
                fa: 'برای اینکه موضوع شما دقیق‌تر و سریع‌تر پیگیری شود، همین حالا گفتگو را با خلاصه کامل به یک کارشناس منتقل می‌کنم.',
        },
        unanswered: {
                en: 'I’m sorry the earlier answers did not resolve this. I’ll transfer the conversation and its history to a specialist so you do not have to repeat yourself.',
                fa: 'متأسفم که پاسخ کافی نگرفتید. گفتگو و سابقه پاسخ‌ها را به یک کارشناس منتقل می‌کنم تا بدون تکرار توضیحات پیگیری شود.',
        },
        negotiation: {
                en: 'For an accurate review of pricing or custom terms, I’ll transfer the conversation and its details to the right specialist.',
                fa: 'برای بررسی دقیق قیمت یا شرایط اختصاصی، گفتگو را همراه با جزئیات به کارشناس مربوط منتقل می‌کنم.',
        },
        fallback: {
                en: 'For a more precise follow-up, I’ll connect you to a human specialist with a summary of this conversation.',
                fa: 'برای ادامه دقیق‌تر گفتگو، شما را همراه با خلاصه صحبت‌ها به یک کارشناس انسانی متصل می‌کنم.',
        },
} as const

export const BUILT_IN_HANDOFF_NOTICES: readonly string[] = Object.values(HANDOFF_REPLIES).flatMap((reply) => [reply.fa, reply.en])
