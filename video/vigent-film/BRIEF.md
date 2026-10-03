# Vigent feature film — brief and storyboard

## Brief

- **Business:** Vigent (vigent.ir), an AI agent for businesses. It answers customer messages on Instagram, Telegram, Bale, Rubika and the website from the business's own data, sells, books appointments and keeps every conversation in one CRM.
- **Buyer:** Iranian small and mid-size business owners (shops, restaurants, clinics, education, services) who handle customer messages by hand.
- **Viewer's problem:** messages arrive in many apps at all hours and nobody can answer them all.
- **Single action (CTA):** «شروع رایگان» at vigent.ir.
- **Length / format:** 45 s, 1920×1080, 60 fps, Persian (RTL). Every frame is code (HTML + GSAP); no AI footage.
- **Brand:** white surface, near-black `#111111`, purple accents `#5b3de8` / `#765ff2` / `#9685fb`, dark section `#070707`; typeface IRANSansWeb; the logo's four-point spark is the persistent actor.

### What is provably true (source: the live marketing copy in `components/marketing/site/home/*`)

| Claim in the film | Source |
|---|---|
| همهٔ برنامه‌ها، یک هوش مصنوعی · فروش، پشتیبانی و CRM در یک پنل | `hero.tsx` |
| Channels: Instagram DM and comments, Telegram, Bale, Rubika, site widget, chat link — one inbox | `capabilities.tsx` (inbox) |
| Checkout inside the chat; payment on the business's own site and gateway; order lands in WooCommerce | `capabilities.tsx` (sell) |
| Booking without conflicts; the team is notified | `capabilities.tsx` (book) |
| Learns from PDF, site URL, FAQ and catalog; unanswered questions go to the Learning Center and are learned on approval | `capabilities.tsx` (learn) |
| Instagram comment, DM, story automation; follow gate; fixed automations use no AI credit | `instagram.tsx`, `pricing.tsx` (noteA) |
| Understands Persian voice messages; replies in the customer's language | `capabilities.tsx` (voice, lang) |
| CRM record, hand-off to a human with a summary, Telegram manager bot with alerts, replies and a daily report | `capabilities.tsx` (crm, bot) |
| Tone, scope and hand-off rules are configurable; performance report | `capabilities.tsx` (ctrl, rep) |
| Pre-order and back-in-stock alert (named in the recap only) | `capabilities.tsx` (pre) |
| راه‌اندازی در ۷ دقیقه · بدون کدنویسی · شروع رایگان | `quick-facts.tsx`, `hero.tsx` |

### Must never be claimed

No testimonials, customer counts, conversion or satisfaction numbers. Names, messages, prices, the order number and the daily-report figures inside the UI are the same illustrative samples the website uses; a footnote says so on screen («نام‌ها و ارقام داخل صحنه‌ها نمایشی‌اند»). The report chart carries «نمودار نمونه» and shows no values.

## Mechanisms borrowed (from `references/motion-grammar.md`)

Wall → one actor (hook), foreground fly-through (title → inbox), selection → expansion (inbox row → chat, with the customer's message carried across), materializing result (cart shell fills, Learning Center card), request → picker → confirmation (booking), carousel emphasis (Instagram cards), a typographic beat on a colour-field takeover (the dark opens from the spark), one persistent actor (the spark) and one whip direction for every other cut.

## Three signature transformations

1. A wall of unanswered messages is pulled into the Vigent spark, which becomes the brand title.
2. The customer's row in the inbox opens into the chat where the sale happens; her message travels with it and becomes the first bubble.
3. The product card in the chat flies into the cart, the pay button turns into "paid", and the order number drops out of it.

## Storyboard (final cut, 45.0 s)

| # | Time (s) | What the viewer sees | Business job | Transition out (what survives) |
|---|---|---|---|---|
| A | 0.0–2.8 | Wall of customer messages from five apps around «این‌همه پیام، کی جواب می‌دهد؟» | Name the problem | Messages are pulled into the spark (spark survives) |
| B | 2.8–4.9 | Spark above «همهٔ برنامه‌ها، یک هوش مصنوعی», six channel icons | Say what Vigent is | Headline flies through the camera; the icons travel to the inbox rail |
| C | 4.9–8.0 | One inbox: six rows from six channels get answered | One inbox for every app | The selected row expands into the chat, carrying avatar, name and message |
| D | 8.0–13.5 | Chat → product card → cart → paid → WooCommerce order | Checkout inside the chat | Whip left; spark jumps |
| E | 13.5–17.7 | Week calendar: free slots found, 17:00 booked, team notified | Booking without conflicts | Whip left |
| F | 17.7–22.1 | Sources feed the Learning Center card; one approval and it is learned | Learns from your own data, with your approval | The dark opens as a circle from the spark |
| T | 22.1–23.5 | Type beat on dark: «دایرکت» · «کامنت» · «استوری» | Announce the Instagram section | Last word flies through the camera as the cards rise under it |
| G | 23.5–29.0 | Three Instagram cards (comment, DM follow gate, story mention) and «بدون کسر اعتبار» | Instagram automation, no credit used | The dark closes into the spark |
| H | 29.2–32.0 | Voice message becomes text; replies in Persian, English, Arabic | Voice and languages | Whip left |
| I | 32.0–36.2 | CRM record → the agent hands off → Telegram manager bot alert, reply, daily report | Sensitive cases reach a human | Whip left |
| J | 36.2–39.1 | Tone switch and three rule toggles pressed by the pointer; sample report chart | Control and reporting | Whip left |
| K | 39.1–42.0 | Twelve capability chips around the spark: «یک سیستم، نه چند ابزار پراکنده» | Recap | Chips collapse into the spark |
| L | 42.0–45.0 | Logo, tagline, «شروع رایگان», vigent.ir, «راه‌اندازی در ۷ دقیقه · بدون کدنویسی» | The one next action | The score fades out on its last hit |
