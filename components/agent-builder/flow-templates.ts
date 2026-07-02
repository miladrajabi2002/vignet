import type { Node, Edge } from '@xyflow/react'

/**
 * Ready-to-use flow templates for the agent builder.
 *
 * Each template is a `{ nodes, edges }` pair that can be loaded directly into
 * React Flow. The user picks one when creating a new agent or via the
 * "load template" button on the builder canvas.
 */

export interface FlowTemplate {
        id: string
        nameFa: string
        nameEn: string
        descFa: string
        descEn: string
        nodes: Node[]
        edges: Edge[]
}

const POS = {
        start: { x: 80, y: 240 },
        welcome: { x: 340, y: 240 },
        branch: { x: 600, y: 240 },
        product: { x: 860, y: 120 },
        handoff: { x: 860, y: 360 },
        collect: { x: 860, y: 240 },
        aiResp: { x: 600, y: 240 },
        end: { x: 1120, y: 240 },
}

export const FLOW_TEMPLATES: FlowTemplate[] = [
        // ─────────────────────────────────────────────────────────────────────
        {
                id: 'product-support',
                nameFa: 'پشتیبانی محصول',
                nameEn: 'Product Support',
                descFa: 'خوش‌آمدگویی → تشخیص نوع مشتری → جستجوی محصول یا تحویل به اپراتور',
                descEn: 'Greet → detect customer type → product lookup or handoff',
                nodes: [
                        { id: 'start', type: 'start', position: POS.start, data: { label: 'شروع' } },
                        {
                                id: 'welcome',
                                type: 'message',
                                position: POS.welcome,
                                data: {
                                        label: 'خوش‌آمد',
                                        text: 'سلام! به پشتیبانی ما خوش آمدید. چطور می‌تونیم کمکتون کنیم؟',
                                },
                        },
                        {
                                id: 'branch',
                                type: 'condition',
                                position: POS.branch,
                                data: {
                                        label: 'مشتری محصول دارد؟',
                                        text: 'آیا کاربر قبلاً از ما خرید کرده یا در حال خرید است؟',
                                },
                        },
                        {
                                id: 'product',
                                type: 'product-lookup',
                                position: POS.product,
                                data: { label: 'جستجوی محصول', text: 'اطلاعات محصول را از کاتالوگ پیدا کن' },
                        },
                        {
                                id: 'handoff',
                                type: 'human-handoff',
                                position: POS.handoff,
                                data: {
                                        label: 'تحویل به اپراتور',
                                        text: 'کاربر جدید است یا مشکل پیچیده — به اپراتور انسانی تحویل بده',
                                },
                        },
                ],
                edges: [
                        { id: 'e1', source: 'start', target: 'welcome', animated: true },
                        { id: 'e2', source: 'welcome', target: 'branch', animated: true },
                        { id: 'e3', source: 'branch', target: 'product', label: 'بله', animated: true },
                        { id: 'e4', source: 'branch', target: 'handoff', label: 'خیر', animated: true },
                ],
        },

        // ─────────────────────────────────────────────────────────────────────
        {
                id: 'lead-capture',
                nameFa: 'جمع‌آوری لید',
                nameEn: 'Lead Capture',
                descFa: 'خوش‌آمد → جمع‌آوری نام و شماره → تشکر → تحویل به تیم فروش',
                descEn: 'Greet → collect name + phone → thank → handoff to sales',
                nodes: [
                        { id: 'start', type: 'start', position: POS.start, data: { label: 'شروع' } },
                        {
                                id: 'welcome',
                                type: 'message',
                                position: POS.welcome,
                                data: {
                                        label: 'خوش‌آمد',
                                        text: 'سلام! برای اینکه بتونیم بهتون پیشنهاد مناسب بدیم، یه چند تا سوال می‌پرسیم.',
                                },
                        },
                        {
                                id: 'collect',
                                type: 'collect-info',
                                position: POS.collect,
                                data: {
                                        label: 'نام و شماره',
                                        text: 'نام کامل و شماره تماس مشتری را جمع‌آوری کن',
                                },
                        },
                        {
                                id: 'thanks',
                                type: 'message',
                                position: POS.end,
                                data: {
                                        label: 'تشکر',
                                        text: 'ممنون از وقتتون! همکاران ما به‌زودی با شما تماس می‌گیرن.',
                                },
                        },
                        {
                                id: 'handoff',
                                type: 'human-handoff',
                                position: POS.handoff,
                                data: {
                                        label: 'تحویل به فروش',
                                        text: 'اطلاعات لید به تیم فروش ارسال شد',
                                },
                        },
                ],
                edges: [
                        { id: 'e1', source: 'start', target: 'welcome', animated: true },
                        { id: 'e2', source: 'welcome', target: 'collect', animated: true },
                        { id: 'e3', source: 'collect', target: 'thanks', animated: true },
                        { id: 'e4', source: 'thanks', target: 'handoff', animated: true },
                ],
        },

        // ─────────────────────────────────────────────────────────────────────
        {
                id: 'faq-knowledge',
                nameFa: 'سؤالات متداول',
                nameEn: 'FAQ Knowledge Base',
                descFa: 'سؤال کاربر → پاسخ از پایگاه دانش → بررسی رضایت → کامل یا جمع‌آوری اطلاعات',
                descEn: 'User question → answer from KB → check satisfaction → resolve or collect',
                nodes: [
                        { id: 'start', type: 'start', position: POS.start, data: { label: 'شروع' } },
                        {
                                id: 'ai',
                                type: 'ai-response',
                                position: POS.aiResp,
                                data: {
                                        label: 'پاسخ هوش مصنوعی',
                                        text: 'از پایگاه دانش (RAG) برای پاسخ به سؤال کاربر استفاده کن',
                                },
                        },
                        {
                                id: 'satisfaction',
                                type: 'condition',
                                position: POS.branch,
                                data: {
                                        label: 'کاربر راضی است؟',
                                        text: 'آیا پاسخ به سؤال کاربر کافی بود؟',
                                },
                        },
                        {
                                id: 'resolve',
                                type: 'message',
                                position: POS.product,
                                data: {
                                        label: 'تکمیل گفتگو',
                                        text: 'خوشحالم که تونستم کمکتون کنم! امتیاز بدید ممنون می‌شیم.',
                                },
                        },
                        {
                                id: 'collect',
                                type: 'collect-info',
                                position: POS.handoff,
                                data: {
                                        label: 'جمع‌آوری جزئیات',
                                        text: 'اگر پاسخ کافی نبود، جزئیات بیشتری بپرس',
                                },
                        },
                ],
                edges: [
                        { id: 'e1', source: 'start', target: 'ai', animated: true },
                        { id: 'e2', source: 'ai', target: 'satisfaction', animated: true },
                        {
                                id: 'e3',
                                source: 'satisfaction',
                                target: 'resolve',
                                label: 'بله',
                                animated: true,
                        },
                        {
                                id: 'e4',
                                source: 'satisfaction',
                                target: 'collect',
                                label: 'خیر',
                                animated: true,
                        },
                ],
        },
]

