/* Vigent Web Widget loader — embed with:
   <script src="https://your-domain/widget/loader.js" data-agent-id="AGENT_ID"></script>
   Zero dependencies. Material / minimal. Themeable from the dashboard
   (color, light/dark, position, font, icon, subtitle, corners, lead capture). */
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
	function clearStoredConv() {
		try {
			localStorage.removeItem(CONV_STORAGE_KEY)
		} catch (e) {}
	}

	var conversationId = loadStoredConv()
	var isOpen = false
	var streaming = false
	var introVisible = false
	var teaserShown = false
	var welcomeShown = false
	var leadCaptured = false
	var config = {
		name: 'Vigent',
		welcomeMessage: '',
		language: 'fa',
		theme: 'dark',
		primaryColor: '#0F0F10',
		position: 'right',
		launcherLabel: null,
		avatar: null,
		font: 'vazirmatn',
		icon: 'chat',
		subtitle: null,
		corners: 'soft',
		cornerRadius: 0,
		autoGreet: false,
		autoGreetDelayMs: 4000,
		leadCapture: false,
		leadCaptureMessage: null,
	}

	function isRtl() {
		return config.language === 'fa'
	}
	function t(fa, en) {
		return isRtl() ? fa : en
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
			'.vgt-root{position:fixed;bottom:20px;z-index:2147483000;direction:ltr;visibility:hidden;opacity:0;' +
			'transition:opacity .28s ease;font-family:var(--vgt-font);font-size:14px;}' +
			'.vgt-root.vgt-ready{visibility:visible;opacity:1;}' +
			'.vgt-root.vgt-right{inset-inline-end:20px;}' +
			'.vgt-root.vgt-left{inset-inline-start:20px;}' +
			'.vgt-root *{box-sizing:border-box;}' +
			// launcher
			'.vgt-launcher{display:flex;align-items:center;gap:8px;height:58px;padding:0 7px;border:none;cursor:pointer;' +
			'border-radius:30px;background:var(--vgt-accent);color:var(--vgt-on-accent);box-shadow:0 12px 32px -8px var(--vgt-accent-shadow);' +
			'font-family:var(--vgt-font);' +
			'transition:transform .25s cubic-bezier(.34,1.5,.64,1),box-shadow .25s;}' +
			'.vgt-launcher:hover{transform:translateY(-2px) scale(1.03);box-shadow:0 18px 42px -10px var(--vgt-accent-shadow);}' +
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
			// panel
			'.vgt-panel{position:absolute;bottom:74px;width:384px;max-width:calc(100vw - 32px);height:600px;' +
			'max-height:calc(100vh - 120px);display:flex;flex-direction:column;overflow:hidden;border-radius:var(--vgt-r-panel);' +
			'background:var(--vgt-bg);color:var(--vgt-text);border:1px solid var(--vgt-border);' +
			'box-shadow:0 28px 80px -18px rgba(0,0,0,.45),0 8px 24px -12px rgba(0,0,0,.3);' +
			'opacity:0;transform:translateY(14px) scale(.97);transform-origin:bottom right;pointer-events:none;' +
			'transition:opacity .28s ease,transform .32s cubic-bezier(.34,1.28,.64,1);}' +
			'.vgt-root.vgt-left .vgt-panel{transform-origin:bottom left;right:auto;left:0;}' +
			'.vgt-root.vgt-right .vgt-panel{right:0;}' +
			'.vgt-panel.vgt-show{opacity:1;transform:translateY(0) scale(1);pointer-events:auto;}' +
			// header
			'.vgt-head{display:flex;align-items:center;gap:12px;padding:14px 16px;background:var(--vgt-head-bg);' +
			'border-bottom:1px solid var(--vgt-border);}' +
			'.vgt-ava{position:relative;width:40px;height:40px;flex:0 0 40px;border-radius:50%;display:flex;align-items:center;' +
			'justify-content:center;background:var(--vgt-accent-soft);color:var(--vgt-accent);overflow:visible;}' +
			'.vgt-ava img{width:100%;height:100%;object-fit:cover;border-radius:50%;}' +
			'.vgt-ava svg{width:22px;height:22px;}' +
			'.vgt-ava-dot{position:absolute;bottom:-1px;inset-inline-end:-1px;width:11px;height:11px;border-radius:50%;' +
			'background:#22c55e;border:2px solid var(--vgt-head-bg);box-shadow:0 0 0 2px rgba(34,197,94,.3);' +
			'animation:vgt-pulse 2.4s ease-in-out infinite;}' +
			'.vgt-head-meta{flex:1;min-width:0;}' +
			'.vgt-head-title{font-weight:700;font-size:15px;line-height:1.25;color:var(--vgt-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
			'.vgt-head-sub{font-size:12.5px;color:var(--vgt-muted);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;gap:5px;}' +
			'.vgt-close{background:transparent;border:none;color:var(--vgt-muted);cursor:pointer;padding:7px;border-radius:10px;' +
			'display:flex;transition:background .15s,color .15s;}' +
			'.vgt-close:hover{background:var(--vgt-surface);color:var(--vgt-text);}' +
			'.vgt-close svg{width:18px;height:18px;}' +
			// body
			'.vgt-body{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;scroll-behavior:smooth;background:var(--vgt-bg);}' +
			'.vgt-body::-webkit-scrollbar{width:6px;}' +
			'.vgt-body::-webkit-scrollbar-thumb{background:var(--vgt-border);border-radius:3px;}' +
			'.vgt-msg{max-width:82%;padding:10px 14px;font-size:14px;line-height:1.65;white-space:pre-wrap;word-wrap:break-word;' +
			'border-radius:var(--vgt-r-bubble);animation:vgt-in .28s cubic-bezier(.2,.7,.3,1) both;}' +
			'.vgt-msg.vgt-user{align-self:flex-end;background:var(--vgt-accent);color:var(--vgt-on-accent);border-bottom-right-radius:5px;' +
			'box-shadow:0 4px 12px -4px var(--vgt-accent-shadow);}' +
			'.vgt-root.vgt-rtl .vgt-msg.vgt-user{border-bottom-right-radius:var(--vgt-r-bubble);border-bottom-left-radius:5px;}' +
			'.vgt-msg.vgt-bot{align-self:flex-start;background:var(--vgt-surface);color:var(--vgt-text);border-bottom-left-radius:5px;}' +
			'.vgt-root.vgt-rtl .vgt-msg.vgt-bot{border-bottom-left-radius:var(--vgt-r-bubble);border-bottom-right-radius:5px;}' +
			'.vgt-msg.vgt-err{background:rgba(239,68,68,.12);color:#ef4444;border:1px solid rgba(239,68,68,.3);align-self:stretch;max-width:100%;text-align:center;font-size:13px;}' +
			// intro
			'.vgt-intro{display:flex;flex-direction:column;align-items:center;text-align:center;gap:14px;margin:auto;padding:24px 12px;animation:vgt-in .35s ease both;}' +
			'.vgt-intro-ava{width:64px;height:64px;border-radius:50%;display:flex;align-items:center;justify-content:center;' +
			'background:var(--vgt-accent-soft);color:var(--vgt-accent);animation:vgt-float 4s ease-in-out infinite;}' +
			'.vgt-intro-ava svg{width:32px;height:32px;}' +
			'.vgt-intro-text{font-size:15.5px;font-weight:500;line-height:1.6;color:var(--vgt-text);max-width:280px;}' +
			// lead capture
			'.vgt-lead{display:flex;flex-direction:column;align-items:center;text-align:center;gap:14px;margin:auto;padding:24px 18px;animation:vgt-in .35s ease both;}' +
			'.vgt-lead-ava{width:56px;height:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;' +
			'background:var(--vgt-accent-soft);color:var(--vgt-accent);}' +
			'.vgt-lead-ava svg{width:28px;height:28px;}' +
			'.vgt-lead-text{font-size:14px;line-height:1.7;color:var(--vgt-text);max-width:280px;}' +
			'.vgt-lead-form{width:100%;display:flex;flex-direction:column;gap:8px;}' +
			'.vgt-lead-input{width:100%;border:1.5px solid var(--vgt-border);background:var(--vgt-surface);color:var(--vgt-text);' +
			'border-radius:var(--vgt-r-input);padding:11px 14px;font-family:inherit;font-size:14px;outline:none;transition:border-color .18s,box-shadow .18s;' +
			'text-align:center;direction:ltr;}' +
			'.vgt-lead-input:focus{border-color:var(--vgt-accent);box-shadow:0 0 0 4px var(--vgt-accent-soft);}' +
			'.vgt-lead-btn{border:none;cursor:pointer;border-radius:var(--vgt-r-input);padding:11px;background:var(--vgt-accent);' +
			'color:var(--vgt-on-accent);font-family:inherit;font-size:14px;font-weight:600;transition:transform .15s,opacity .15s;' +
			'box-shadow:0 6px 18px -6px var(--vgt-accent-shadow);}' +
			'.vgt-lead-btn:hover{transform:translateY(-1px);}.vgt-lead-btn:active{transform:translateY(0);}' +
			'.vgt-lead-btn:disabled{opacity:.5;cursor:default;}' +
			'.vgt-lead-skip{background:transparent;border:none;color:var(--vgt-muted);font-family:inherit;font-size:12px;cursor:pointer;padding:4px;}' +
			'.vgt-lead-skip:hover{color:var(--vgt-text);}' +
			// typing
			'.vgt-typing{display:flex!important;flex-direction:row!important;gap:4px;align-items:center;padding:14px 16px;}' +
			'.vgt-typing span{width:7px;height:7px;border-radius:50%;background:var(--vgt-muted);animation:vgt-bounce 1.2s infinite;}' +
			'.vgt-typing span:nth-child(2){animation-delay:.18s;}.vgt-typing span:nth-child(3){animation-delay:.36s;}' +
			// input
			'.vgt-foot{padding:12px 14px 10px;border-top:1px solid var(--vgt-border);background:var(--vgt-bg);}' +
			'.vgt-inputwrap{display:flex;gap:6px;align-items:flex-end;background:var(--vgt-surface);border:1.5px solid var(--vgt-border);' +
			'border-radius:var(--vgt-r-input);padding:5px;padding-inline-start:16px;transition:border-color .18s,box-shadow .18s,background .18s;}' +
			'.vgt-inputwrap:focus-within{border-color:var(--vgt-accent);box-shadow:0 0 0 4px var(--vgt-accent-soft);background:var(--vgt-bg);}' +
			'.vgt-input{flex:1;background:transparent;border:none;outline:none;resize:none;color:var(--vgt-text);font-family:inherit;' +
			'font-size:14.5px;line-height:1.55;max-height:110px;min-height:24px;padding:9px 0;margin:0;}' +
			'.vgt-input::placeholder{color:var(--vgt-muted);opacity:1;}' +
			'.vgt-send{flex:0 0 40px;width:40px;height:40px;border:none;cursor:pointer;border-radius:50%;background:var(--vgt-accent);' +
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
			'.vgt-teaser-x{position:absolute;top:6px;inset-inline-end:6px;width:20px;height:20px;border-radius:50%;border:none;' +
			'background:var(--vgt-surface);color:var(--vgt-muted);cursor:pointer;display:flex;align-items:center;justify-content:center;' +
			'box-shadow:0 2px 8px rgba(0,0,0,.2);transition:background .15s,color .15s;}' +
			'.vgt-teaser-x:hover{background:var(--vgt-border);color:var(--vgt-text);}' +
			'.vgt-teaser-x svg{width:11px;height:11px;}' +
			// keyframes
			'@keyframes vgt-in{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}' +
			'@keyframes vgt-teaser-in{from{opacity:0;transform:translateY(12px) scale(.92);}to{opacity:1;transform:translateY(0) scale(1);}}' +
			'@keyframes vgt-bounce{0%,60%,100%{transform:translateY(0);opacity:.5;}30%{transform:translateY(-5px);opacity:1;}}' +
			'@keyframes vgt-ping{0%{box-shadow:0 0 0 0 rgba(34,197,94,.55);}70%{box-shadow:0 0 0 7px rgba(34,197,94,0);}100%{box-shadow:0 0 0 0 rgba(34,197,94,0);}}' +
			'@keyframes vgt-pulse{0%,100%{box-shadow:0 0 0 2px rgba(34,197,94,.3);}50%{box-shadow:0 0 0 5px rgba(34,197,94,.1);}}' +
			'@keyframes vgt-float{0%,100%{transform:translateY(0);}50%{transform:translateY(-5px);}}' +
			'@media (max-width:480px){.vgt-panel{width:calc(100vw - 24px);height:calc(100vh - 100px);}}'
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
	var inputWrap = el('div', 'vgt-inputwrap')
	var input = el('textarea', 'vgt-input')
	input.rows = 1
	var sendBtn = el('button', 'vgt-send', svg('send'))
	sendBtn.setAttribute('aria-label', 'send')
	inputWrap.appendChild(input)
	inputWrap.appendChild(sendBtn)
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
		var s = root.style
		s.setProperty('--vgt-accent', accent)
		s.setProperty('--vgt-on-accent', contrast(accent))
		s.setProperty('--vgt-accent-soft', soft(accent, 0.13))
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

		headTitle.textContent = config.name || 'Vigent'
		headSub.innerHTML = ''
		var dot = el('span', 'vgt-ava-dot')
		headSub.textContent = config.subtitle || t('آنلاین', 'Online')
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
		if (!config.welcomeMessage) return
		introVisible = true
		var intro = el('div', 'vgt-intro')
		intro.appendChild(el('div', 'vgt-intro-ava', svg(iconKey())))
		if (config.welcomeMessage) {
			var txt = el('div', 'vgt-intro-text')
			txt.textContent = config.welcomeMessage
			intro.appendChild(txt)
		}
		intro.setAttribute('data-vgt-intro', '1')
		body.appendChild(intro)
	}
	function clearIntro() {
		var intro = body.querySelector('[data-vgt-intro]')
		if (intro) intro.remove()
		introVisible = false
	}

	// ---- Lead capture ----
	function renderLeadCapture() {
		if (leadCaptured || !config.leadCapture) return false
		body.innerHTML = ''
		var lead = el('div', 'vgt-lead')
		lead.appendChild(el('div', 'vgt-lead-ava', svg('phone')))
		var msg =
			config.leadCaptureMessage ||
			t(
				'برای اینکه بتونیم بهتر کمکتون کنیم، لطفاً شماره موبایلتون رو وارد کنید.',
				'To help you better, please enter your mobile number.',
			)
		lead.appendChild(el('div', 'vgt-lead-text', msg))
		var form = el('form', 'vgt-lead-form')
		var phoneInput = el('input', 'vgt-lead-input')
		phoneInput.type = 'tel'
		phoneInput.placeholder = t('۰۹۱۲ ۳۴۵ ۶۷۸۹', '0912 345 6789')
		phoneInput.inputMode = 'tel'
		phoneInput.autocomplete = 'tel'
		var submit = el('button', 'vgt-lead-btn', t('شروع گفتگو', 'Start chat'))
		submit.type = 'submit'
		var skip = el('button', 'vgt-lead-skip', t('رد کردن', 'Skip'))
		skip.type = 'button'
		form.appendChild(phoneInput)
		form.appendChild(submit)
		form.appendChild(skip)
		lead.appendChild(form)
		body.appendChild(lead)
		setTimeout(function () {
			phoneInput.focus()
		}, 80)

		form.addEventListener('submit', function (e) {
			e.preventDefault()
			var v = (phoneInput.value || '').trim()
			// Permissive: accept digits, +, spaces, dashes; min 6 digits.
			var digits = v.replace(/\D/g, '')
			if (digits.length < 6) {
				phoneInput.style.borderColor = '#ef4444'
				phoneInput.focus()
				return
			}
			submit.disabled = true
			submit.textContent = t('یک لحظه…', 'One moment…')
			// Stash phone as the first user message so the agent sees it in context.
			var introMsg = t('شماره تماس من: ' + v, 'My contact number: ' + v)
			leadCaptured = true
			body.innerHTML = ''
			introVisible = false
			// Show welcome intro then immediately fire the phone as the first message.
			renderIntro()
			// Fire-and-forget — the agent's reply will appear normally.
			send(introMsg)
		})
		skip.addEventListener('click', function () {
			leadCaptured = true
			body.innerHTML = ''
			introVisible = false
			renderIntro()
		})
		return true
	}

	// ---- Messages ----
	function bubble(role, text) {
		var cls =
			role === 'user'
				? 'vgt-msg vgt-user'
				: role === 'error'
					? 'vgt-msg vgt-err'
					: 'vgt-msg vgt-bot'
		var b = el('div', cls)
		b.textContent = text
		body.appendChild(b)
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
		if (preset == null) {
			input.value = ''
			autoGrow()
		}
		clearIntro()
		bubble('user', text)
		setStreaming(true)
		var typing = showTyping()
		var assistant = null
		var replied = false

		var payload = { message: text }
		if (conversationId) payload.conversationId = conversationId
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
									if (typing.parentNode) typing.remove()
									if (!assistant) assistant = bubble('assistant', '')
									assistant.textContent += evt.text
									scrollDown()
								} else if (evt.type === 'done') {
									if (!replied) {
										replied = true
									}
								} else if (evt.type === 'error' && !assistant) {
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

	function toggle(force) {
		isOpen = force != null ? force : !isOpen
		panel.classList.toggle('vgt-show', isOpen)
		launcher.classList.toggle('vgt-open', isOpen)
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
			setTimeout(function () {
				input.focus()
			}, 80)
		}
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
