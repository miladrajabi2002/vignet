/**
 * The agent's built-in transfer lines. A leaf module: the handoff policy
 * sends them, and the handoff summary recognises them exactly (no pattern)
 * so the transfer line is never mistaken for the agent's last real answer.
 *
 * Each line says what really happened (the request went to a person), and
 * that the assistant stays in the chat until that person answers: the
 * conversation keeps an assistant in the waiting room (lib/agent/turn/waiting-room.ts).
 */
export const HANDOFF_REPLIES = {
        explicit: {
                en: 'Of course. I’ve sent your request with a summary of this chat to a colleague, so you won’t need to repeat anything. Until they reply, I’m still here for any question about products or terms.',
                fa: 'حتماً. درخواستتون رو همراه با خلاصهٔ همین گفتگو برای همکارم فرستادم تا لازم نباشه چیزی رو دوباره توضیح بدید. تا وقتی همکارم جواب بده، اگه سؤالی دربارهٔ محصول یا شرایط دارید، همین‌جا هستم.',
        },
        order: {
                en: 'I’m really sorry about this. I’ve sent your order details to a colleague to follow up right away; you won’t need to repeat anything. I’m still here until they reply.',
                fa: 'واقعاً متأسفم که این‌طور شده. جزئیات سفارشتون رو برای همکارم فرستادم تا سریع پیگیری کنه و لازم نباشه چیزی رو تکرار کنید. تا جواب همکارم همین‌جا هستم.',
        },
        risk: {
                en: 'I’m sorry this happened. I’ve sent the conversation with a full summary to a colleague so it is handled carefully. I’m still here until they reply.',
                fa: 'متأسفم که این پیش اومده. گفتگو رو با خلاصهٔ کامل برای همکارم فرستادم تا دقیق رسیدگی کنه. تا وقتی جواب بده همین‌جا هستم.',
        },
        unanswered: {
                en: 'I’m sorry the earlier answers did not resolve this. I’ve sent the conversation and its history to a colleague so you do not have to repeat yourself.',
                fa: 'متأسفم که جواب کافی نگرفتید. گفتگو و سابقهٔ جواب‌ها رو برای همکارم فرستادم تا بدون تکرار توضیحات پیگیری کنه.',
        },
        negotiation: {
                en: 'For pricing or custom terms, I’ve sent the conversation and its details to the right colleague. I’m still here for anything else meanwhile.',
                fa: 'برای قیمت یا شرایط اختصاصی، گفتگو رو با جزئیاتش برای همکار مربوط فرستادم. تا اون موقع اگه سؤال دیگه‌ای دارید همین‌جا هستم.',
        },
        fallback: {
                en: 'I’ve sent this conversation with a summary to a colleague for a closer look. I’m still here until they reply.',
                fa: 'این گفتگو رو با خلاصه‌اش برای همکارم فرستادم تا دقیق‌تر بررسی کنه. تا وقتی جواب بده همین‌جا هستم.',
        },
} as const

/** Lines sent before 2026-10-23; stored threads still carry them. */
const LEGACY_HANDOFF_NOTICES: readonly string[] = [
        'Of course. I’ll transfer this conversation with a summary to a human specialist, so you won’t need to repeat the details.',
        'حتماً؛ گفتگو را همراه با خلاصه همین صحبت‌ها به یک کارشناس منتقل می‌کنم تا لازم نباشد اطلاعات را دوباره توضیح دهید.',
        'I’ve passed your order details to a specialist who will follow up on this right away; you won’t need to repeat anything.',
        'جزئیات سفارشتون رو برای کارشناس پیگیری فرستادم؛ بدون نیاز به توضیح مجدد سریع پیگیری می‌کنه',
        'To have this handled carefully and promptly, I’m transferring the conversation with a complete summary to a human specialist now.',
        'برای اینکه موضوع شما دقیق‌تر و سریع‌تر پیگیری شود، همین حالا گفتگو را با خلاصه کامل به یک کارشناس منتقل می‌کنم.',
        'I’m sorry the earlier answers did not resolve this. I’ll transfer the conversation and its history to a specialist so you do not have to repeat yourself.',
        'متأسفم که پاسخ کافی نگرفتید. گفتگو و سابقه پاسخ‌ها را به یک کارشناس منتقل می‌کنم تا بدون تکرار توضیحات پیگیری شود.',
        'For an accurate review of pricing or custom terms, I’ll transfer the conversation and its details to the right specialist.',
        'برای بررسی دقیق قیمت یا شرایط اختصاصی، گفتگو را همراه با جزئیات به کارشناس مربوط منتقل می‌کنم.',
        'For a more precise follow-up, I’ll connect you to a human specialist with a summary of this conversation.',
        'برای ادامه دقیق‌تر گفتگو، شما را همراه با خلاصه صحبت‌ها به یک کارشناس انسانی متصل می‌کنم.',
]

export const BUILT_IN_HANDOFF_NOTICES: readonly string[] = [
        ...Object.values(HANDOFF_REPLIES).flatMap((reply) => [reply.fa, reply.en]),
        ...LEGACY_HANDOFF_NOTICES,
]