export function getTemplateById(id: string): FlowTemplate | undefined {
        return FLOW_TEMPLATES.find((t) => t.id === id)
}

// ─────────────────────────────────────────────────────────────────────
// ROLE-BASED FLOW TEMPLATES (F1)
//   Visual-builder graphs that match the 6-layer role templates. Each one is a
//   ready-made conversation flow the user can load into the canvas as a starting
//   point for the corresponding role.
// ─────────────────────────────────────────────────────────────────────
export const ROLE_FLOW_TEMPLATES: FlowTemplate[] = [
        {
                id: 'pre-sales-flow',
                nameFa: 'مسیر مشاور پیش‌فروش',
                nameEn: 'Pre-sales consultant flow',
                descFa: 'خوش‌آمد → شناسایی نیاز → معرفی محصول از کاتالوگ → هدایت به خرید یا اپراتور',
                descEn: 'Greet → identify need → recommend from catalog → lead to purchase or handoff',
                nodes: [
                        { id: 'start', type: 'start', position: POS.start, data: { label: 'شروع' } },
                        {
                                id: 'welcome',
                                type: 'message',
                                position: POS.welcome,
                                data: {
                                        label: 'خوش‌آمد + سؤال نیاز',
                                        text: 'سلام! به ما خوش آمدید. چه محصولی می‌خواهید و برای چه کاربردی؟',
                                },
                        },
                        {
                                id: 'need',
                                type: 'collect-info',
                                position: POS.collect,
                                data: {
                                        label: 'جمع‌آوری نیاز و بودجه',
                                        text: 'نیاز، بودجه و اولویت‌های مشتری را بپرس',
                                },
                        },
                        {
                                id: 'recommend',
                                type: 'product-lookup',
                                position: POS.product,
                                data: {
                                        label: 'پیشنهاد محصول از کاتالوگ',
                                        text: 'بر اساس نیاز، ۱ تا ۲ محصول از کاتالوگ پیشنهاد بده',
                                },
                        },
                        {
                                id: 'decide',
                                type: 'condition',
                                position: POS.branch,
                                data: {
                                        label: 'مشتری تصمیم گرفت؟',
                                        text: 'آیا مشتری آماده خرید است یا نیاز به اطلاعات بیشتر دارد؟',
                                },
                        },
                        {
                                id: 'close',
                                type: 'message',
                                position: POS.end,
                                data: {
                                        label: 'هدایت به خرید',
                                        text: 'لینک پرداخت یا راه تماس را بده و تشکر کن',
                                },
                        },
                        {
                                id: 'handoff',
                                type: 'human-handoff',
                                position: POS.handoff,
                                data: {
                                        label: 'تحویل به اپراتور',
                                        text: 'اگر مشتری نیاز به مشاوره انسانی داشت، منتقل کن',
                                },
                        },
                ],
                edges: [
                        { id: 'e1', source: 'start', target: 'welcome', animated: true },
                        { id: 'e2', source: 'welcome', target: 'need', animated: true },
                        { id: 'e3', source: 'need', target: 'recommend', animated: true },
                        { id: 'e4', source: 'recommend', target: 'decide', animated: true },
                        { id: 'e5', source: 'decide', target: 'close', label: 'بله', animated: true },
                        { id: 'e6', source: 'decide', target: 'handoff', label: 'خیر', animated: true },
                ],
        },
        {
                id: 'post-sale-flow',
                nameFa: 'مسیر پشتیبانی بعد از خرید',
                nameEn: 'Post-sale support flow',
                descFa: 'خوش‌آمد → شناسایی مشکل → راه‌حل گام‌به‌گام → رضایت یا تحویل به اپراتور',
                descEn: 'Greet → diagnose issue → step-by-step solution → satisfaction or handoff',
                nodes: [
                        { id: 'start', type: 'start', position: POS.start, data: { label: 'شروع' } },
                        {
                                id: 'welcome',
                                type: 'message',
                                position: POS.welcome,
                                data: {
                                        label: 'همدلی + شناسایی مشکل',
                                        text: 'سلام! متوجه هستم که مشکل دارید. دقیقاً چه اتفاقی افتاده؟',
                                },
                        },
                        {
                                id: 'diagnose',
                                type: 'collect-info',
                                position: POS.collect,
                                data: {
                                        label: 'جزئیات مشکل',
                                        text: 'گام‌های انجام‌شده، پیام خطا، شماره سفارش را بپرس',
                                },
                        },
                        {
                                id: 'solution',
                                type: 'ai-response',
                                position: POS.aiResp,
                                data: {
                                        label: 'راه‌حل گام‌به‌گام',
                                        text: 'از پایگاه دانش راه‌حل گام‌به‌گام و روشن بده',
                                },
                        },
                        {
                                id: 'satisfaction',
                                type: 'condition',
                                position: POS.branch,
                                data: {
                                        label: 'مشکل حل شد؟',
                                        text: 'آیا راه‌حل کار کرد؟',
                                },
                        },
                        {
                                id: 'resolve',
                                type: 'message',
                                position: POS.product,
                                data: {
                                        label: 'تکمیل و رضایت‌سنجی',
                                        text: 'خوشحالم که حل شد. لطفاً امتیاز بدهید.',
                                },
                        },
                        {
                                id: 'handoff',
                                type: 'human-handoff',
                                position: POS.handoff,
                                data: {
                                        label: 'تحویل به متخصص',
                                        text: 'اگر حل نشد، به اپراتور متخصص منتقل کن',
                                },
                        },
                ],
                edges: [
                        { id: 'e1', source: 'start', target: 'welcome', animated: true },
                        { id: 'e2', source: 'welcome', target: 'diagnose', animated: true },
                        { id: 'e3', source: 'diagnose', target: 'solution', animated: true },
                        { id: 'e4', source: 'solution', target: 'satisfaction', animated: true },
                        { id: 'e5', source: 'satisfaction', target: 'resolve', label: 'بله', animated: true },
                        { id: 'e6', source: 'satisfaction', target: 'handoff', label: 'خیر', animated: true },
                ],
        },
        {
                id: 'follow-up-flow',
                nameFa: 'مسیر پیگیری سفارش',
                nameEn: 'Order follow-up flow',
                descFa: 'خوش‌آمد → دریافت شماره سفارش → بررسی وضعیت از پایگاه دانش → پاسخ یا اپراتور',
                descEn: 'Greet → get order number → check status from knowledge → answer or handoff',
                nodes: [
                        { id: 'start', type: 'start', position: POS.start, data: { label: 'شروع' } },
                        {
                                id: 'welcome',
                                type: 'message',
                                position: POS.welcome,
                                data: {
                                        label: 'خوش‌آمد + درخواست شماره سفارش',
                                        text: 'سلام! شماره سفارشتان را بفرستید تا وضعیت را چک کنم.',
                                },
                        },
                        {
                                id: 'lookup',
                                type: 'product-lookup',
                                position: POS.product,
                                data: {
                                        label: 'بررسی سفارش',
                                        text: 'وضعیت سفارش را از پایگاه دانش / سفارش‌ها چک کن',
                                },
                        },
                        {
                                id: 'answer',
                                type: 'ai-response',
                                position: POS.aiResp,
                                data: {
                                        label: 'پاسخ وضعیت',
                                        text: 'وضعیت فعلی + تخمین زمان تحویل را بگو',
                                },
                        },
                        {
                                id: 'handoff',
                                type: 'human-handoff',
                                position: POS.handoff,
                                data: {
                                        label: 'تحویل به پیگیری',
                                        text: 'اگر سفارش پیدا نشد یا مشکلی بود، به اپراتور منتقل کن',
                                },
                        },
                ],
                edges: [
                        { id: 'e1', source: 'start', target: 'welcome', animated: true },
                        { id: 'e2', source: 'welcome', target: 'lookup', animated: true },
                        { id: 'e3', source: 'lookup', target: 'answer', animated: true },
                        { id: 'e4', source: 'answer', target: 'handoff', label: 'نیاز به انسان', animated: true },
                ],
        },
]

export function getRoleFlowTemplate(id: string): FlowTemplate | undefined {
        return ROLE_FLOW_TEMPLATES.find((t) => t.id === id)
}
