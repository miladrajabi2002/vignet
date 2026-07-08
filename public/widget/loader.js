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
                        return parsed.id
                } catch (e) {
                        return null
                }
        }
        function saveStoredConv(id) {
                try {
                        localStorage.setItem(CONV_STORAGE_KEY, JSON.stringify({ id: id, ts: Date.now() }))
                } catch (e) {
                        /* localStorage may be unavailable (private mode); fail silently */
                }
        }

        var conversationId = loadStoredConv()
        var isOpen = false
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
        // Reply-to (quote) state: when `replyToMessageId` is set, the next sent
        // user message is persisted with that parentId and the LLM is given the
        // quoted text as context. `replyToSnippet` is shown in the preview bar.
        var replyToMessageId = null
        var replyToSnippet = ''
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
                phone:
                        '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
                box: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
                arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
                reply: '<path d="M9 17l-5-5 5-5"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>',
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
                        'transition:opacity .28s ease;font-family:var(--vgt-font);font-size:14px;}' +
                        '.vgt-root.vgt-ready{visibility:visible;opacity:1;}' +
                        '.vgt-root.vgt-right{inset-inline-end:max(20px,env(safe-area-inset-right));}' +
                        '.vgt-root.vgt-left{inset-inline-start:max(20px,env(safe-area-inset-left));}' +
                        '.vgt-root *{box-sizing:border-box;}' +
                        // launcher
                        '.vgt-launcher{position:relative;display:flex;align-items:center;gap:8px;height:58px;padding:0 7px;border:none;cursor:pointer;' +
                        'border-radius:30px;background:linear-gradient(135deg,var(--vgt-accent) 0%,var(--vgt-accent-deep) 100%);' +
                        'color:var(--vgt-on-accent);box-shadow:0 12px 32px -8px var(--vgt-accent-shadow),inset 0 1px 0 rgba(255,255,255,.14);' +
                        'font-family:var(--vgt-font);' +
                        'transition:transform .25s cubic-bezier(.34,1.5,.64,1),box-shadow .25s;}' +
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
                        'box-shadow:0 32px 88px -20px rgba(0,0,0,.42),0 8px 24px -12px rgba(0,0,0,.28),0 0 0 1px rgba(0,0,0,.02);' +
                        'opacity:0;transform:translateY(14px) scale(.97);transform-origin:bottom right;pointer-events:none;' +
                        'transition:opacity .28s ease,transform .32s cubic-bezier(.34,1.28,.64,1);}' +
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
                        '.vgt-body{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;scroll-behavior:smooth;background:var(--vgt-bg);}' +
                        '.vgt-body::-webkit-scrollbar{width:6px;}' +
                        '.vgt-body::-webkit-scrollbar-thumb{background:var(--vgt-border);border-radius:3px;}' +
                        '.vgt-msg{max-width:84%;padding:10px 14px;font-size:14px;line-height:1.65;white-space:pre-wrap;word-wrap:break-word;' +
                        'border-radius:var(--vgt-r-bubble);animation:vgt-in .28s cubic-bezier(.2,.7,.3,1) both;}' +
                        '.vgt-msg.vgt-user{align-self:flex-end;background:linear-gradient(135deg,var(--vgt-accent) 0%,var(--vgt-accent-deep) 100%);' +
                        'color:var(--vgt-on-accent);border-bottom-right-radius:5px;box-shadow:0 4px 12px -4px var(--vgt-accent-shadow);}' +
                        '.vgt-root.vgt-rtl .vgt-msg.vgt-user{border-bottom-right-radius:var(--vgt-r-bubble);border-bottom-left-radius:5px;}' +
                        '.vgt-msg.vgt-bot{align-self:flex-start;background:var(--vgt-surface);color:var(--vgt-text);border-bottom-left-radius:5px;}' +
                        '.vgt-root.vgt-rtl .vgt-msg.vgt-bot{border-bottom-left-radius:var(--vgt-r-bubble);border-bottom-right-radius:5px;}' +
                        '.vgt-msg.vgt-err{background:rgba(239,68,68,.12);color:#ef4444;border:1px solid rgba(239,68,68,.3);align-self:stretch;max-width:100%;text-align:center;font-size:13px;}' +
                        // assistant group (chip + bubble + cards + actions)
                        '.vgt-group{display:flex;flex-direction:column;align-items:flex-start;gap:7px;max-width:100%;}' +
                        '.vgt-group .vgt-msg{animation:none;max-width:84%;}' +
                        '.vgt-group:empty{display:none;}' +
                        // source chip ("از کاتالوگ محصول")
                        '.vgt-source{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;' +
                        'border:1px solid var(--vgt-border);background:var(--vgt-bg);color:var(--vgt-muted);font-size:11px;font-weight:600;' +
                        'animation:vgt-in .3s ease both;}' +
                        '.vgt-source svg{width:12px;height:12px;}' +
                        // product card
                        '.vgt-card{width:min(300px,100%);overflow:hidden;border-radius:var(--vgt-r-bubble);border:1px solid var(--vgt-border);' +
                        'background:var(--vgt-bg);box-shadow:0 10px 30px -14px rgba(0,0,0,.22);animation:vgt-card-in .4s cubic-bezier(.2,.8,.3,1) both;' +
                        'transition:transform .2s ease,box-shadow .2s ease;}' +
                        '.vgt-card:hover{transform:translateY(-2px);box-shadow:0 16px 36px -14px rgba(0,0,0,.3);}' +
                        '.vgt-card-row{display:flex;align-items:center;gap:12px;padding:12px;}' +
                        '.vgt-card-thumb{width:58px;height:58px;flex:0 0 58px;display:flex;align-items:center;justify-content:center;' +
                        'border-radius:14px;background:linear-gradient(135deg,var(--vgt-accent) 0%,var(--vgt-accent-deep) 100%);' +
                        'color:var(--vgt-on-accent);font-size:24px;font-weight:700;box-shadow:0 6px 16px -6px var(--vgt-accent-shadow);}' +
                        '.vgt-card-main{flex:1;min-width:0;}' +
                        '.vgt-card-top{display:flex;align-items:center;gap:6px;min-width:0;}' +
                        '.vgt-card-name{font-size:13.5px;font-weight:700;color:var(--vgt-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
                        '.vgt-card-badge{flex:0 0 auto;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:600;' +
                        'color:var(--vgt-accent-ink);background:var(--vgt-accent-soft);border:1px solid var(--vgt-accent-line);}' +
                        '.vgt-card-desc{margin-top:2px;font-size:11.5px;color:var(--vgt-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
                        '.vgt-card-price{margin-top:5px;font-size:14px;font-weight:800;color:var(--vgt-text);}' +
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
                        '.vgt-intro-ava{width:64px;height:64px;border-radius:22px;display:flex;align-items:center;justify-content:center;' +
                        'background:linear-gradient(135deg,var(--vgt-accent-soft) 0%,transparent 140%);color:var(--vgt-accent);' +
                        'box-shadow:inset 0 0 0 1px var(--vgt-accent-line);animation:vgt-float 4s ease-in-out infinite;}' +
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
                        '.vgt-foot{padding:12px 14px 10px;border-top:1px solid var(--vgt-border);background:var(--vgt-bg);}' +
                        '.vgt-inputwrap{display:flex;gap:6px;align-items:flex-end;background:var(--vgt-surface);border:1.5px solid var(--vgt-border);' +
                        'border-radius:var(--vgt-r-input);padding:5px;padding-inline-start:16px;transition:border-color .18s,box-shadow .18s,background .18s;}' +
                        '.vgt-inputwrap:focus-within{border-color:var(--vgt-accent);box-shadow:0 0 0 4px var(--vgt-accent-soft);background:var(--vgt-bg);}' +
                        // font-size:16px — see .vgt-lead-input (iOS auto-zoom guard).
                        '.vgt-input{flex:1;background:transparent;border:none;outline:none;resize:none;color:var(--vgt-text);font-family:inherit;' +
                        'font-size:16px;line-height:1.55;max-height:110px;min-height:24px;padding:9px 0;margin:0;}' +
                        '.vgt-input::placeholder{color:var(--vgt-muted);opacity:1;}' +
                        // 44px touch target (was 40px).
                        '.vgt-send{flex:0 0 44px;width:44px;height:44px;border:none;cursor:pointer;border-radius:50%;' +
                        'background:linear-gradient(135deg,var(--vgt-accent) 0%,var(--vgt-accent-deep) 100%);' +
                        'color:var(--vgt-on-accent);display:flex;align-items:center;justify-content:center;' +
                        'transition:transform .2s cubic-bezier(.34,1.5,.64,1),opacity .15s,box-shadow .2s;' +
                        'box-shadow:0 6px 16px -4px var(--vgt-accent-shadow);}' +
                        '.vgt-send:hover{transform:scale(1.1) rotate(-8deg);box-shadow:0 10px 24px -6px var(--vgt-accent-shadow);}' +
                        '.vgt-send:active{transform:scale(.9);}' +
                        '.vgt-send:disabled{opacity:.35;cursor:default;transform:none;box-shadow:none;}' +
                        '.vgt-send svg{width:19px;height:19px;transition:transform .2s;}' +
                        '.vgt-root.vgt-rtl .vgt-send svg{transform:scaleX(-1);}' +
                        '.vgt-root.vgt-rtl .vgt-send:hover svg{transform:scaleX(-1) translateX(2px);}' +
                        '.vgt-brand{text-align:center;font-size:11px;color:var(--vgt-muted);padding-top:9px;}' +
                        '.vgt-brand a{color:var(--vgt-muted);text-decoration:none;font-weight:600;}' +
                        // teaser (auto-greet)
                        '.vgt-teaser{position:absolute;bottom:76px;max-width:260px;background:var(--vgt-bg);color:var(--vgt-text);' +
                        'border:1px solid var(--vgt-border);border-radius:16px;padding:13px 32px 13px 15px;font-size:13.5px;line-height:1.6;cursor:pointer;' +
                        'box-shadow:0 16px 44px -12px rgba(0,0,0,.4);animation:vgt-teaser-in .45s cubic-bezier(.34,1.4,.64,1) both;' +
                        'transition:transform .2s;}' +
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
                        // Quote block rendered above a bubble that is itself a reply.
                        '.vgt-quote{font-size:12px;line-height:1.45;color:var(--vgt-muted);background:var(--vgt-surface);border-inline-start:3px solid var(--vgt-accent);' +
                        'border-radius:6px;padding:5px 9px;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
                        '.vgt-bubble-wrap.vgt-user .vgt-quote{border-inline-start:none;border-inline-end:3px solid var(--vgt-accent);}' +
                        // Reply affordance button — appears above the bubble on hover (desktop)
                        // or after a long-press (mobile). Hidden by default to keep the UI calm.
                        '.vgt-reply-btn{position:absolute;top:-28px;opacity:0;pointer-events:none;' +
                        'border:1px solid var(--vgt-border);background:var(--vgt-bg);color:var(--vgt-muted);cursor:pointer;' +
                        'border-radius:8px;width:30px;height:30px;min-width:30px;min-height:30px;padding:0;display:flex;align-items:center;justify-content:center;' +
                        'box-shadow:0 4px 12px -4px rgba(0,0,0,.25);transition:opacity .15s,background .15s,color .15s;}' +
                        '.vgt-reply-btn svg{width:14px;height:14px;}' +
                        '.vgt-bubble-wrap.vgt-user .vgt-reply-btn{inset-inline-end:2px;}' +
                        '.vgt-bubble-wrap.vgt-bot .vgt-reply-btn{inset-inline-start:2px;}' +
                        '.vgt-bubble-wrap:hover .vgt-reply-btn,.vgt-reply-btn.vgt-show{opacity:1;pointer-events:auto;}' +
                        '.vgt-reply-btn:hover{background:var(--vgt-surface);color:var(--vgt-accent);}' +
                        '.vgt-root.vgt-rtl .vgt-reply-btn svg{transform:scaleX(-1);}' +
                        // Reply preview bar above the input — shows the quoted snippet + ✕ to cancel.
                        '.vgt-reply-bar{display:none;align-items:center;gap:8px;margin-bottom:6px;padding:8px 10px;border:1.5px solid var(--vgt-border);' +
                        'border-radius:var(--vgt-r-input);background:var(--vgt-surface);border-inline-start:3px solid var(--vgt-accent);}' +
                        '.vgt-reply-bar.vgt-show{display:flex;}' +
                        '.vgt-reply-bar-icon{flex:0 0 18px;color:var(--vgt-accent);}' +
                        '.vgt-reply-bar-icon svg{width:18px;height:18px;}' +
                        '.vgt-reply-bar-text{flex:1;min-width:0;font-size:12.5px;line-height:1.4;color:var(--vgt-muted);' +
                        'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
                        '.vgt-reply-bar-x{flex:0 0 28px;width:28px;height:28px;min-width:28px;min-height:28px;border:none;background:transparent;' +
                        'color:var(--vgt-muted);cursor:pointer;border-radius:6px;display:flex;align-items:center;justify-content:center;transition:background .15s,color .15s;}' +
                        '.vgt-reply-bar-x:hover{background:var(--vgt-bg);color:var(--vgt-text);}' +
                        '.vgt-reply-bar-x svg{width:14px;height:14px;}' +
                        '@media (max-width:600px){' +
                        // On mobile the panel becomes a TRUE full-screen sheet. We switch
                        // from position:absolute (relative to the 0×0 .vgt-root point, which
                        // would give the panel 0 height) to position:fixed (relative to the
                        // viewport) so top:0/bottom:0 actually stretch to full screen height.
                        '.vgt-panel{position:fixed!important;width:100vw!important;height:100dvh!important;max-height:100dvh!important;' +
                        'top:0!important;left:0!important;right:0!important;bottom:0!important;border-radius:0!important;' +
                        'border:none!important;box-shadow:none!important;' +
                        'transform:none!important;transition:opacity .2s ease!important;' +
                        'padding-bottom:env(safe-area-inset-bottom)!important;}' +
                        '.vgt-panel.vgt-show{transform:none!important;}' +
                        // Header: respect the notch / Dynamic Island.
                        '.vgt-head{padding-top:max(12px,env(safe-area-inset-top))!important;min-height:56px!important;}' +
                        // Make the close button bigger and always visible on mobile.
                        '.vgt-close{padding:10px!important;min-width:44px!important;min-height:44px!important;' +
                        'display:flex!important;align-items:center!important;justify-content:center!important;}' +
                        '.vgt-close svg{width:22px!important;height:22px!important;}' +
                        // Body grows to fill the screen.
                        '.vgt-body{flex:1!important;min-height:0!important;}' +
                        // Input bar clears the home indicator.
                        '.vgt-input-bar{padding-bottom:max(8px,env(safe-area-inset-bottom))!important;}' +
                        // Hide the launcher while the full-screen panel is open so it
                        // doesn't float over the conversation.
                        '.vgt-root.vgt-open .vgt-launcher{display:none!important;}' +
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
        // Reply-to preview bar — shown above the input when the visitor has
        // tapped the reply affordance on a previous message. Mirrors the
        // WhatsApp/Telegram "replying to…" strip.
        var replyBar = el('div', 'vgt-reply-bar')
        var replyBarIcon = el('span', 'vgt-reply-bar-icon', svg('reply'))
        var replyBarText = el('span', 'vgt-reply-bar-text')
        var replyBarX = el('button', 'vgt-reply-bar-x', svg('close'))
        replyBarX.setAttribute('aria-label', t('لغو پاسخ', 'Cancel reply'))
        replyBarX.addEventListener('click', function () {
                clearReply()
        })
        replyBar.appendChild(replyBarIcon)
        replyBar.appendChild(replyBarText)
        replyBar.appendChild(replyBarX)
        var inputWrap = el('div', 'vgt-inputwrap')
        var input = el('textarea', 'vgt-input')
        input.rows = 1
        var sendBtn = el('button', 'vgt-send', svg('send'))
        sendBtn.setAttribute('aria-label', 'send')
        inputWrap.appendChild(input)
        inputWrap.appendChild(sendBtn)
        foot.appendChild(replyBar)
        foot.appendChild(inputWrap)
        foot.appendChild(
                el(
                        'div',
                        'vgt-brand',
                        'Powered by <a href="https://vigent.ir" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;vertical-align:middle;"><svg viewBox="174 298 692 126" height="11" style="display:inline-block;fill:currentColor;" xmlns="http://www.w3.org/2000/svg" aria-label="Vigent"><g transform="matrix(2.4635 0 0 2.4635 512 360.934)"><g transform="translate(-111.996 0)"><path transform="translate(-100 -95.9747)" d="M 120.484 70.7747 L 104.14 107.2787 L 106.156 111.3827 L 124.3 70.7747 Z M 100.108 116.4227 L 99.1 114.3347 L 96.364 108.0707 L 79.732 70.7747 L 75.7 70.7747 L 98.164 121.1747 L 102.196 121.1747 L 102.052 120.8147 Z"/></g><g transform="translate(-76.644 0)"><path transform="translate(-100 -95.9747)" d="M 101.836 78.5507 L 101.836 70.7747 L 98.164 70.7747 L 98.164 78.5507 Z M 101.836 121.1747 L 101.836 86.7587 L 98.164 86.7587 L 98.164 121.1747 Z"/></g><g transform="translate(-40.14 0)"><path transform="translate(-98.236 -95.9747)" d="M 116.776 117.7187 C 118.072 116.9987 119.224 116.0627 120.304 115.0547 L 120.304 96.1907 L 116.776 96.1907 Z M 90.784 76.6787 C 94.24 74.7347 98.128 73.7987 102.448 73.7987 C 105.616 73.7987 108.496 74.3027 111.16 75.2387 C 113.752 76.1747 116.128 77.6867 118.216 79.7747 L 120.52 77.3267 C 118.288 75.0947 115.624 73.3667 112.6 72.2147 C 109.504 70.9907 106.048 70.4147 102.376 70.4147 C 97.336 70.4147 92.8 71.4947 88.84 73.7267 C 84.808 75.9587 81.64 78.9827 79.408 82.8707 C 77.104 86.7587 75.952 91.1507 75.952 95.9747 C 75.952 100.7987 77.104 105.1907 79.408 109.0787 C 81.64 112.9667 84.808 115.9907 88.84 118.2227 C 92.8 120.4547 97.336 121.5347 102.304 121.5347 C 104.68 121.5347 106.912 121.1747 109.072 120.6707 L 109.072 117.2867 C 107.056 117.8627 104.824 118.1507 102.448 118.1507 C 98.128 118.1507 94.24 117.2147 90.784 115.2707 C 87.328 113.3267 84.592 110.6627 82.648 107.2787 C 80.632 103.8947 79.624 100.0787 79.624 95.9747 C 79.624 91.7987 80.632 88.0547 82.576 84.6707 C 84.52 81.2147 87.256 78.6227 90.784 76.6787 Z"/></g><g transform="translate(14.364 0)"><path transform="translate(-101.008 -95.9747)" d="M 117.316 74.0867 L 117.316 70.7747 L 84.7 70.7747 L 84.7 74.0867 Z M 117.316 121.1747 L 117.316 117.8627 L 84.7 117.8627 L 84.7 121.1747 Z M 117.316 97.1987 L 117.316 93.9587 L 95.5 93.9587 L 95.5 97.1987 Z M 88.084 81.2147 L 84.7 81.2147 L 84.7 109.9427 L 88.084 109.9427 Z"/></g><g transform="translate(66.744 0)"><path transform="translate(-100 -95.9747)" d="M 79.48 121.1747 L 83.152 121.1747 L 83.152 86.1827 L 79.48 81.2147 Z M 116.848 70.7747 L 116.848 114.5507 L 82.576 70.7747 L 79.48 70.7747 L 79.48 72.5027 L 83.152 77.3987 L 117.496 121.1747 L 120.52 121.1747 L 120.52 70.7747 Z"/></g><g transform="translate(116.316 0)"><path transform="translate(-100 -95.9747)" d="M 80.02 70.7747 L 80.02 74.0867 L 119.98 74.0867 L 119.98 70.7747 Z M 101.836 121.1747 L 101.836 81.1427 L 98.164 81.1427 L 98.164 121.1747 Z"/></g></g></svg></a>',
                ),
        )

        panel.appendChild(head)
        panel.appendChild(body)
        panel.appendChild(foot)

        var launcher = el('button', 'vgt-launcher')
        launcher.setAttribute('aria-label', 'open chat')
        var launcherIco = el(
                'span',
                'vgt-launcher-ico',
                svg('chat', 'vgt-l-main') + svg('close', 'vgt-l-close'),
        )
        launcher.appendChild(launcherIco)

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
                s.setProperty('--vgt-bg', dark ? '#0e0e11' : '#ffffff')
                s.setProperty('--vgt-head-bg', dark ? '#161619' : '#fbfbfc')
                s.setProperty('--vgt-surface', dark ? '#1c1c21' : '#f3f4f6')
                s.setProperty('--vgt-text', dark ? '#f3f4f6' : '#1a1a1e')
                s.setProperty('--vgt-muted', dark ? '#8b8b94' : '#9298a3')
                s.setProperty('--vgt-border', dark ? 'rgba(255,255,255,.09)' : 'rgba(17,17,20,.08)')
                s.setProperty('--vgt-font', FONT_FAMILY[config.font] || FONT_FAMILY.vazirmatn)

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
                body.innerHTML = ''
                var lead = el('div', 'vgt-lead')
                lead.appendChild(el('div', 'vgt-lead-ava', svg('bot')))
                var msg =
                        config.leadCaptureMessage ||
                        t(
                                'سلام! من ' +
                                        config.name +
                                        ' هستم، دستیار هوش مصنوعی این مجموعه و آماده‌ام به سؤالات شما پاسخ بدهم. برای شروع گفتگو لطفاً خودتان را معرفی کنید.',
                                "Hi! I'm " +
                                        config.name +
                                        ', the AI assistant here, ready to answer your questions. To start, please introduce yourself.',
                        )
                lead.appendChild(el('div', 'vgt-lead-text', msg))
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
                                body.innerHTML = ''
                                introVisible = false
                                renderIntro()
                        })
                        lead.appendChild(skipBtn)
                }
                body.appendChild(lead)
                setTimeout(function () {
                        nameInput.focus()
                }, 80)

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
                        // Permissive: accept digits, +, spaces, dashes; min 6 digits.
                        var digits = phone.replace(/\D/g, '')
                        if (digits.length < 6) {
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
                        scrollDown()
                        return b
                }
                // Wrap user/bot bubbles so we can attach an optional quote block
                // (when replying) + a reply affordance button + long-press handler.
                var side = role === 'user' ? 'user' : 'bot'
                var wrap = el('div', 'vgt-bubble-wrap vgt-' + side)
                if (opts.id) wrap.setAttribute('data-message-id', opts.id)
                if (opts.quote) {
                        var q = el('div', 'vgt-quote')
                        q.textContent = opts.quote
                        wrap.appendChild(q)
                }
                wrap.appendChild(b)
                if (opts.id) attachReplyAffordance(wrap, side, opts.id)
                body.appendChild(wrap)
                scrollDown()
                return b
        }
        function scrollDown() {
                body.scrollTop = body.scrollHeight
        }
        function showTyping() {
                var node = el(
                        'div',
                        'vgt-msg vgt-bot vgt-typing',
                        '<span></span><span></span><span></span>',
                )
                body.appendChild(node)
                scrollDown()
                return node
        }
        function setStreaming(on) {
                streaming = on
                sendBtn.disabled = on
        }

        // ---- Reply-to (quote) helpers ----
        /** Collapse whitespace and trim to `n` chars with an ellipsis. */
        function truncate(s, n) {
                s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim()
                return s.length > n ? s.slice(0, n) + '…' : s
        }

        /** Pull the latest text of a bubble/group container: prefers the raw
            markdown source (data-raw, set by renderAssistantGroup) and falls
            back to textContent. */
        function getMessageText(container) {
                var msg = container.querySelector('.vgt-msg')
                if (!msg) return ''
                var raw = msg.getAttribute('data-raw')
                if (raw != null && raw !== '') return raw
                return msg.textContent || ''
        }

        /** Enter reply mode: stash the target message id + snippet, show the
            preview bar above the input, and focus the input so the visitor
            can start typing immediately. */
        function startReply(messageId, text) {
                replyToMessageId = messageId
                replyToSnippet = truncate(text, 60)
                replyBarText.textContent = replyToSnippet
                replyBar.classList.add('vgt-show')
                try {
                        input.focus()
                } catch (e) {
                        /* input may not be focusable yet (panel still closed) */
                }
        }

        /** Exit reply mode and hide the preview bar. */
        function clearReply() {
                replyToMessageId = null
                replyToSnippet = ''
                replyBar.classList.remove('vgt-show')
                replyBarText.textContent = ''
                // Also dismiss any reply buttons that were pinned open by a
                // long-press, so the next bubble starts from a clean state.
                var pinned = body.querySelectorAll('.vgt-reply-btn.vgt-show')
                for (var i = 0; i < pinned.length; i++) {
                        pinned[i].classList.remove('vgt-show')
                }
        }

        /** Attach the reply affordance (hover button + long-press) to a bubble
            wrapper (user) or assistant group (bot). No-op if `messageId` is
            missing — live user messages don't get an id client-side. */
        function attachReplyAffordance(container, side, messageId) {
                if (!messageId || !container) return
                if (container.getAttribute('data-reply-bound') === '1') return
                container.setAttribute('data-reply-bound', '1')
                container.setAttribute('data-message-id', messageId)

                // Hover/tap reply button (desktop).
                var btn = el('button', 'vgt-reply-btn', svg('reply'))
                btn.type = 'button'
                btn.setAttribute('aria-label', t('پاسخ', 'Reply'))
                btn.addEventListener('click', function (e) {
                        e.stopPropagation()
                        startReply(messageId, getMessageText(container))
                })
                container.appendChild(btn)

                // Long-press to reply (mobile — no hover available). 500ms holds
                // the finger down without scrolling; cancels on move/end before
                // the threshold so a normal tap or scroll never triggers it.
                var timer = null
                var longPressFired = false
                container.addEventListener('touchstart', function () {
                        longPressFired = false
                        timer = setTimeout(function () {
                                timer = null
                                longPressFired = true
                                btn.classList.add('vgt-show')
                                startReply(messageId, getMessageText(container))
                        }, 500)
                }, { passive: true })
                function cancel() {
                        if (timer) {
                                clearTimeout(timer)
                                timer = null
                        }
                }
                container.addEventListener('touchmove', cancel, { passive: true })
                container.addEventListener('touchend', cancel, { passive: true })
                container.addEventListener('touchcancel', cancel, { passive: true })
                // Suppress the native iOS long-press callout/context menu when
                // our long-press just fired; tap-and-hold text selection still
                // works otherwise.
                container.addEventListener('contextmenu', function (e) {
                        if (longPressFired) {
                                e.preventDefault()
                                longPressFired = false
                        }
                })
        }

        // ---- Product cards ([[product:{…}]] tokens in the AI reply) ----
        var PRODUCT_TOKEN = /\[\[product:(\{[\s\S]*?\})\]\]/g

        /** Split a raw assistant string into visible text + parsed product cards,
            holding back a trailing partial token while streaming. */
        function parseAssistant(raw, done) {
                var cards = []
                var text = raw.replace(PRODUCT_TOKEN, function (m, json) {
                        try {
                                var p = JSON.parse(json)
                                if (p && typeof p.name === 'string' && p.name) {
                                        cards.push({
                                                name: String(p.name).slice(0, 80),
                                                price: p.price != null ? String(p.price).slice(0, 40) : '',
                                                desc: p.desc != null ? String(p.desc).slice(0, 90) : '',
                                                badge: p.badge != null ? String(p.badge).slice(0, 20) : '',
                                        })
                                }
                        } catch (e) {
                                /* malformed token — drop it silently */
                        }
                        return ''
                })
                // While streaming, hold back an unterminated trailing token so it never
                // flashes as raw text; once done, whatever remains is real text.
                if (!done) {
                        var tail = text.lastIndexOf('[[')
                        if (tail !== -1 && text.indexOf(']]', tail) === -1) {
                                text = text.slice(0, tail)
                        }
                }
                return { text: text.replace(/\n{3,}/g, '\n\n').trim(), cards: cards }
        }

        function renderCard(p) {
                var card = el('div', 'vgt-card')
                var row = el('div', 'vgt-card-row')
                var initial = (p.name || '؟').trim().charAt(0)
                row.appendChild(el('div', 'vgt-card-thumb', '')).textContent = initial
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
                if (p.price) {
                        var price = el('div', 'vgt-card-price')
                        price.textContent = p.price
                        main.appendChild(price)
                }
                row.appendChild(main)
                card.appendChild(row)
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

                // cards — append only new ones (already-rendered count tracked on the node)
                var rendered = Number(group.getAttribute('data-cards') || 0)
                for (var i = rendered; i < parsed.cards.length; i++) {
                        group.appendChild(renderCard(parsed.cards[i]))
                }
                if (parsed.cards.length !== rendered) {
                        group.setAttribute('data-cards', String(parsed.cards.length))
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
                // Snapshot the active reply-to state before clearing it: the
                // user bubble we're about to render needs the quote snippet,
                // and the POST payload needs the id.
                var activeReplyId = replyToMessageId
                var activeReplySnippet = replyToSnippet
                if (preset == null) {
                        input.value = ''
                        autoGrow()
                }
                clearIntro()
                bubble('user', text, {
                        quote: activeReplyId ? activeReplySnippet : null,
                })
                clearReply()
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
                if (conversationId) payload.conversationId = conversationId
                // Attach the lead-form identity to the first message so the server can
                // create/attach the CRM contact and greet the visitor by name.
                if (!visitorSent && (visitorName || visitorPhone)) {
                        if (visitorName) payload.visitorName = visitorName
                        if (visitorPhone) payload.visitorPhone = visitorPhone
                        visitorSent = true
                }
                // Reply-to (quote): when set, the server persists this USER message
                // with `parentId = replyToMessageId` and includes the quoted text in
                // the LLM context so the model knows what's being replied to.
                if (activeReplyId) payload.replyToMessageId = activeReplyId
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
                                                                                saveStoredConv(conversationId)
                                                                        }
                                                                } else if (evt.type === 'delta') {
                                                                        raw += evt.text
                                                                        renderAssistantGroup(ensureGroup(), raw, false)
                                                                } else if (evt.type === 'done') {
                                                                        if (group) renderAssistantGroup(group, raw, true)
                                                                        // The server emits the persisted assistant message id on
                                                                        // `done`; bind it to the group so the visitor can quote
                                                                        // this reply in a follow-up.
                                                                        if (group && evt.messageId) {
                                                                                attachReplyAffordance(group, 'bot', evt.messageId)
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
                if (historyLoaded || !conversationId) return
                historyLoaded = true
                fetch(
                        base +
                                '/api/widget/' +
                                agentId +
                                '/chat?conversationId=' +
                                encodeURIComponent(conversationId),
                        {
                                method: 'GET',
                                headers: { Accept: 'application/json' },
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
                                                        // Show the quoted parent text above this bubble if
                                                        // the visitor had replied to an earlier message.
                                                        quote: m.parentId && m.parentContent
                                                                ? truncate(m.parentContent, 60)
                                                                : null,
                                                })
                                        } else {
                                                var g = el('div', 'vgt-group')
                                                body.appendChild(g)
                                                renderAssistantGroup(g, m.content, true)
                                                // Bind the message id so visitors can quote this
                                                // assistant reply in a follow-up.
                                                if (m.id) attachReplyAffordance(g, 'bot', m.id)
                                        }
                                })
                                scrollDown()
                        })
                        .catch(function () {
                                /* network error — continue with empty transcript */
                        })
        }

        function toggle(force) {
                isOpen = force != null ? force : !isOpen
                panel.classList.toggle('vgt-show', isOpen)
                launcher.classList.toggle('vgt-open', isOpen)
                // Also toggle on root so mobile CSS can hide the launcher when
                // the full-screen panel is open.
                root.classList.toggle('vgt-open', isOpen)
                launcher.setAttribute('aria-label', isOpen ? 'close chat' : 'open chat')
                if (isOpen) {
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
                        setTimeout(function () {
                                input.focus()
                        }, 80)
                } else {
                        // Drop any inline height set by the visualViewport handler so
                        // the CSS-defined size takes over again next time the panel opens.
                        panel.style.height = ''
                        panel.style.maxHeight = ''
                        // Also exit reply mode — leaving the panel mid-reply shouldn't
                        // keep the preview bar pinned open.
                        clearReply()
                }
                applyViewportHeight()
        }

        // ---- Events ----
        sendBtn.addEventListener('click', function () {
                send()
        })
        input.addEventListener('input', autoGrow)
        input.addEventListener('keydown', function (e) {
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
        // shrinks below layout-viewport height. Pin the panel to that smaller
        // height so the input stays visible and the message list scrolls
        // within the unoccluded area. Desktop and tablets (>=600px wide) keep
        // the CSS-defined size; the handler is a no-op there.
        function applyViewportHeight() {
                if (
                        !isOpen ||
                        !window.visualViewport ||
                        typeof window.innerWidth !== 'number' ||
                        window.innerWidth >= 600
                ) {
                        // Clear any inline height so CSS (100dvh on mobile, 620px on
                        // desktop) takes over. On mobile the panel is position:fixed
                        // with height:100dvh, so we must NOT override it with inline
                        // styles — let the CSS handle the full-screen sizing.
                        panel.style.height = ''
                        panel.style.maxHeight = ''
                        return
                }
                // On mobile, when the keyboard opens, visualViewport.height shrinks.
                // Instead of overriding the panel height (which fights the 100dvh
                // CSS), we scroll the message body to keep the latest bubble visible.
                // The panel stays full-screen; only the body scrolls.
                scrollDown()
        }
        if (window.visualViewport) {
                window.visualViewport.addEventListener('resize', applyViewportHeight)
                window.visualViewport.addEventListener('scroll', applyViewportHeight)
        }
        window.addEventListener('resize', applyViewportHeight)

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
