/* Vigent Web Widget loader — embed with:
   <script src="https://your-domain/widget/loader.js" data-agent-id="AGENT_ID"></script>
   Zero dependencies. Themeable from the dashboard (color, light/dark, position,
   font, icon, subtitle, corners, header style, quick replies, lead capture).
   Renders rich product cards from [[product:{…}]] tokens in the AI reply. */
;(function () {
        'use strict'

        var script = document.currentScript
        if (!script) return
        var agentId = script.getAttribute('data-agent-id')
        if (!agentId) {
                console.error('[vigent] missing data-agent-id')
                return
        }
        if (window.__vigentWidgetLoaded) return
        window.__vigentWidgetLoaded = true

        var base = script.getAttribute('data-base-url') || new URL(script.src).origin

        // ---- Ensure a proper mobile viewport. Many host sites omit the
        //      <meta name="viewport"> tag, which makes phones render at a
        //      virtual 980px width and breaks our mobile breakpoint. Without
        //      this, the @media (max-width:768px) rule never matches and the
        //      widget appears as a tiny desktop-style popup on phones. ----
        ;(function ensureViewport() {
                var needed = 'width=device-width, initial-scale=1, viewport-fit=cover'
                var existing = document.querySelector('meta[name="viewport"]')
                if (existing) {
                        // Patch only if the existing tag doesn't already opt into
                        // device-width (e.g. a legacy "width=980" tag).
                        if (!/width\s*=\s*device-width/i.test(existing.content)) {
                                existing.setAttribute('content', needed)
                        }
                } else {
                        var meta = document.createElement('meta')
                        meta.setAttribute('name', 'viewport')
                        meta.setAttribute('content', needed)
                        var head = document.head || document.getElementsByTagName('head')[0]
                        if (head) head.appendChild(meta)
                }
        })()

        // ---- Persisted conversation id — survives page refresh so visitors don't
        //      get a brand-new empty thread on every navigation/refresh. ----
        var CONV_STORAGE_KEY = 'vgt:c:' + agentId
        function loadStoredConv() {
                try {
                        var raw = localStorage.getItem(CONV_STORAGE_KEY)
                        if (!raw) return null
                        // Validate cuid-ish shape, max age 7d.
                        var parsed = JSON.parse(raw)
                        if (!parsed || typeof parsed.id !== 'string') return null
                        var ageMs = Date.now() - (parsed.ts || 0)
                        if (ageMs > 7 * 24 * 60 * 60 * 1000) {
                                localStorage.removeItem(CONV_STORAGE_KEY)
                                return null
                        }
                        return { id: parsed.id, token: typeof parsed.token === 'string' ? parsed.token : null }
                } catch (e) {
                        return null
                }
        }
        function saveStoredConv(id, token) {
                try {
                        localStorage.setItem(CONV_STORAGE_KEY, JSON.stringify({ id: id, token: token, ts: Date.now() }))
                } catch (e) {
                        /* localStorage may be unavailable (private mode); fail silently */
                }
        }

        var storedConversation = loadStoredConv()
        var conversationId = storedConversation && storedConversation.id
        var conversationToken = storedConversation && storedConversation.token
        var isOpen = false
        // Operator-message polling timer. Started when the panel opens,
        // cleared when it closes. Polls GET history for new messages from
        // the dashboard operator (no WebSocket in this app).
        var pollTimer = null
        var streaming = false
        var introVisible = false
        var teaserShown = false
        var welcomeShown = false
        var leadCaptured = false
        var historyLoaded = false
        // Identity from the pre-chat lead form; sent with the first message.
        var visitorName = null
        var visitorPhone = null
        var visitorSent = false
        var config = {
                name: 'Vigent',
                welcomeMessage: '',
                language: 'fa',
                theme: 'light',
                primaryColor: '#0F0F10',
                position: 'right',
                launcherLabel: null,
                avatar: null,
                font: 'vazirmatn',
                icon: 'chat',
                subtitle: null,
                headerStyle: 'gradient',
                quickReplies: [],
                corners: 'soft',
                cornerRadius: 0,
                autoGreet: false,
                autoGreetDelayMs: 4000,
                leadCapture: false,
                leadCaptureRequired: false,
                leadCaptureMessage: null,
        }

        function isRtl() {
                return config.language === 'fa'
        }
        // Single source of truth for the mobile breakpoint. MUST stay in sync
        // with the @media (max-width:768px) rule in injectStyles(). matchMedia
        // keeps JS and CSS agreeing even at exactly 768px (the old
        // `innerWidth < 768` check disagreed with the CSS at that width).
        function isMobile() {
                return window.matchMedia
                        ? window.matchMedia('(max-width: 768px)').matches
                        : window.innerWidth <= 768
        }
        function t(fa, en) {
                return isRtl() ? fa : en
        }

        // Convert Persian (۰-۹) and Arabic (٠-٩) digits to ASCII 0-9.
        // Vanilla-JS mirror of lib/phone.ts#toEnglishDigits — the lead-form
        // phone input runs this live so the submit gate (which counts \d) does
        // not reject Persian-digit phone numbers.
        function toEnglishDigits(input) {
                var PERSIAN = '۰۱۲۳۴۵۶۷۸۹'
                var ARABIC = '٠١٢٣٤٥٦٧٨٩'
                return String(input).replace(/[۰-۹٠-٩]/g, function (d) {
                        var p = PERSIAN.indexOf(d)
                        if (p > -1) return String(p)
                        var a = ARABIC.indexOf(d)
                        if (a > -1) return String(a)
                        return d
                })
        }

        // ---- Color helpers ----
        function rgb(hex) {
                var h = (hex || '#000').replace('#', '')
                if (h.length === 3)
                        h = h
                                .split('')
                                .map(function (x) {
                                        return x + x
                                })
                                .join('')
                return {
                        r: parseInt(h.slice(0, 2), 16) || 0,
                        g: parseInt(h.slice(2, 4), 16) || 0,
                        b: parseInt(h.slice(4, 6), 16) || 0,
                }
        }
        function contrast(hex) {
                var c = rgb(hex)
                return (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255 > 0.6 ? '#000000' : '#ffffff'
        }
        function soft(hex, a) {
                var c = rgb(hex)
                return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')'
        }
        /** Shift a hex color toward black (pct<0) or white (pct>0). pct in [-1,1]. */
        function shade(hex, pct) {
                var c = rgb(hex)
                var target = pct < 0 ? 0 : 255
                var p = Math.abs(pct)
                function mix(v) {
                        return Math.round(v + (target - v) * p)
                }
                return 'rgb(' + mix(c.r) + ',' + mix(c.g) + ',' + mix(c.b) + ')'
        }

        // ---- Icons ----
        var ICONS = {
                chat: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
                bot: '<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>',
                headset:
                        '<path d="M3 11h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H4a1 1 0 0 1-1-1v-5a9 9 0 0 1 18 0v5a1 1 0 0 1-1 1h-2a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/><path d="M21 16v2a4 4 0 0 1-4 4h-5"/>',
                sparkles:
                        '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .962 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.962 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/>',
                bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
                help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
                close: '<path d="M18 6 6 18M6 6l12 12"/>',
                send: '<path fill="currentColor" stroke="none" d="M3.4 20.4 21 12 3.4 3.6 3 10l12 2-12 2z"/>',
                // Refined send icon: a clean, modern paper-plane — more balanced
                // than the raw Telegram glyph and more polished than the Lucide
                // outline. Single solid path, reads crisply at 16-24px, points
                // up-right (the natural "send" direction).
                telegramSend:
                        '<path fill="currentColor" stroke="none" d="M22 3 2.6 11.2c-.7.3-.6 1.3.1 1.5l4.5 1.4 1.7 5.2c.2.6 1 .8 1.5.3l2.3-2.1 4.4 3.2c.5.4 1.3.1 1.4-.6L23 4c.2-.8-.5-1.4-1-1z"/>',
                phone:
                        '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
                box: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
                arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
        }
        function svg(name, extraClass) {
                return (
                        '<svg class="' +
                        (extraClass || '') +
                        '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
                        'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                        (ICONS[name] || ICONS.chat) +
                        '</svg>'
                )
        }
        function iconKey() {
                return ICONS[config.icon] ? config.icon : 'chat'
        }

        function el(tag, cls, html) {
                var n = document.createElement(tag)
                if (cls) n.className = cls
                if (html != null) n.innerHTML = html
                return n
        }

        // ---- Fonts ----
        var FONT_LINKS = {
                vazirmatn:
                        'https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css',
                samim: 'https://cdn.jsdelivr.net/gh/rastikerdar/samim-font@v4.0.5/dist/font-face.css',
                yekan:
                        'https://cdn.jsdelivr.net/gh/rastikerdar/vazir-font@v30.1.0/dist/font-face.css',
        }
        var FONT_FAMILY = {
                vazirmatn:
                        "'Vazirmatn',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,system-ui,sans-serif",
                samim:
                        "'Samim',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,system-ui,sans-serif",
                yekan:
                        "'Vazir',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,system-ui,sans-serif",
                inherit: 'inherit',
        }
        function injectFont() {
                if (config.font === 'inherit' || document.getElementById('vgt-font')) return
                var link = document.createElement('link')
                link.id = 'vgt-font'
                link.rel = 'stylesheet'
                var href = FONT_LINKS[config.font] || FONT_LINKS.vazirmatn
                link.href = href
                document.head.appendChild(link)
        }

        // ---- Stylesheet ----
        function injectStyles() {
                if (document.getElementById('vgt-styles')) return
                var css =
                        // Use env(safe-area-inset-*) so the launcher clears the
                        // iPhone home indicator and notches on rotated devices.
                        '.vgt-root{position:fixed;bottom:max(16px,env(safe-area-inset-bottom));z-index:2147483000;direction:ltr;visibility:hidden;opacity:0;' +
                        'transition:opacity var(--vgt-motion-surface) ease;font-family:var(--vgt-font);font-size:14px;}' +
                        '.vgt-root.vgt-ready{visibility:visible;opacity:1;}' +
                        '.vgt-root.vgt-right{inset-inline-end:max(20px,env(safe-area-inset-right));}' +
                        '.vgt-root.vgt-left{inset-inline-start:max(20px,env(safe-area-inset-left));}' +
                        '.vgt-root *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}' +
                        // touch-action:manipulation removes the legacy 300ms tap delay and
                        // accidental double-tap zoom on every widget button (mobile).
                        '.vgt-root button,.vgt-root textarea,.vgt-root input{touch-action:manipulation;}' +
                        // launcher
                        '.vgt-launcher{position:relative;display:flex;align-items:center;gap:8px;height:58px;padding:0 7px;border:none;cursor:pointer;' +
                        'border-radius:30px;background:linear-gradient(135deg,var(--vgt-accent) 0%,var(--vgt-accent-deep) 100%);' +
                        'color:var(--vgt-on-accent);box-shadow:0 12px 32px -8px var(--vgt-accent-shadow),inset 0 1px 0 rgba(255,255,255,.14);' +
                        'font-family:var(--vgt-font);' +
                        'transition:transform var(--vgt-motion-control) var(--vgt-ease),box-shadow var(--vgt-motion-control) var(--vgt-ease);}' +
                        '.vgt-launcher:hover{transform:translateY(-2px) scale(1.03);box-shadow:0 18px 42px -10px var(--vgt-accent-shadow),inset 0 1px 0 rgba(255,255,255,.14);}' +
                        '.vgt-launcher:active{transform:scale(.95);}' +
                        '.vgt-launcher-ico{width:44px;height:44px;flex:0 0 44px;display:flex;align-items:center;justify-content:center;position:relative;}' +
                        '.vgt-launcher-ico svg{width:25px;height:25px;position:absolute;transition:transform .35s cubic-bezier(.34,1.5,.64,1),opacity .25s ease;}' +
                        '.vgt-launcher:not(.vgt-open) .vgt-l-close{transform:rotate(-90deg) scale(.5);opacity:0;}' +
                        '.vgt-launcher.vgt-open .vgt-l-main{transform:rotate(90deg) scale(.5);opacity:0;}' +
                        '.vgt-launcher-label{font-family:var(--vgt-font);font-size:14px;font-weight:600;padding-inline-end:12px;white-space:nowrap;letter-spacing:0;}' +
                        // launcher ping (online presence)
                        '.vgt-launcher:not(.vgt-open)::after{content:"";position:absolute;top:6px;' +
                        'inset-inline-end:6px;width:10px;height:10px;border-radius:50%;background:#22c55e;' +
                        'border:2px solid var(--vgt-accent);box-shadow:0 0 0 0 rgba(34,197,94,.55);' +
                        'animation:vgt-ping 2.4s cubic-bezier(.66,0,.34,1) infinite;}' +
                        // panel — 100dvh avoids the iOS Safari URL-bar jump that 100vh causes;
                        // box-sizing:border-box so padding/border don't blow out the height.
                        '.vgt-panel{position:absolute;bottom:74px;width:392px;max-width:calc(100vw - 32px);height:620px;' +
                        'max-height:calc(100dvh - 96px);box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden;border-radius:var(--vgt-r-panel);' +
                        'background:var(--vgt-bg);color:var(--vgt-text);border:1px solid var(--vgt-border);' +
                        'box-shadow:0 24px 64px -28px rgba(0,0,0,.38),0 8px 20px -14px rgba(0,0,0,.22),0 0 0 1px rgba(0,0,0,.02);' +
                        'opacity:0;transform:translateY(14px) scale(.97);transform-origin:bottom right;pointer-events:none;' +
                        'transition:opacity var(--vgt-motion-surface) ease,transform var(--vgt-motion-surface) var(--vgt-ease);}' +
                        '.vgt-root.vgt-left .vgt-panel{transform-origin:bottom left;right:auto;left:0;}' +
                        '.vgt-root.vgt-right .vgt-panel{right:0;}' +
                        '.vgt-panel.vgt-show{opacity:1;transform:translateY(0) scale(1);pointer-events:auto;}' +
                        // header (flat)
                        '.vgt-head{position:relative;display:flex;align-items:center;gap:12px;padding:15px 16px;background:var(--vgt-head-bg);' +
                        'border-bottom:1px solid var(--vgt-border);}' +
                        '.vgt-ava{position:relative;width:42px;height:42px;flex:0 0 42px;border-radius:14px;display:flex;align-items:center;' +
                        'justify-content:center;background:var(--vgt-accent-soft);color:var(--vgt-accent);overflow:visible;}' +
                        '.vgt-ava img{width:100%;height:100%;object-fit:cover;border-radius:14px;}' +
                        '.vgt-ava svg{width:22px;height:22px;}' +
                        '.vgt-ava-dot{position:absolute;bottom:-2px;inset-inline-end:-2px;width:11px;height:11px;border-radius:50%;' +
                        'background:#22c55e;border:2px solid var(--vgt-head-bg);box-shadow:0 0 0 2px rgba(34,197,94,.3);' +
                        'animation:vgt-pulse 2.4s ease-in-out infinite;}' +
                        '.vgt-head-meta{flex:1;min-width:0;}' +
                        '.vgt-head-title{font-weight:700;font-size:15px;line-height:1.25;color:var(--vgt-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
                        '.vgt-head-sub{font-size:12.5px;color:var(--vgt-muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
                        // ≥44px touch target (Apple HIG). display:flex already set.
                        '.vgt-close{background:transparent;border:none;color:var(--vgt-muted);cursor:pointer;padding:7px;border-radius:10px;' +
                        'min-width:44px;min-height:44px;display:flex;align-items:center;justify-content:center;transition:background .15s,color .15s;}' +
                        '.vgt-close:hover{background:var(--vgt-surface);color:var(--vgt-text);}' +
                        '.vgt-close svg{width:18px;height:18px;}' +
                        // header (gradient / branded)
                        '.vgt-head.vgt-head-grad{background:linear-gradient(135deg,var(--vgt-accent) 0%,var(--vgt-accent-deep) 100%);border-bottom:none;}' +
                        '.vgt-head.vgt-head-grad::after{content:"";position:absolute;inset:0;pointer-events:none;' +
                        'background:radial-gradient(120% 140% at 85% -20%,rgba(255,255,255,.22),transparent 55%);}' +
                        '.vgt-head.vgt-head-grad .vgt-head-title{color:var(--vgt-on-accent);}' +
                        '.vgt-head.vgt-head-grad .vgt-head-sub{color:var(--vgt-on-accent);opacity:.72;}' +
                        '.vgt-head.vgt-head-grad .vgt-ava{background:rgba(255,255,255,.16);color:var(--vgt-on-accent);' +
                        'box-shadow:inset 0 0 0 1px rgba(255,255,255,.22);}' +
                        '.vgt-head.vgt-head-grad .vgt-ava-dot{border-color:var(--vgt-accent);}' +
                        '.vgt-head.vgt-head-grad .vgt-close{color:var(--vgt-on-accent);opacity:.75;z-index:1;}' +
                        '.vgt-head.vgt-head-grad .vgt-close:hover{background:rgba(255,255,255,.15);opacity:1;}' +
                        // body
                        '.vgt-body{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;scroll-behavior:smooth;background:var(--vgt-bg);' +
                        // Contain scroll so reaching the top/bottom of the thread never
                        // scroll-chains into the host page (iOS rubber-band / Android glow).
                        'overscroll-behavior:contain;-webkit-overflow-scrolling:touch;' +
                        // Force LTR on the messages container so align-self:flex-end (user)
                        // = RIGHT and align-self:flex-start (bot) = LEFT — matching the
                        // chat link page and Telegram/WhatsApp Persian convention. The
                        // panel keeps dir="rtl" for header/footer; bubble text uses
                        // unicode-bidi:plaintext (below) to auto-detect Persian RTL.
                        'direction:ltr;}' +
                        '.vgt-body::-webkit-scrollbar{width:6px;}' +
                        '.vgt-body::-webkit-scrollbar-thumb{background:var(--vgt-border);border-radius:3px;}' +
                        // word-break:keep-all prevents mid-word breaks for Persian/Arabic
                        // (cursive) text — without it, "سلام" can break into "سلا" + "م".
                        // overflow-wrap:normal (NOT break-word) ensures words never break
                        // mid-character even when the bubble is 1px too narrow (a common
                        // subpixel rounding issue). The trade-off: extremely long
                        // unbreakable strings (URLs) may overflow, but that's far better
                        // than breaking Persian words. Text still wraps at spaces via
                        // white-space:pre-wrap.
                        // ── Bubble base — optimized to match the chat link page ──
                        // Matches: px-4 py-2.5 text-[15px] leading-7 (Tailwind)
                        // = padding 10px 16px, font-size 15px, line-height 1.75
                        '.vgt-msg{max-width:84%;padding:10px 16px;font-size:15px;line-height:1.75;white-space:pre-wrap;overflow-wrap:normal;word-break:keep-all;' +
                        // unicode-bidi:plaintext = CSS dir="auto". Each paragraph's
                        // direction is auto-detected from its first strong character,
                        // so Persian renders RTL (right-aligned) and English LTR inside
                        // the LTR-positioned bubble container.
                        'unicode-bidi:plaintext;text-align:start;' +
                        'border-radius:var(--vgt-r-bubble);animation:vgt-in .28s cubic-bezier(.2,.7,.3,1) both;}' +
                        // User bubble: solid accent, 6px tail (rounded-br-md), subtle shadow.
                        '.vgt-msg.vgt-user{align-self:flex-end;background:var(--vgt-accent);' +
                        'color:var(--vgt-on-accent);border-bottom-right-radius:6px;box-shadow:0 1px 3px 0 rgba(0,0,0,.08);}' +
                        // Bot bubble: white bg (light theme) with subtle border + shadow,
                        // matching the chat link's clean bg-white border-black/[0.07] shadow-sm.
                        '.vgt-msg.vgt-bot{align-self:flex-start;background:var(--vgt-bg);color:var(--vgt-text);' +
                        'border:1px solid var(--vgt-border);border-bottom-left-radius:6px;box-shadow:0 1px 3px 0 rgba(0,0,0,.05);}' +
                        '.vgt-msg.vgt-err{background:rgba(239,68,68,.12);color:#ef4444;border:1px solid rgba(239,68,68,.3);align-self:stretch;max-width:100%;text-align:center;font-size:13px;}' +
                        // assistant group (chip + bubble + cards + actions)
                        // width:fit-content + max-width:100% lets the group size to content
                        // (same fix as .vgt-bubble-wrap — prevents mid-word breaks).
                        '.vgt-group{display:flex;flex-direction:column;align-items:flex-start;gap:7px;max-width:100%;width:fit-content;}' +
                        '.vgt-group.vgt-has-cards{width:100%;}' +
                        '.vgt-group .vgt-msg{animation:none;max-width:84%;}' +
                        '.vgt-group:empty{display:none;}' +
                        // source chip ("از کاتالوگ محصول")
                        '.vgt-source{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;' +
                        'border:1px solid var(--vgt-border);background:var(--vgt-bg);color:var(--vgt-muted);font-size:11px;font-weight:600;' +
                        'animation:vgt-in .3s ease both;}' +
                        '.vgt-source svg{width:12px;height:12px;}' +
                        // product card
                        '.vgt-card-rail{display:flex;gap:12px;width:min(660px,calc(100vw - 88px));max-width:100%;overflow-x:auto;' +
                        'padding:2px 2px 10px;scroll-snap-type:x mandatory;scrollbar-width:thin;scrollbar-color:rgba(0,0,0,.16) transparent;overscroll-behavior-inline:contain;}' +
                        '.vgt-card{width:min(250px,78vw);flex:0 0 min(250px,78vw);display:flex;flex-direction:column;overflow:hidden;scroll-snap-align:start;border-radius:var(--vgt-r-bubble);border:1px solid var(--vgt-border);' +
                        'background:var(--vgt-bg);box-shadow:0 12px 32px -20px rgba(0,0,0,.34);animation:vgt-card-in .4s cubic-bezier(.2,.8,.3,1) both;' +
                        'transition:transform .2s ease,box-shadow .2s ease;}' +
                        '.vgt-card:hover{transform:translateY(-2px);box-shadow:0 16px 36px -14px rgba(0,0,0,.3);}' +
                        '.vgt-card-image{display:block;width:100%;height:156px;object-fit:cover;background:var(--vgt-surface);}' +
                        '.vgt-card-placeholder{display:flex;align-items:center;justify-content:center;color:var(--vgt-muted);}' +
                        '.vgt-card-placeholder svg{width:30px;height:30px;opacity:.5;}' +
                        '.vgt-card-row{display:flex;align-items:flex-start;gap:12px;padding:14px 14px 10px;}' +
                        '.vgt-card-thumb{width:58px;height:58px;flex:0 0 58px;display:flex;align-items:center;justify-content:center;' +
                        'border-radius:14px;background:linear-gradient(135deg,var(--vgt-accent) 0%,var(--vgt-accent-deep) 100%);' +
                        'color:var(--vgt-on-accent);font-size:24px;font-weight:700;box-shadow:0 6px 16px -6px var(--vgt-accent-shadow);}' +
                        '.vgt-card-main{display:flex;flex:1;min-width:0;flex-direction:column;}' +
                        '.vgt-card-top{display:flex;align-items:flex-start;gap:6px;min-width:0;}' +
                        '.vgt-card-name{display:-webkit-box;font-size:13.5px;font-weight:750;line-height:1.55;color:var(--vgt-text);overflow:hidden;-webkit-line-clamp:2;-webkit-box-orient:vertical;}' +
                        '.vgt-card-badge{flex:0 0 auto;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:600;' +
                        'color:var(--vgt-accent-ink);background:var(--vgt-accent-soft);border:1px solid var(--vgt-accent-line);}' +
                        '.vgt-card-desc{display:-webkit-box;margin-top:5px;font-size:11.5px;line-height:1.75;color:var(--vgt-muted);overflow:hidden;-webkit-line-clamp:3;-webkit-box-orient:vertical;}' +
                        '.vgt-card-specs{display:flex;flex-wrap:wrap;gap:4px;margin-top:7px;}' +
                        '.vgt-card-spec{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:3px 7px;border-radius:6px;background:var(--vgt-surface);color:var(--vgt-muted);font-size:10px;}' +
                        '.vgt-card-price{margin-top:8px;font-size:14px;font-weight:800;color:var(--vgt-text);font-variant-numeric:tabular-nums;}' +
                        '.vgt-card-link{display:flex;align-items:center;justify-content:center;min-height:44px;margin:auto 14px 14px;border-radius:12px;' +
                        'background:var(--vgt-accent);color:var(--vgt-on-accent);font-size:12px;font-weight:700;text-decoration:none;' +
                        'transition:opacity .18s,transform .15s;}' +
                        '.vgt-card-no-link{display:flex;align-items:center;min-height:44px;margin:auto 14px 10px;color:var(--vgt-muted);font-size:11px;}' +
                        '.vgt-card-link:hover{opacity:.9;transform:translateY(-1px);}' +
                        '.vgt-card-link:focus-visible{outline:2px solid var(--vgt-accent);outline-offset:2px;}' +
                        // action chips under a bot reply — ≥44px touch height (11px*2 + ~22px line)
                        '.vgt-actions{display:flex;flex-wrap:wrap;gap:7px;animation:vgt-in .35s .1s ease both;}' +
                        '.vgt-action{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--vgt-border);cursor:pointer;' +
                        'background:var(--vgt-bg);color:var(--vgt-text);border-radius:999px;padding:11px 16px;font-family:inherit;' +
                        'font-size:12px;font-weight:600;transition:border-color .18s,background .18s,transform .15s;}' +
                        '.vgt-action:hover{border-color:var(--vgt-accent);color:var(--vgt-accent-ink);background:var(--vgt-accent-soft);transform:translateY(-1px);}' +
                        '.vgt-action svg{width:12px;height:12px;}' +
                        '.vgt-root.vgt-rtl .vgt-action svg{transform:scaleX(-1);}' +
                        // intro
                        '.vgt-intro{display:flex;flex-direction:column;align-items:center;text-align:center;gap:14px;margin:auto;padding:24px 12px;animation:vgt-in .35s ease both;}' +
                        '.vgt-intro-ava{width:64px;height:64px;border-radius:20px;display:flex;align-items:center;justify-content:center;' +
                        'background:linear-gradient(135deg,var(--vgt-accent-soft) 0%,transparent 140%);color:var(--vgt-accent);' +
                        'box-shadow:inset 0 0 0 1px var(--vgt-accent-line);}' +
                        '.vgt-intro-ava svg{width:32px;height:32px;}' +
                        '.vgt-intro-text{font-size:15.5px;font-weight:500;line-height:1.6;color:var(--vgt-text);max-width:290px;}' +
                        // quick replies
                        '.vgt-qr{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;max-width:300px;}' +
                        '.vgt-qr .vgt-action{animation:vgt-in .35s ease both;}' +
                        '.vgt-qr .vgt-action:nth-child(2){animation-delay:.06s;}' +
                        '.vgt-qr .vgt-action:nth-child(3){animation-delay:.12s;}' +
                        '.vgt-qr .vgt-action:nth-child(4){animation-delay:.18s;}' +
                        // lead capture
                        '.vgt-lead{display:flex;flex-direction:column;align-items:center;text-align:center;gap:14px;margin:auto;padding:24px 18px;animation:vgt-in .35s ease both;}' +
                        '.vgt-lead-ava{width:56px;height:56px;border-radius:18px;display:flex;align-items:center;justify-content:center;' +
                        'background:var(--vgt-accent-soft);color:var(--vgt-accent);}' +
                        '.vgt-lead-ava svg{width:28px;height:28px;}' +
                        '.vgt-lead-text{font-size:14px;line-height:1.7;color:var(--vgt-text);max-width:280px;}' +
                        '.vgt-lead-form{width:100%;display:flex;flex-direction:column;gap:8px;}' +
                        // font-size:16px prevents iOS Safari auto-zoom on focus (inputs <16px trigger it).
                        '.vgt-lead-input{width:100%;border:1.5px solid var(--vgt-border);background:var(--vgt-surface);color:var(--vgt-text);' +
                        'border-radius:var(--vgt-r-input);padding:11px 14px;font-family:inherit;font-size:16px;outline:none;transition:border-color .18s,box-shadow .18s;' +
                        'text-align:right;direction:rtl;}' +
                        '.vgt-lead-input:focus{border-color:var(--vgt-accent);box-shadow:0 0 0 4px var(--vgt-accent-soft);}' +
                        '.vgt-lead-btn{border:none;cursor:pointer;border-radius:var(--vgt-r-input);padding:11px;' +
                        'background:linear-gradient(135deg,var(--vgt-accent) 0%,var(--vgt-accent-deep) 100%);' +
                        'color:var(--vgt-on-accent);font-family:inherit;font-size:14px;font-weight:600;transition:transform .15s,opacity .15s;' +
                        'box-shadow:0 6px 18px -6px var(--vgt-accent-shadow);}' +
                        '.vgt-lead-btn:hover{transform:translateY(-1px);}.vgt-lead-btn:active{transform:translateY(0);}' +
                        '.vgt-lead-btn:disabled{opacity:.5;cursor:default;}' +
                        '.vgt-lead-skip{margin-top:4px;border:none;background:transparent;cursor:pointer;color:var(--vgt-muted);' +
                        'font-family:inherit;font-size:12px;padding:6px;transition:color .15s;}' +
                        '.vgt-lead-skip:hover{color:var(--vgt-text);}' +
                        // markdown rendering inside bot bubbles
                        '.vgt-msg strong,.vgt-msg b{font-weight:700;}' +
                        '.vgt-msg em,.vgt-msg i{font-style:italic;}' +
                        '.vgt-msg code{background:var(--vgt-surface);border:1px solid var(--vgt-border);border-radius:4px;padding:1px 5px;font-family:monospace;font-size:.88em;}' +
                        '.vgt-msg ul,.vgt-msg ol{margin:4px 0;padding-inline-start:20px;}' +
                        '.vgt-msg li{margin:2px 0;}' +
                        '.vgt-msg.vgt-bot ul,.vgt-msg.vgt-bot ol{white-space:normal;}' +
                        // typing
                        '.vgt-typing{display:flex!important;flex-direction:row!important;gap:4px;align-items:center;padding:14px 16px;}' +
                        '.vgt-typing span{width:7px;height:7px;border-radius:50%;background:var(--vgt-accent);opacity:.7;animation:vgt-bounce 1.2s infinite;}' +
                        '.vgt-typing span:nth-child(2){animation-delay:.18s;}.vgt-typing span:nth-child(3){animation-delay:.36s;}' +
                        // input
                        '.vgt-foot{padding:10px 12px 8px;border-top:1px solid var(--vgt-border);background:var(--vgt-bg);}' +
                        // Telegram-style input: the send button sits INSIDE the
                        // input field, flush with the inner edge. The input has
                        // extra right padding (in RTL) to make room for the button.
                        // This is the pattern Telegram, WhatsApp and iMessage all
                        // use — the button feels embedded, not floating beside.
                        '.vgt-inputwrap{position:relative;display:flex;align-items:flex-end;background:var(--vgt-surface);border:1.5px solid var(--vgt-border);' +
                        'border-radius:var(--vgt-r-input);padding:6px 6px 6px 14px;transition:border-color .18s,box-shadow .18s,background .18s;}' +
                        '.vgt-inputwrap:focus-within{border-color:var(--vgt-accent);box-shadow:0 0 0 4px var(--vgt-accent-soft);background:var(--vgt-bg);}' +
                        // RTL: send button on the RIGHT, inside the field. The
                        // right padding is 7px — small enough that the button
                        // sits close to the right edge (visually "stuck" to the
                        // right) but not flush against the border (there's a
                        // visible 7px gutter so it doesn't look cramped).
                        '.vgt-root.vgt-rtl .vgt-inputwrap{flex-direction:row-reverse;padding:6px 7px 6px 14px;}' +
                        // font-size:16px — see .vgt-lead-input (iOS auto-zoom guard).
                        // The right padding (54px in RTL) reserves space so long
                        // text doesn't run under the send button.
                        '.vgt-input{flex:1;background:transparent;border:none;outline:none;resize:none;color:var(--vgt-text);font-family:inherit;' +
                        'font-size:16px;line-height:1.55;max-height:110px;min-height:32px;padding:8px 0;margin:0;}' +
                        '.vgt-root.vgt-rtl .vgt-input{padding:8px 54px 8px 0;}' +
                        '.vgt-input::placeholder{color:var(--vgt-muted);opacity:1;}' +
                        // Telegram-style send button: a solid circle INSIDE the
                        // input field, vertically centered with the text. 38px
                        // matches the input's min-height (32px) + padding (8px*2)
                        // so the button is flush with the field height. Position
                        // is handled by flexbox (flex-shrink:0 keeps it from
                        // squishing). No box-shadow — Telegram buttons are flat.
                        '.vgt-send{flex:0 0 38px;width:38px;height:38px;min-width:38px;border:none;cursor:pointer;border-radius:50%;' +
                        'background:var(--vgt-accent);' +
                        'color:var(--vgt-on-accent);display:flex;align-items:center;justify-content:center;flex-shrink:0;' +
                        'transition:transform .15s ease,opacity .15s,background .15s;' +
                        'align-self:center;margin-bottom:0;}' +
                        '.vgt-send:hover{background:var(--vgt-accent-deep);}' +
                        '.vgt-send:active{transform:scale(.9);}' +
                        '.vgt-send:disabled{opacity:.3;cursor:default;transform:none;background:var(--vgt-border);}' +
                        // Telegram's paper-plane icon: 20px. The SVG path's
                        // bounding box (x:2.5–21.9, y:3.4–22.0) is slightly off-
                        // center relative to the 24×24 viewBox (center 12,12):
                        //   path center x = 12.2 (0.2px right of viewBox center)
                        //   path center y = 12.7 (0.7px below viewBox center)
                        // This makes the icon look ~0.7px too low and slightly
                        // right-heavy. We compensate with a tiny translate so
                        // the icon appears perfectly centered (optical centering).
                        '.vgt-send svg{width:20px;height:20px;transform:translate(-0.3px,-0.6px);}' +
                        '.vgt-send:hover svg{transform:translate(-0.3px,-0.6px) scale(1.05);}' +
                        // direction:ltr forces "Powered by Vigent" left-to-right even
                        // on RTL (Persian) pages, so the brand reads naturally instead
                        // of appearing as "Vigent by Powered".
                        '.vgt-brand{text-align:center;font-size:11px;color:var(--vgt-muted);padding-top:9px;direction:ltr;}' +
                        '.vgt-brand a{color:var(--vgt-muted);text-decoration:none;font-weight:600;letter-spacing:.2px;}' +
                        // teaser (auto-greet)
                        '.vgt-teaser{position:absolute;bottom:76px;max-width:260px;background:var(--vgt-bg);color:var(--vgt-text);' +
                        'border:1px solid var(--vgt-border);border-radius:16px;padding:13px 32px 13px 15px;font-size:13.5px;line-height:1.6;cursor:pointer;' +
                        'box-shadow:0 16px 40px -20px rgba(0,0,0,.34);animation:vgt-teaser-in var(--vgt-motion-surface) var(--vgt-ease) both;' +
                        'transition:transform var(--vgt-motion-control) var(--vgt-ease);}' +
                        '.vgt-teaser:hover{transform:translateY(-2px);}' +
                        '.vgt-root.vgt-right .vgt-teaser{right:4px;}.vgt-root.vgt-left .vgt-teaser{left:4px;}' +
                        // 32px touch target (was 20px) — teaser close is a frequent tap on mobile.
                        '.vgt-teaser-x{position:absolute;top:4px;inset-inline-end:4px;width:32px;height:32px;border-radius:50%;border:none;' +
                        'background:var(--vgt-surface);color:var(--vgt-muted);cursor:pointer;display:flex;align-items:center;justify-content:center;' +
                        'box-shadow:0 2px 8px rgba(0,0,0,.2);transition:background .15s,color .15s;}' +
                        '.vgt-teaser-x:hover{background:var(--vgt-border);color:var(--vgt-text);}' +
                        '.vgt-teaser-x svg{width:11px;height:11px;}' +
                        // keyframes
                        '@keyframes vgt-in{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}' +
                        '@keyframes vgt-card-in{from{opacity:0;transform:translateY(10px) scale(.97);}to{opacity:1;transform:translateY(0) scale(1);}}' +
                        '@keyframes vgt-teaser-in{from{opacity:0;transform:translateY(12px) scale(.92);}to{opacity:1;transform:translateY(0) scale(1);}}' +
                        '@keyframes vgt-bounce{0%,60%,100%{transform:translateY(0);opacity:.5;}30%{transform:translateY(-5px);opacity:1;}}' +
                        '@keyframes vgt-ping{0%{box-shadow:0 0 0 0 rgba(34,197,94,.55);}70%{box-shadow:0 0 0 7px rgba(34,197,94,0);}100%{box-shadow:0 0 0 0 rgba(34,197,94,0);}}' +
                        '@keyframes vgt-pulse{0%,100%{box-shadow:0 0 0 2px rgba(34,197,94,.3);}50%{box-shadow:0 0 0 5px rgba(34,197,94,.1);}}' +
                        '@keyframes vgt-float{0%,100%{transform:translateY(0);}50%{transform:translateY(-5px);}}' +
                        // ---- Reply-to (quote) UI ----
                        // Bubble wrapper holds the optional quote block + bubble + reply button.
                        '.vgt-bubble-wrap{position:relative;display:flex;flex-direction:column;gap:3px;max-width:84%;animation:vgt-in .28s cubic-bezier(.2,.7,.3,1) both;}' +
                        '.vgt-bubble-wrap.vgt-user{align-self:flex-end;align-items:flex-end;}' +
                        '.vgt-bubble-wrap.vgt-bot{align-self:flex-start;align-items:flex-start;}' +
                        // Override .vgt-msg max-width:84% so the bubble fills its wrapper.
                        '.vgt-bubble-wrap .vgt-msg{max-width:100%;animation:none;}' +
                        '.vgt-backdrop{position:fixed;inset:0;background:var(--vgt-bg);display:none;z-index:0;touch-action:none;}' +
                        '@media (max-width:768px){' +
                        // ── FULL-SCREEN MOBILE SHEET ──────────────────────────────
                        // On phones & small tablets the chat panel becomes a true
                        // full-screen sheet. We use position:fixed with ALL FOUR
                        // sides pinned to 0 (top/left/right/bottom) and NO explicit
                        // height. This makes the panel stretch to fill whatever
                        // space is between top and bottom — the full viewport when
                        // the keyboard is closed, and the visible area (above the
                        // keyboard) when applyViewportHeight() adjusts `bottom`.
                        // We deliberately do NOT use height:100vh/100dvh here
                        // because an explicit height + top:0 + bottom:0 creates a
                        // conflict (height wins, bottom is ignored) which leaves
                        // the bottom of the screen empty — showing the host site
                        // underneath. The top+bottom stretch approach is the only
                        // reliable way to keep the panel filling the visible area
                        // when the soft keyboard opens on iOS/Android.
                        '.vgt-panel{position:fixed!important;' +
                        'top:0!important;left:0!important;right:0!important;bottom:0!important;' +
                        'width:100vw!important;max-width:100vw!important;' +
                        'height:auto!important;max-height:none!important;' +
                        'border-radius:0!important;border:none!important;box-shadow:none!important;' +
                        'transform:none!important;transition:opacity .2s ease!important;}' +
                        '.vgt-panel.vgt-show{transform:none!important;}' +
                        // Header: respect the notch / Dynamic Island and side safe-areas.
                        '.vgt-head{padding-top:max(12px,env(safe-area-inset-top))!important;' +
                        'padding-left:max(16px,env(safe-area-inset-left))!important;' +
                        'padding-right:max(16px,env(safe-area-inset-right))!important;' +
                        'min-height:56px!important;}' +
                        // Make the close button bigger and always visible on mobile.
                        '.vgt-close{padding:10px!important;min-width:44px!important;min-height:44px!important;' +
                        'display:flex!important;align-items:center!important;justify-content:center!important;}' +
                        '.vgt-close svg{width:22px!important;height:22px!important;}' +
                        // Body fills the available space; respect side safe-areas.
                        '.vgt-body{flex:1!important;min-height:0!important;' +
                        'padding-left:max(16px,env(safe-area-inset-left))!important;' +
                        'padding-right:max(16px,env(safe-area-inset-right))!important;}' +
                        // Footer clears the home indicator and side safe-areas.
                        // (Fixed bug: old selector was .vgt-input-bar which matched
                        //  nothing — the real class is .vgt-foot.)
                        '.vgt-foot{padding-bottom:max(10px,env(safe-area-inset-bottom))!important;' +
                        'padding-left:max(14px,env(safe-area-inset-left))!important;' +
                        'padding-right:max(14px,env(safe-area-inset-right))!important;}' +
                        // Hide the launcher while the full-screen panel is open so it
                        // doesn't float over the conversation.
                        '.vgt-root.vgt-open .vgt-launcher{display:none!important;}' +
                        '.vgt-root.vgt-open .vgt-backdrop{display:block!important;}' +
                        // Slightly larger touch targets for action chips on mobile.
                        '.vgt-action{padding:12px 18px!important;font-size:13px!important;}' +
                        // Messages use a bit more screen width on mobile.
                        '.vgt-msg,.vgt-bubble-wrap,.vgt-group .vgt-msg{max-width:88%!important;}' +
                        // Cards can stretch wider on narrow screens.
                        '.vgt-card{width:min(76vw,252px)!important;flex-basis:min(76vw,252px)!important;}' +
                        // ── LEAD FORM & INTRO: prevent disappearing when keyboard opens ──
                        // On mobile, when the soft keyboard opens the body shrinks
                        // (e.g. from 673px to 271px). The lead form (~406px) and
                        // intro no longer fit, and `margin:auto` centering pushes
                        // the top part (welcome message + name field) above the
                        // visible area where the user can't see or reach it.
                        // Fix: make lead/intro fill the body (flex:1) and scroll
                        // internally, with content pinned to the top
                        // (justify-content:flex-start) so the welcome message and
                        // first field are always visible at the top. Padding-top
                        // gives breathing room below the header.
                        '.vgt-lead,.vgt-intro{flex:1 1 auto!important;margin:0!important;' +
                        'justify-content:flex-start!important;overflow-y:auto!important;' +
                        'padding-top:20px!important;}' +
                        // On very short viewports (keyboard open), shrink the
                        // avatar so it takes less space.
                        '.vgt-lead-ava{width:44px!important;height:44px!important;}' +
                        '.vgt-lead-ava svg{width:22px!important;height:22px!important;}' +
                        '.vgt-intro-ava{width:52px!important;height:52px!important;}' +
                        '.vgt-intro-ava svg{width:26px!important;height:26px!important;}' +
                        // Instant (non-smooth) scrolling on mobile — smooth-scrolling on
                        // every SSE delta while streaming feels laggy on phone browsers.
                        '.vgt-body{scroll-behavior:auto!important;}' +
                        // Teaser: never wider than the phone screen; bigger close target.
                        '.vgt-teaser{max-width:calc(100vw - 40px)!important;}' +
                        '.vgt-teaser-x{width:38px!important;height:38px!important;}' +
                        '}' +
                        '@media (prefers-reduced-motion:reduce){.vgt-root *,.vgt-root{animation:none!important;transition:none!important;}}'
                var st = document.createElement('style')
                st.id = 'vgt-styles'
                st.textContent = css
                document.head.appendChild(st)
        }

        // ---- Build DOM ----
        injectStyles()
        var root = el('div', 'vgt-root')
        // Solid backdrop — sits behind the panel, covers the full viewport on
        // mobile so the host site is never visible through gaps or during the
        // keyboard open transition. On desktop it stays hidden (display:none).
        var backdrop = el('div', 'vgt-backdrop')
        // Swallow touch panning on the backdrop so the host page can never
        // scroll behind the full-screen mobile sheet (iOS scroll-chaining).
        backdrop.addEventListener(
                'touchmove',
                function (e) {
                        e.preventDefault()
                },
                { passive: false },
        )
        var panel = el('div', 'vgt-panel')
        panel.setAttribute('role', 'dialog')
        panel.setAttribute('aria-label', 'chat')

        var head = el('div', 'vgt-head')
        var ava = el('div', 'vgt-ava')
        var headMeta = el('div', 'vgt-head-meta')
        var headTitle = el('div', 'vgt-head-title')
        var headSub = el('div', 'vgt-head-sub')
        headMeta.appendChild(headTitle)
        headMeta.appendChild(headSub)
        var closeBtn = el('button', 'vgt-close', svg('close'))
        closeBtn.setAttribute('aria-label', 'close')
        head.appendChild(ava)
        head.appendChild(headMeta)
        head.appendChild(closeBtn)

        var body = el('div', 'vgt-body')

        var foot = el('div', 'vgt-foot')
        var inputWrap = el('div', 'vgt-inputwrap')
        var input = el('textarea', 'vgt-input')
        input.rows = 1
        // Mobile keyboards: label the return key "send" — matches the existing
        // Enter-to-send behavior in the keydown handler below.
        input.setAttribute('enterkeyhint', 'send')
        var sendBtn = el('button', 'vgt-send', svg('telegramSend'))
        sendBtn.setAttribute('aria-label', 'send')
        inputWrap.appendChild(input)
        inputWrap.appendChild(sendBtn)
        foot.appendChild(inputWrap)
        foot.appendChild(
                el(
                        'div',
                        'vgt-brand',
                        'Powered by <a href="https://vigent.ir" target="_blank" rel="noopener">Vigent</a>',
                ),
        )

        panel.appendChild(head)
        panel.appendChild(body)
        panel.appendChild(foot)

        var launcher = el('button', 'vgt-launcher')
        launcher.setAttribute('aria-label', 'open chat')
        launcher.setAttribute('aria-expanded', 'false')
        var launcherIco = el(
                'span',
                'vgt-launcher-ico',
                svg('chat', 'vgt-l-main') + svg('close', 'vgt-l-close'),
        )
        launcher.appendChild(launcherIco)

        // Backdrop first (lowest in DOM order → paints behind panel & launcher)
        root.appendChild(backdrop)
        root.appendChild(panel)
        root.appendChild(launcher)

        // ---- Apply config ----
        function resolveCornerRadii() {
                if (config.cornerRadius > 0) {
                        return [
                                Math.min(32, config.cornerRadius + 6) + 'px',
                                config.cornerRadius + 'px',
                                Math.max(8, config.cornerRadius - 2) + 'px',
                        ]
                }
                if (config.corners === 'round') return ['28px', '20px', '24px']
                if (config.corners === 'sharp') return ['12px', '9px', '11px']
                return ['22px', '17px', '18px']
        }

        function applyConfig() {
                var dark = config.theme !== 'light'
                var accent = config.primaryColor || '#0F0F10'
                var onAccent = contrast(accent)
                var s = root.style
                s.setProperty('--vgt-accent', accent)
                s.setProperty('--vgt-accent-deep', shade(accent, -0.22))
                s.setProperty('--vgt-on-accent', onAccent)
                s.setProperty('--vgt-accent-soft', soft(accent, 0.13))
                s.setProperty('--vgt-accent-line', soft(accent, 0.3))
                // Accent used as *text/ink* on the panel surface: a very light accent on the
                // light theme (or very dark accent on the dark theme) is illegible — fall
                // back to the regular text color in that case.
                var accentIsLight = contrast(accent) === '#000000'
                s.setProperty(
                        '--vgt-accent-ink',
                        dark ? (accentIsLight ? accent : '#f3f4f6') : accentIsLight ? '#1a1a1e' : accent,
                )
                s.setProperty('--vgt-accent-shadow', soft(accent, dark ? 0.5 : 0.4))
                s.setProperty('--vgt-bg', dark ? '#111111' : '#ffffff')
                s.setProperty('--vgt-head-bg', dark ? '#171717' : '#f8f8f7')
                s.setProperty('--vgt-surface', dark ? '#202020' : '#f5f5f3')
                s.setProperty('--vgt-text', dark ? '#f5f5f3' : '#111111')
                s.setProperty('--vgt-muted', dark ? '#a1a1aa' : '#6b7280')
                s.setProperty('--vgt-border', dark ? 'rgba(255,255,255,.10)' : 'rgba(17,17,17,.09)')
                s.setProperty('--vgt-font', FONT_FAMILY[config.font] || FONT_FAMILY.vazirmatn)
                s.setProperty('--vgt-motion-control', '180ms')
                s.setProperty('--vgt-motion-surface', '280ms')
                s.setProperty('--vgt-ease', 'cubic-bezier(.23,1,.32,1)')

                var r = resolveCornerRadii()
                s.setProperty('--vgt-r-panel', r[0])
                s.setProperty('--vgt-r-bubble', r[1])
                s.setProperty('--vgt-r-input', r[2])

                root.classList.toggle('vgt-right', config.position !== 'left')
                root.classList.toggle('vgt-left', config.position === 'left')
                root.classList.toggle('vgt-rtl', isRtl())
                panel.setAttribute('dir', isRtl() ? 'rtl' : 'ltr')

                head.classList.toggle('vgt-head-grad', config.headerStyle === 'gradient')

                headTitle.textContent = config.name || 'Vigent'
                var dot = el('span', 'vgt-ava-dot')
                headSub.textContent =
                        config.subtitle || t('آنلاین — پاسخ فوری', 'Online — instant replies')
                ava.innerHTML = ''
                if (config.avatar) {
                        var img = el('img')
                        img.src = config.avatar
                        img.alt = ''
                        ava.appendChild(img)
                } else {
                        ava.innerHTML = svg(iconKey())
                }
                ava.appendChild(dot)

                // launcher icon mirrors the chosen icon
                launcherIco.innerHTML = svg(iconKey(), 'vgt-l-main') + svg('close', 'vgt-l-close')
                var existingLabel = launcher.querySelector('.vgt-launcher-label')
                if (config.launcherLabel) {
                        if (!existingLabel) {
                                existingLabel = el('span', 'vgt-launcher-label', '')
                                launcher.appendChild(existingLabel)
                        }
                        existingLabel.textContent = config.launcherLabel
                } else if (existingLabel) {
                        existingLabel.remove()
                }

                input.placeholder = t('پیام خود را بنویسید…', 'Type a message…')
                // Localized, meaningful a11y labels (screen readers on the host site).
                closeBtn.setAttribute('aria-label', t('بستن گفتگو', 'Close chat'))
                sendBtn.setAttribute('aria-label', t('ارسال', 'Send'))
                launcher.setAttribute('aria-label', t('باز کردن گفتگو', 'Open chat'))
                panel.setAttribute(
                        'aria-label',
                        t('گفتگو با ' + (config.name || 'Vigent'), 'Chat with ' + (config.name || 'Vigent')),
                )
                injectFont()
        }

        // ---- Intro / empty state ----
        function renderIntro() {
                if (introVisible) return
                var hasQr = config.quickReplies && config.quickReplies.length > 0
                if (!config.welcomeMessage && !hasQr) return
                introVisible = true
                var intro = el('div', 'vgt-intro')
                intro.appendChild(el('div', 'vgt-intro-ava', svg(iconKey())))
                if (config.welcomeMessage) {
                        var txt = el('div', 'vgt-intro-text')
                        txt.textContent = config.welcomeMessage
                        intro.appendChild(txt)
                }
                if (hasQr) {
                        var qr = el('div', 'vgt-qr')
                        config.quickReplies.forEach(function (q) {
                                var chip = el('button', 'vgt-action')
                                chip.type = 'button'
                                chip.textContent = q
                                chip.addEventListener('click', function () {
                                        send(q)
                                })
                                qr.appendChild(chip)
                        })
                        intro.appendChild(qr)
                }
                intro.setAttribute('data-vgt-intro', '1')
                body.appendChild(intro)
        }
        function clearIntro() {
                var intro = body.querySelector('[data-vgt-intro]')
                if (intro) intro.remove()
                introVisible = false
        }

        // ---- Lead capture (pre-chat form: introduce the assistant, ask name + phone) ----
        function leadStorageKey() {
                return 'vgt:lead:' + agentId
        }
        function loadStoredLead() {
                try {
                        var raw = localStorage.getItem(leadStorageKey())
                        if (!raw) return null
                        return JSON.parse(raw)
                } catch (e) {
                        return null
                }
        }
        function saveStoredLead(lead) {
                try {
                        localStorage.setItem(leadStorageKey(), JSON.stringify(lead))
                } catch (e) {
                        /* private mode */
                }
        }

        function renderLeadCapture() {
                if (leadCaptured || !config.leadCapture) return false
                var stored = loadStoredLead()
                if (stored) {
                        // Returning visitor — don't ask again.
                        visitorName = stored.name || null
                        visitorPhone = stored.phone || null
                        leadCaptured = true
                        return false
                }
                // Hide the chat input bar while the lead form is showing so the
                // visitor can't type/send until they've introduced themselves.
                if (foot) foot.style.display = 'none'
                body.innerHTML = ''
                var lead = el('div', 'vgt-lead')
                lead.appendChild(el('div', 'vgt-lead-ava', svg('bot')))
                var msg =
                        config.leadCaptureMessage ||
                        t(
                                'سلام! من ' +
                                        config.name +
                                        ' هستم، دستیار هوش مصنوعی این مجموعه و آماده‌ام به سؤالات شما پاسخ بدهم. برای شروع گفتگو لطفاً نام و شماره موبایل خود را وارد کنید.',
                                "Hi! I'm " +
                                        config.name +
                                        ', the AI assistant here, ready to answer your questions. To start, please enter your name and mobile number.',
                        )
                lead.appendChild(el('div', 'vgt-lead-text', msg))
                // When the form is required, show a small "required" badge so the
                // visitor understands they must fill it before they can chat.
                if (config.leadCaptureRequired) {
                        var badge = el('div', 'vgt-lead-text')
                        badge.style.cssText = 'font-size:12px;color:var(--vgt-muted);font-weight:600;margin-top:-4px;'
                        badge.textContent = t('برای شروع چت الزامی است', 'Required to start chat')
                        lead.appendChild(badge)
                }
                var form = el('form', 'vgt-lead-form')
                var nameInput = el('input', 'vgt-lead-input')
                nameInput.type = 'text'
                nameInput.placeholder = t('نام و نام خانوادگی', 'Full name')
                nameInput.autocomplete = 'name'
                nameInput.maxLength = 60
                var phoneInput = el('input', 'vgt-lead-input')
                phoneInput.type = 'tel'
                phoneInput.placeholder = t('شماره موبایل — ۰۹۱۲ ۳۴۵ ۶۷۸۹', 'Mobile — 0912 345 6789')
                phoneInput.inputMode = 'tel'
                phoneInput.autocomplete = 'tel'
                // Live-convert Persian/Arabic digits → ASCII so the permissive
                // submit gate (which counts \d) doesn't reject localized numbers.
                phoneInput.addEventListener('input', function (e) {
                        var converted = toEnglishDigits(e.target.value)
                        if (converted !== e.target.value) e.target.value = converted
                })
                var submit = el('button', 'vgt-lead-btn', t('شروع گفتگو', 'Start chat'))
                submit.type = 'submit'
                form.appendChild(nameInput)
                form.appendChild(phoneInput)
                form.appendChild(submit)
                lead.appendChild(form)
                // Optional "skip" button — only when the agent hasn't forced the form.
                // Skipping lets the visitor chat right away; the AI then tries to pull
                // name/phone out of the conversation (smart identification).
                var skipBtn = null
                if (!config.leadCaptureRequired) {
                        skipBtn = el('button', 'vgt-lead-skip', t('رد کردن و شروع گفتگو', 'Skip & start chat'))
                        skipBtn.type = 'button'
                        skipBtn.addEventListener('click', function () {
                                visitorName = null
                                visitorPhone = null
                                leadCaptured = true
                                if (foot) foot.style.display = ''
                                body.innerHTML = ''
                                introVisible = false
                                renderIntro()
                        })
                        lead.appendChild(skipBtn)
                }
                body.appendChild(lead)
                // Auto-focus only on desktop; on mobile it would pop the keyboard
                // over the just-opened sheet before the visitor has seen the form.
                if (!isMobile()) {
                        setTimeout(function () {
                                nameInput.focus()
                        }, 80)
                }

                form.addEventListener('submit', function (e) {
                        e.preventDefault()
                        var name = (nameInput.value || '').trim()
                        // Run the phone through toEnglishDigits before validating
                        // so Persian-digit numbers (۰۹۱۲…) pass the digit-count gate.
                        var phone = toEnglishDigits(phoneInput.value || '').trim()
                        phoneInput.value = phone
                        var ok = true
                        if (name.length < 2) {
                                nameInput.style.borderColor = '#ef4444'
                                ok = false
                        } else {
                                nameInput.style.borderColor = ''
                        }
                        // Unified with the chat-link page: require at least 10 digits
                        // (a valid mobile number). Accepts digits, +, spaces, dashes.
                        var digits = phone.replace(/\D/g, '')
                        if (digits.length < 10) {
                                phoneInput.style.borderColor = '#ef4444'
                                ok = false
                        } else {
                                phoneInput.style.borderColor = ''
                        }
                        if (!ok) {
                                ;(name.length < 2 ? nameInput : phoneInput).focus()
                                return
                        }
                        visitorName = name
                        visitorPhone = phone
                        saveStoredLead({ name: name, phone: phone, ts: Date.now() })
                        leadCaptured = true
                        if (foot) foot.style.display = ''
                        body.innerHTML = ''
                        introVisible = false
                        renderIntro()
                })
                return true
        }

        // ---- Messages ----

        /**
         * Minimal, safe Markdown → HTML converter for bot replies.
         * Escapes HTML first (XSS-safe), then applies inline + block markers:
         *   **bold**  __bold__  *italic*  _italic_  `code`
         *   # / ## / ### headings  → <strong>
         *   - / * / • unordered lists  → <ul><li>
         *   1. ordered lists  → <ol><li>
         * Newlines are preserved by the container's white-space:pre-wrap.
         */
        function renderMarkdown(text) {
                var s = String(text == null ? '' : text)
                // Escape HTML entities first.
                s = s
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;')
                        .replace(/"/g, '&quot;')
                // Headings → bold (single line, ^#...)
                s = s.replace(/^#{1,6}\s+(.+)$/gm, '<strong>$1</strong>')
                // Bold
                s = s.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>')
                s = s.replace(/__([^_]+?)__/g, '<strong>$1</strong>')
                // Inline code (do before italic so `*` inside code is untouched)
                s = s.replace(/`([^`]+?)`/g, '<code>$1</code>')
                // Italic
                s = s.replace(/\*([^*\n]+?)\*/g, '<em>$1</em>')
                s = s.replace(/_([^_\n]+?)_/g, '<em>$1</em>')
                // List items (capture consecutive lines into <ul>)
                s = s.replace(/^[-*•]\s+(.+)$/gm, '\u0001LI\u0001$1')
                s = s.replace(/^\d+[.)]\s+(.+)$/gm, '\u0001LI\u0001$1')
                // Wrap consecutive list-item markers in <ul>…</ul>
                s = s.replace(/(\u0001LI\u0001[^\n]*(\n|$))+/g, function (block) {
                        var items = block
                                .trim()
                                .split('\n')
                                .map(function (l) {
                                        return '<li>' + l.replace(/^\u0001LI\u0001/, '') + '</li>'
                                })
                                .join('')
                        return '<ul>' + items + '</ul>'
                })
                return s
        }

        function bubble(role, text, opts) {
                opts = opts || {}
                var cls =
                        role === 'user'
                                ? 'vgt-msg vgt-user'
                                : role === 'error'
                                        ? 'vgt-msg vgt-err'
                                        : 'vgt-msg vgt-bot'
                var b = el('div', cls)
                if (role === 'bot') {
                        b.innerHTML = renderMarkdown(text)
                } else {
                        b.textContent = text
                }
                // Error banners are full-width stretch toasts — no wrapper.
                if (role === 'error') {
                        body.appendChild(b)
                        scrollDown(true)
                        return b
                }
                // Wrap user/bot bubbles in a container that carries the server-side
                // message id (used for dedup in operator-message polling).
                var side = role === 'user' ? 'user' : 'bot'
                var wrap = el('div', 'vgt-bubble-wrap vgt-' + side)
                if (opts.id) wrap.setAttribute('data-message-id', opts.id)
                wrap.appendChild(b)
                body.appendChild(wrap)
                scrollDown(true)
                // ── Fix: explicitly set bubble width to fit text ──────────
                // The flexbox layout has a circular sizing dependency
                // (bubble-wrap sizes to msg, msg's max-width:100% sizes to
                // bubble-wrap) that resolves to a value between min-content
                // and max-content — often a few px too narrow, causing Persian
                // words to wrap mid-character. We break the cycle by measuring
                // the actual text width and setting an explicit width on the
                // msg element. Only applied when the text fits within the
                // max-width budget; long messages are handled by CSS wrapping.
                if (role === 'user' || role === 'bot') {
                        requestAnimationFrame(function () {
                                try {
                                        var span = document.createElement('span')
                                        var bcs = window.getComputedStyle(b)
                                        span.style.cssText =
                                                'font-size:' + bcs.fontSize +
                                                ';font-family:' + bcs.fontFamily +
                                                ';font-weight:' + bcs.fontWeight +
                                                ';line-height:' + bcs.lineHeight +
                                                ';white-space:pre;visibility:hidden;position:absolute;'
                                        document.body.appendChild(span)
                                        var maxLineWidth = 0
                                        var lines = (text || '').split('\n')
                                        for (var i = 0; i < lines.length; i++) {
                                                span.textContent = lines[i] || ' '
                                                var w = span.getBoundingClientRect().width
                                                if (w > maxLineWidth) maxLineWidth = w
                                        }
                                        span.remove()
                                        // ideal = text + horizontal padding (28px) + 2px buffer
                                        var idealWidth = maxLineWidth + 30
                                        // max allowed = 88% of body on mobile, 84% on desktop
                                        var bodyWidth = body.getBoundingClientRect().width
                                        var maxAllowed = bodyWidth * (isMobile() ? 0.88 : 0.84)
                                        if (idealWidth <= maxAllowed) {
                                                // Text fits — set explicit width to prevent
                                                // the circular dependency from shrinking the bubble.
                                                // Use !important to override the mobile media query's
                                                // max-width:88%!important which is relative to the
                                                // bubble-wrap (circular) and would cap the width.
                                                b.style.setProperty('width', idealWidth + 'px', 'important')
                                                b.style.setProperty('max-width', 'none', 'important')
                                        }
                                        // else: text is too long — let CSS handle wrapping
                                } catch (e) {
                                        /* measurement failed — fall back to CSS */
                                }
                        })
                }
                return b
        }
        // force=true always jumps to the bottom (right after the visitor sends).
        // Without force we respect a reader who scrolled up: streaming deltas and
        // polled operator messages won't yank them back down mid-read.
        function scrollDown(force) {
                if (!force) {
                        var gap = body.scrollHeight - body.scrollTop - body.clientHeight
                        if (gap > 120) return
                }
                body.scrollTop = body.scrollHeight
        }
        function showTyping() {
                var node = el(
                        'div',
                        'vgt-msg vgt-bot vgt-typing',
                        '<span></span><span></span><span></span>',
                )
                body.appendChild(node)
                scrollDown(true)
                return node
        }
        function setStreaming(on) {
                streaming = on
                sendBtn.disabled = on
        }

        // ---- Product cards ([[product:{…}]] tokens in the AI reply) ----
        var PRODUCT_PREFIX = '[[product:'
        var MAX_SHOWCASE_PRODUCTS = 10

        function safeHttpUrl(value) {
                if (typeof value !== 'string' || !value) return ''
                try {
                        var parsed = new URL(value)
                        return parsed.protocol === 'https:' || parsed.protocol === 'http:'
                                ? parsed.toString()
                                : ''
                } catch (e) {
                        return ''
                }
        }

        function compactProductText(value, max) {
                return typeof value === 'string'
                        ? value.replace(/\s+/g, ' ').trim().slice(0, max)
                        : ''
        }

        function productSpecs(product) {
                var raw = product.specs || product.attributes
                var specs = []
                if (Array.isArray(raw)) {
                        for (var i = 0; i < raw.length && specs.length < 4; i++) {
                                var item = compactProductText(raw[i], 70)
                                if (item) specs.push(item)
                        }
                } else if (raw && typeof raw === 'object') {
                        Object.keys(raw).some(function (key) {
                                var value = raw[key]
                                if (typeof value !== 'string' && typeof value !== 'number') return false
                                var label = compactProductText(key, 28)
                                var detail = compactProductText(String(value), 38)
                                if (label && detail) specs.push(label + ': ' + detail)
                                return specs.length >= 4
                        })
                }
                return specs
        }

        function productTokenBounds(raw, jsonStart) {
                var depth = 0
                var quoted = false
                var escaped = false
                for (var index = jsonStart; index < raw.length; index++) {
                        var char = raw.charAt(index)
                        if (quoted) {
                                if (escaped) escaped = false
                                else if (char === '\\') escaped = true
                                else if (char === '"') quoted = false
                                continue
                        }
                        if (char === '"') {
                                quoted = true
                                continue
                        }
                        if (char === '{') depth++
                        else if (char === '}') {
                                depth--
                                if (depth === 0 && raw.slice(index + 1, index + 3) === ']]') {
                                        return { jsonEnd: index + 1, tokenEnd: index + 3 }
                                }
                        }
                }
                return null
        }

        /** Split raw assistant content into clean text + at most ten cards.
            A prefix/end scanner is used instead of a brace regex so escaped
            JSON and future optional fields remain backward-compatible. */
        function parseAssistant(raw, done) {
                var cards = []
                var visible = []
                var seen = {}
                var cursor = 0
                while (cursor < raw.length) {
                        var start = raw.indexOf(PRODUCT_PREFIX, cursor)
                        if (start === -1) {
                                visible.push(raw.slice(cursor))
                                break
                        }
                        visible.push(raw.slice(cursor, start))
                        var jsonStart = start + PRODUCT_PREFIX.length
                        var bounds = productTokenBounds(raw, jsonStart)
                        if (!bounds) break

                        if (done && cards.length < MAX_SHOWCASE_PRODUCTS) {
                                try {
                                        var p = JSON.parse(raw.slice(jsonStart, bounds.jsonEnd))
                                        var name = compactProductText(p && p.name, 120)
                                        var identity = compactProductText(p && p.id, 80) || name.toLocaleLowerCase()
                                        if (name && !seen[identity]) {
                                                seen[identity] = true
                                                cards.push({
                                                        id: compactProductText(p.id, 80),
                                                        name: name,
                                                        price: p.price != null ? compactProductText(String(p.price), 60) : '',
                                                        desc: compactProductText(p.desc || p.description, 240),
                                                        badge: compactProductText(p.badge, 28),
                                                        image: safeHttpUrl(p.image || p.imageUrl),
                                                        url: safeHttpUrl(p.url || p.productUrl),
                                                        specs: productSpecs(p),
                                                })
                                        }
                                } catch (e) {
                                        /* malformed marker is removed, never displayed */
                                }
                        }
                        cursor = bounds.tokenEnd
                }
                var text = visible.join('')
                return { text: text.replace(/\n{3,}/g, '\n\n').trim(), cards: cards }
        }

        function renderCard(p) {
                var card = el('article', 'vgt-card')
                if (p.image) {
                        var image = document.createElement('img')
                        image.className = 'vgt-card-image'
                        image.src = p.image
                        image.alt = p.name
                        image.loading = 'lazy'
                        image.decoding = 'async'
                        image.width = 320
                        image.height = 240
                        card.appendChild(image)
                } else {
                        card.appendChild(el('div', 'vgt-card-image vgt-card-placeholder', svg('box')))
                }
                var row = el('div', 'vgt-card-row')
                var main = el('div', 'vgt-card-main')
                var top = el('div', 'vgt-card-top')
                var name = el('div', 'vgt-card-name')
                name.textContent = p.name
                top.appendChild(name)
                if (p.badge) {
                        var badge = el('span', 'vgt-card-badge')
                        badge.textContent = p.badge
                        top.appendChild(badge)
                }
                main.appendChild(top)
                if (p.desc) {
                        var desc = el('div', 'vgt-card-desc')
                        desc.textContent = p.desc
                        main.appendChild(desc)
                }
                if (p.specs && p.specs.length) {
                        var specs = el('div', 'vgt-card-specs')
                        for (var i = 0; i < p.specs.length; i++) {
                                var spec = el('span', 'vgt-card-spec')
                                spec.textContent = p.specs[i]
                                specs.appendChild(spec)
                        }
                        main.appendChild(specs)
                }
                if (p.price) {
                        var price = el('div', 'vgt-card-price')
                        price.textContent = p.price
                        main.appendChild(price)
                }
                row.appendChild(main)
                card.appendChild(row)
                if (p.url) {
                        var link = el('a', 'vgt-card-link')
                        link.href = p.url
                        link.target = '_blank'
                        link.rel = 'noopener noreferrer'
                        link.textContent = t('مشاهده محصول', 'View product')
                        card.appendChild(link)
                } else {
                        var noLink = el('div', 'vgt-card-no-link')
                        noLink.textContent = t('برای اطلاعات بیشتر پیام دهید', 'Message us for details')
                        card.appendChild(noLink)
                }
                return card
        }

        function actionChip(label, message) {
                var btn = el('button', 'vgt-action', svg('arrow'))
                btn.type = 'button'
                var span = document.createElement('span')
                span.textContent = label
                btn.insertBefore(span, btn.firstChild)
                btn.addEventListener('click', function () {
                        send(message)
                })
                return btn
        }

        /**
         * (Re)render one assistant turn from its raw streamed text into `group`:
         * source chip (catalog) + text bubble + product cards + action chips.
         * Called on every delta — cheap because it only appends what's new.
         */
        function renderAssistantGroup(group, raw, done) {
                var parsed = parseAssistant(raw, done)

                // text bubble
                var msg = group.querySelector('.vgt-msg')
                if (parsed.text) {
                        if (!msg) {
                                msg = el('div', 'vgt-msg vgt-bot')
                                group.appendChild(msg)
                        }
                        // Render markdown (bold, italic, lists, headings) — safe because
                        // renderMarkdown() escapes HTML before applying markers.
                        var html = renderMarkdown(parsed.text)
                        if (msg.getAttribute('data-raw') !== parsed.text) {
                                msg.innerHTML = html
                                msg.setAttribute('data-raw', parsed.text)
                        }
                } else if (done && msg) {
                        msg.remove()
                }

                // source chip — appears once the first card is complete
                if (parsed.cards.length > 0 && !group.querySelector('.vgt-source')) {
                        var chip = el('div', 'vgt-source', svg('box') + '<span>' + '</span>')
                        chip.querySelector('span').textContent = t(
                                'از کاتالوگ محصول',
                                'From the product catalog',
                        )
                        group.insertBefore(chip, group.firstChild)
                }
                if (parsed.cards.length > 0) group.classList.add('vgt-has-cards')

                // Cards are rebuilt only when their trusted identity changes.
                // This keeps SSE replacement deterministic without doing DOM work
                // for every text delta.
                var rail = group.querySelector('.vgt-card-rail')
                if (parsed.cards.length > 0 && !rail) {
                        rail = el('div', 'vgt-card-rail')
                        rail.tabIndex = 0
                        rail.setAttribute('role', 'region')
                        rail.setAttribute('aria-label', t('ویترین محصولات پیشنهادی', 'Recommended products'))
                        group.appendChild(rail)
                }
                var signature = parsed.cards.map(function (card) {
                        return card.id || card.name
                }).join('|')
                if (rail && group.getAttribute('data-card-signature') !== signature) {
                        while (rail.firstChild) rail.removeChild(rail.firstChild)
                        for (var i = 0; i < parsed.cards.length; i++) {
                                rail.appendChild(renderCard(parsed.cards[i]))
                        }
                        group.setAttribute('data-card-signature', signature)
                }

                // action chips — once, after streaming finished, for the first card
                if (done && parsed.cards.length > 0 && !group.querySelector('.vgt-actions')) {
                        var name = parsed.cards[0].name
                        var actions = el('div', 'vgt-actions')
                        actions.appendChild(
                                actionChip(
                                        t('دیدن مشخصات', 'View specs'),
                                        t(
                                                'مشخصات کامل «' + name + '» را بگو',
                                                'Show me the full specs of "' + name + '"',
                                        ),
                                ),
                        )
                        actions.appendChild(
                                actionChip(
                                        t('مقایسه', 'Compare'),
                                        t(
                                                '«' + name + '» را با گزینه‌های مشابه مقایسه کن',
                                                'Compare "' + name + '" with similar options',
                                        ),
                                ),
                        )
                        actions.appendChild(
                                actionChip(
                                        t('موجودیه؟', 'In stock?'),
                                        t('موجودی «' + name + '» چطوره؟', 'Is "' + name + '" in stock?'),
                                ),
                        )
                        group.appendChild(actions)
                }

                scrollDown()
        }

        function errorText(code) {
                if (code === 'NO_KEY')
                        return t(
                                '⚠️ این دستیار هنوز پیکربندی نشده است. لطفاً با مدیر سایت تماس بگیرید.',
                                '⚠️ This assistant is not configured yet. Please contact the site owner.',
                        )
                if (code === 'RATE_LIMIT')
                        return t(
                                'پیام‌های زیادی ارسال شد. لطفاً چند لحظه صبر کنید.',
                                'Too many messages. Please wait a moment.',
                        )
                if (code === 'FORBIDDEN_ORIGIN')
                        return t(
                                'این ویجت برای نمایش روی این دامنه مجاز نیست.',
                                'This widget is not allowed on this domain.',
                        )
                return t(
                        'خطا در دریافت پاسخ. دوباره تلاش کنید.',
                        'Failed to get a response. Please try again.',
                )
        }

        function send(preset) {
                var text = (preset != null ? preset : input.value).trim()
                if (!text || streaming) return
                // Block sending until the lead-capture form is filled (when required).
                if (config.leadCapture && !leadCaptured) return
                if (preset == null) {
                        input.value = ''
                        autoGrow()
                }
                clearIntro()
                bubble('user', text)
                setStreaming(true)
                var typing = showTyping()
                var group = null
                var raw = ''

                function ensureGroup() {
                        if (!group) {
                                if (typing.parentNode) typing.remove()
                                group = el('div', 'vgt-group')
                                body.appendChild(group)
                        }
                        return group
                }

                var payload = { message: text }
                if (conversationId && conversationToken) {
                        payload.conversationId = conversationId
                        payload.conversationToken = conversationToken
                }
                // Attach the lead-form identity to the first message so the server can
                // create/attach the CRM contact and greet the visitor by name.
                if (!visitorSent && (visitorName || visitorPhone)) {
                        if (visitorName) payload.visitorName = visitorName
                        if (visitorPhone) payload.visitorPhone = visitorPhone
                        visitorSent = true
                }
                fetch(base + '/api/widget/' + agentId + '/chat', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                })
                        .then(function (res) {
                                if (!res.ok || !res.body) {
                                        return res
                                                .json()
                                                .catch(function () {
                                                        return {}
                                                })
                                                .then(function (d) {
                                                        if (typing.parentNode) typing.remove()
                                                        bubble('error', errorText(d && d.error))
                                                        setStreaming(false)
                                                })
                                }
                                var issuedToken = res.headers.get('x-vigent-conversation-token')
                                if (issuedToken) conversationToken = issuedToken
                                var reader = res.body.getReader()
                                var decoder = new TextDecoder()
                                var buf = ''
                                function pump() {
                                        return reader.read().then(function (r) {
                                                if (r.done) {
                                                        if (group) renderAssistantGroup(group, raw, true)
                                                        setStreaming(false)
                                                        return
                                                }
                                                buf += decoder.decode(r.value, { stream: true })
                                                var parts = buf.split('\n\n')
                                                buf = parts.pop()
                                                parts.forEach(function (p) {
                                                        var line = p.trim()
                                                        if (line.indexOf('data:') !== 0) return
                                                        try {
                                                                var evt = JSON.parse(line.slice(5).trim())
                                                                if (evt.type === 'meta') {
                                                                        if (evt.conversationId && evt.conversationId !== conversationId) {
                                                                                conversationId = evt.conversationId
                                                                                saveStoredConv(conversationId, conversationToken)
                                                                        }
                                                                } else if (evt.type === 'delta') {
                                                                        raw += evt.text
                                                                        renderAssistantGroup(ensureGroup(), raw, false)
                                                                } else if (evt.type === 'replace' && typeof evt.text === 'string') {
                                                                        raw = evt.text
                                                                        renderAssistantGroup(ensureGroup(), raw, true)
                                                                } else if (evt.type === 'done') {
                                                                        if (group) renderAssistantGroup(group, raw, true)
                                                                        // The server emits the persisted assistant message id on
                                                                        // `done`; bind it to the group so operator-message polling
                                                                        // can dedup it (data-message-id).
                                                                        if (group && evt.messageId) {
                                                                                group.setAttribute('data-message-id', evt.messageId)
                                                                        }
                                                                } else if (evt.type === 'error' && !group) {
                                                                        if (typing.parentNode) typing.remove()
                                                                        bubble('error', errorText(evt.error))
                                                                }
                                                        } catch (e) {}
                                                })
                                                return pump()
                                        })
                                }
                                return pump()
                        })
                        .catch(function () {
                                if (typing.parentNode) typing.remove()
                                bubble('error', errorText())
                                setStreaming(false)
                        })
        }

        function autoGrow() {
                input.style.height = 'auto'
                input.style.height = Math.min(input.scrollHeight, 110) + 'px'
        }

        // ---- Teaser (auto-greet) ----
        function showTeaser() {
                if (isOpen || teaserShown || !config.welcomeMessage) return
                teaserShown = true
                var tz = el('div', 'vgt-teaser')
                tz.textContent = config.welcomeMessage
                var x = el('button', 'vgt-teaser-x', svg('close'))
                x.setAttribute('aria-label', 'close')
                x.addEventListener('click', function (e) {
                        e.stopPropagation()
                        tz.remove()
                })
                tz.appendChild(x)
                tz.addEventListener('click', function () {
                        tz.remove()
                        toggle(true)
                })
                root.appendChild(tz)
        }

        /**
         * Fetch the persisted message history from the server and replay it into
         * the chat body so the visitor doesn't lose their conversation on refresh.
         * Only runs once per page load (guarded by `historyLoaded`).
         */
        function loadHistory() {
                if (historyLoaded || !conversationId || !conversationToken) return
                historyLoaded = true
                fetch(
                        base +
                                '/api/widget/' +
                                agentId +
                                '/chat?conversationId=' +
                                encodeURIComponent(conversationId),
                        {
                                method: 'GET',
                                headers: {
                                        Accept: 'application/json',
                                        'X-Vigent-Conversation-Token': conversationToken,
                                },
                        },
                )
                        .then(function (r) {
                                return r.ok ? r.json() : null
                        })
                        .then(function (data) {
                                if (!data || !Array.isArray(data.messages) || data.messages.length === 0) return
                                // Don't replay if the body already has bubbles (e.g. lead form still showing).
                                if (body.querySelector('.vgt-msg') || body.querySelector('.vgt-lead')) return
                                clearIntro()
                                introVisible = false
                                welcomeShown = true
                                data.messages.forEach(function (m) {
                                        if (m.role === 'user') {
                                                bubble('user', m.content, {
                                                        id: m.id,
                                                })
                                        } else {
                                                var g = el('div', 'vgt-group')
                                                body.appendChild(g)
                                                renderAssistantGroup(g, m.content, true)
                                                // Bind the message id so operator-message polling
                                                // can dedup this assistant message.
                                                if (m.id) g.setAttribute('data-message-id', m.id)
                                        }
                                })
                                scrollDown(true)
                        })
                        .catch(function () {
                                /* network error — continue with empty transcript */
                        })
        }

        // ── Operator-message polling ─────────────────────────────────────────
        // The web widget is a request/response channel: when an operator
        // replies from the dashboard CRM, there's no WebSocket/SSE push to
        // the visitor's browser. We poll the GET history endpoint every 8
        // seconds while the panel is open and append any server-side
        // messages we haven't rendered yet (keyed by data-message-id).
        // Skip polling while the AI is streaming (it has its own SSE).
        function pollForNewMessages() {
                // Skip while the tab is hidden — saves battery/mobile data; the
                // visibilitychange listener below runs a catch-up poll on return.
                if (document.hidden) return
                if (!conversationId || !conversationToken || streaming) return
                fetch(
                        base +
                                '/api/widget/' +
                                agentId +
                                '/chat?conversationId=' +
                                encodeURIComponent(conversationId),
                        {
                                method: 'GET',
                                headers: {
                                        Accept: 'application/json',
                                        'X-Vigent-Conversation-Token': conversationToken,
                                },
                        },
                )
                        .then(function (r) {
                                return r.ok ? r.json() : null
                        })
                        .then(function (data) {
                                if (!data || !Array.isArray(data.messages)) return
                                // ── Dedup: collect every server message id already in the DOM ──
                                // Assistant messages live in .vgt-group containers (data-message-id
                                // set on the group); user messages live in .vgt-bubble-wrap
                                // containers (data-message-id set by bubble() when opts.id is
                                // present). We query BOTH classes so we don't miss either.
                                var seenIds = {}
                                var idd = body.querySelectorAll('[data-message-id]')
                                for (var i = 0; i < idd.length; i++) {
                                        seenIds[idd[i].getAttribute('data-message-id')] = true
                                }
                                // User bubbles typed locally have NO data-message-id, so dedup them
                                // by text content (first 80 chars). This prevents re-appending the
                                // visitor's own messages that the server echoes back.
                                var userTexts = {}
                                var userBubbles = body.querySelectorAll('.vgt-msg.vgt-user')
                                for (var j = 0; j < userBubbles.length; j++) {
                                        // NB: named `txt` (not `t`) so it can never shadow the t()
                                        // translation helper in this scope.
                                        var txt = (userBubbles[j].textContent || '').slice(0, 80)
                                        userTexts[txt] = true
                                }
                                var appended = false
                                data.messages.forEach(function (m) {
                                        // Skip user echoes — we already show what the visitor typed.
                                        if (m.role === 'user') {
                                                var key = (m.content || '').slice(0, 80)
                                                if (userTexts[key]) return
                                                // If we somehow missed a user bubble, render it.
                                                bubble('user', m.content, {
                                                        id: m.id,
                                                })
                                                appended = true
                                                return
                                        }
                                        // Assistant message — skip if we already have this server id.
                                        // This is the critical dedup that prevents flicker: without it,
                                        // every poll cycle would re-append ALL assistant messages.
                                        if (m.id && seenIds[m.id]) return
                                        var g = el('div', 'vgt-group')
                                        body.appendChild(g)
                                        renderAssistantGroup(g, m.content, true)
                                        if (m.id) g.setAttribute('data-message-id', m.id)
                                        appended = true
                                })
                                if (appended) scrollDown()
                        })
                        .catch(function () {
                                /* network error — skip this cycle */
                        })
        }
        // Catch-up poll the moment the visitor returns to the tab (polling is
        // paused while the tab is hidden).
        document.addEventListener('visibilitychange', function () {
                if (!document.hidden && isOpen) pollForNewMessages()
        })

        // ── iOS-proof body scroll lock ─────────────────────────────────
        // overflow:hidden alone does NOT stop background scrolling on iOS
        // Safari — the page behind the sheet still pans with touch and the
        // scroll position can jump. The reliable technique is position:fixed
        // on <body> pinned at the current scroll offset, restored on unlock.
        var bodyLocked = false
        var bodyLockY = 0
        function lockBodyScroll() {
                if (bodyLocked || !document.body) return
                bodyLocked = true
                bodyLockY = window.pageYOffset || document.documentElement.scrollTop || 0
                var bs = document.body.style
                bs.position = 'fixed'
                bs.top = -bodyLockY + 'px'
                bs.left = '0'
                bs.right = '0'
                bs.width = '100%'
                bs.overflow = 'hidden'
        }
        function unlockBodyScroll() {
                if (!bodyLocked || !document.body) return
                bodyLocked = false
                var bs = document.body.style
                bs.position = ''
                bs.top = ''
                bs.left = ''
                bs.right = ''
                bs.width = ''
                bs.overflow = ''
                window.scrollTo(0, bodyLockY)
        }

        // ── Android Back button closes the chat ────────────────────────
        // On phones the panel is a full-screen sheet; users instinctively hit
        // the hardware/gesture Back to leave it. Without this, Back navigates
        // the host page away (losing the chat). We push ONE history entry when
        // the sheet opens and close the sheet on popstate instead.
        var historyPushed = false
        function pushCloseHistory() {
                try {
                        history.pushState({ vgtChat: 1 }, '')
                        historyPushed = true
                } catch (e) {
                        /* history API unavailable — Back simply navigates */
                }
        }
        function popCloseHistory() {
                // Consume our history entry when the sheet is closed via the UI
                // (✕ button / Escape) so a later Back doesn't need two presses.
                if (!historyPushed) return
                historyPushed = false
                try {
                        history.back()
                } catch (e) {}
        }
        window.addEventListener('popstate', function () {
                if (historyPushed) {
                        historyPushed = false
                        if (isOpen) toggle(false)
                }
        })

        function toggle(force) {
                isOpen = force != null ? force : !isOpen
                panel.classList.toggle('vgt-show', isOpen)
                launcher.classList.toggle('vgt-open', isOpen)
                // Also toggle on root so mobile CSS can hide the launcher when
                // the full-screen panel is open.
                root.classList.toggle('vgt-open', isOpen)
                launcher.setAttribute(
                        'aria-label',
                        isOpen ? t('بستن گفتگو', 'Close chat') : t('باز کردن گفتگو', 'Open chat'),
                )
                launcher.setAttribute('aria-expanded', isOpen ? 'true' : 'false')
                if (isOpen) {
                        // Lock body scroll on mobile so the host page can't scroll/peek
                        // behind the full-screen chat (iOS needs position:fixed — see
                        // lockBodyScroll). Also arm the Android Back-button close.
                        if (isMobile()) {
                                lockBodyScroll()
                                pushCloseHistory()
                        }
                        var tz = root.querySelector('.vgt-teaser')
                        if (tz) tz.remove()
                        // Show lead-capture form first if enabled and not yet captured.
                        var showedLead = renderLeadCapture()
                        if (!showedLead && !welcomeShown) {
                                welcomeShown = true
                                renderIntro()
                        }
                        // If the lead form isn't showing and we have a prior conversation,
                        // restore its transcript from the server.
                        if (!showedLead) loadHistory()
                        // Start polling for operator replies every 8s while open.
                        if (!pollTimer) {
                                pollTimer = setInterval(pollForNewMessages, 8000)
                        }
                        // Auto-focus only on desktop — on mobile it would instantly pop
                        // the soft keyboard over the just-opened sheet (jarring double
                        // layout jump before the visitor has even seen the conversation).
                        if (!isMobile()) {
                                setTimeout(function () {
                                        input.focus()
                                }, 80)
                        }
                } else {
                        // Stop polling when the panel closes.
                        if (pollTimer) {
                                clearInterval(pollTimer)
                                pollTimer = null
                        }
                        // Restore body scroll when the panel closes.
                        unlockBodyScroll()
                        popCloseHistory()
                        // Drop any inline height set by the visualViewport handler so
                        // the CSS-defined size takes over again next time the panel opens.
                        panel.style.height = ''
                        panel.style.maxHeight = ''
                }
                applyViewportHeight()
        }

        // ---- Events ----
        sendBtn.addEventListener('click', function () {
                send()
        })
        input.addEventListener('input', autoGrow)
        input.addEventListener('keydown', function (e) {
                // Don't send mid-IME-composition (emoji/CJK keyboards).
                if (e.isComposing) return
                if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        send()
                }
        })
        launcher.addEventListener('click', function () {
                toggle()
        })
        closeBtn.addEventListener('click', function () {
                toggle(false)
        })
        document.addEventListener('keydown', function (e) {
                if (e.key === 'Escape' && isOpen) toggle(false)
        })

        // ---- Mobile keyboard / viewport handling ----
        // When the soft keyboard opens on mobile, `visualViewport.height`
        // shrinks and `visualViewport.offsetTop` may change. We do NOT set
        // a fixed height on the panel — that would conflict with top:0 and
        // leave the bottom of the screen empty (showing the host site).
        // Instead, the mobile CSS uses top:0 + bottom:0 + height:auto so
        // the panel stretches naturally, and here we only adjust `bottom`
        // (and `top` when needed) so the panel's bottom edge sits right
        // above the keyboard. This keeps the panel filling the ENTIRE
        // visible area at all times. Desktop/tablets (>=768px) are a no-op.
        // The breakpoint MUST stay in sync with the @media(max-width:768px)
        // rule in injectStyles.
        function applyViewportHeight() {
                // Always clear inline overrides first so CSS takes over by default.
                panel.style.height = ''
                panel.style.maxHeight = ''
                panel.style.bottom = ''
                panel.style.top = ''

                if (!isOpen || !isMobile() || !window.visualViewport) {
                        // Desktop/tablet or closed — CSS-defined size takes over.
                        return
                }

                // Mobile — compute how much space the keyboard occupies.
                // visualViewport.height = visible area height.
                // visualViewport.offsetTop = how far the visible area is
                //   scrolled relative to the layout viewport (usually 0,
                //   but can be > 0 when the browser chrome shrinks).
                // Keyboard height = innerHeight - offsetTop - height.
                var vv = window.visualViewport
                var kbHeight = window.innerHeight - vv.offsetTop - vv.height

                if (kbHeight > 20) {
                        // Keyboard is open — lift the panel's bottom edge so it
                        // sits just above the keyboard. With top:0 still set,
                        // the panel stretches from the top of the screen to the
                        // top of the keyboard = exactly the visible area.
                        panel.style.setProperty('bottom', kbHeight + 'px', 'important')
                }
                if (vv.offsetTop > 0) {
                        // The visual viewport is scrolled down (e.g. browser
                        // chrome). Adjust top to match.
                        panel.style.setProperty('top', vv.offsetTop + 'px', 'important')
                }
                // Keep the latest message visible.
                scrollDown(true)
        }
        if (window.visualViewport) {
                window.visualViewport.addEventListener('resize', applyViewportHeight)
                window.visualViewport.addEventListener('scroll', applyViewportHeight)
        }
        window.addEventListener('resize', applyViewportHeight)
        window.addEventListener('orientationchange', function () {
                setTimeout(applyViewportHeight, 200)
        })

        // ---- Init ----
        var mounted = false
        var configReady = false

        function reveal() {
                if (!mounted || !configReady) return
                applyConfig()
                root.classList.add('vgt-ready')
                if (!isOpen && config.autoGreet) {
                        var delay =
                                typeof config.autoGreetDelayMs === 'number' && config.autoGreetDelayMs > 0
                                        ? config.autoGreetDelayMs
                                        : 4000
                        setTimeout(showTeaser, delay)
                }
        }
        function mount() {
                if (mounted) return
                mounted = true
                document.body.appendChild(root)
                reveal()
        }
        function markReady() {
                configReady = true
                reveal()
        }
        if (document.body) mount()
        else document.addEventListener('DOMContentLoaded', mount)

        var readyTimer = setTimeout(markReady, 2500)

        fetch(base + '/api/widget/' + agentId)
                .then(function (r) {
                        return r.ok ? r.json() : null
                })
                .then(function (cfg) {
                        if (cfg) {
                                Object.keys(config).forEach(function (k) {
                                        if (cfg[k] != null) config[k] = cfg[k]
                                })
                        }
                        clearTimeout(readyTimer)
                        markReady()
                })
                .catch(function () {
                        clearTimeout(readyTimer)
                        markReady()
                })
})()
