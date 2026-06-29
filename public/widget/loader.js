/* Vigent Web Widget loader — embed with:
   <script src="https://your-domain/widget/loader.js" data-agent-id="AGENT_ID"></script>
   Zero dependencies. Material / minimal. Themeable from the dashboard
   (color, light/dark, position, font, icon, subtitle, corners, quick replies). */
(function () {
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

  var conversationId = null
  var isOpen = false
  var streaming = false
  var introVisible = false
  var teaserShown = false
  var welcomeShown = false
  var config = {
    name: 'Vigent',
    welcomeMessage: '',
    language: 'fa',
    theme: 'dark',
    primaryColor: '#0F0F10',
    position: 'right',
    launcherLabel: null,
    avatar: null,
    font: 'default',
    icon: 'chat',
    subtitle: null,
    corners: 'soft',
    quickReplies: [],
    sound: false,
    autoGreet: false,
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
      h = h.split('').map(function (x) { return x + x }).join('')
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

  // ---- Icons (preset set, keys shared with the dashboard) ----
  var ICONS = {
    chat: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
    bot: '<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>',
    headset: '<path d="M3 11h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H4a1 1 0 0 1-1-1v-5a9 9 0 0 1 18 0v5a1 1 0 0 1-1 1h-2a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/><path d="M21 16v2a4 4 0 0 1-4 4h-5"/>',
    sparkles: '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .962 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.962 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/>',
    bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
    help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
    send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  }
  function svg(name, extraClass) {
    return (
      '<svg class="' + (extraClass || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
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
  function injectFont() {
    if (config.font === 'inherit' || document.getElementById('vgt-font')) return
    var link = document.createElement('link')
    link.id = 'vgt-font'
    link.rel = 'stylesheet'
    link.href =
      'https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700&display=swap'
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
      'transition:transform .2s cubic-bezier(.34,1.5,.64,1),box-shadow .2s;}' +
      '.vgt-launcher:hover{transform:translateY(-2px) scale(1.03);box-shadow:0 18px 42px -10px var(--vgt-accent-shadow);}' +
      '.vgt-launcher:active{transform:scale(.95);}' +
      '.vgt-launcher-ico{width:44px;height:44px;flex:0 0 44px;display:flex;align-items:center;justify-content:center;position:relative;}' +
      '.vgt-launcher-ico svg{width:25px;height:25px;position:absolute;transition:transform .25s ease,opacity .2s ease;}' +
      '.vgt-launcher:not(.vgt-open) .vgt-l-close{transform:rotate(-90deg) scale(.5);opacity:0;}' +
      '.vgt-launcher.vgt-open .vgt-l-main{transform:rotate(90deg) scale(.5);opacity:0;}' +
      '.vgt-launcher-label{font-size:14px;font-weight:600;padding-inline-end:12px;white-space:nowrap;}' +
      // panel
      '.vgt-panel{position:absolute;bottom:74px;width:384px;max-width:calc(100vw - 32px);height:600px;' +
      'max-height:calc(100vh - 120px);display:flex;flex-direction:column;overflow:hidden;border-radius:var(--vgt-r-panel);' +
      'background:var(--vgt-bg);color:var(--vgt-text);border:1px solid var(--vgt-border);' +
      'box-shadow:0 28px 80px -18px rgba(0,0,0,.45),0 8px 24px -12px rgba(0,0,0,.3);' +
      'opacity:0;transform:translateY(14px) scale(.97);transform-origin:bottom right;pointer-events:none;' +
      'transition:opacity .24s ease,transform .26s cubic-bezier(.34,1.28,.64,1);}' +
      '.vgt-root.vgt-left .vgt-panel{transform-origin:bottom left;right:auto;left:0;}' +
      '.vgt-root.vgt-right .vgt-panel{right:0;}' +
      '.vgt-panel.vgt-show{opacity:1;transform:translateY(0) scale(1);pointer-events:auto;}' +
      // header (neutral / material)
      '.vgt-head{display:flex;align-items:center;gap:12px;padding:14px 16px;background:var(--vgt-head-bg);' +
      'border-bottom:1px solid var(--vgt-border);}' +
      '.vgt-ava{position:relative;width:40px;height:40px;flex:0 0 40px;border-radius:50%;display:flex;align-items:center;' +
      'justify-content:center;background:var(--vgt-accent-soft);color:var(--vgt-accent);overflow:hidden;}' +
      '.vgt-ava svg{width:22px;height:22px;}' +
      '.vgt-ava img{width:100%;height:100%;object-fit:cover;}' +
      '.vgt-ava-dot{position:absolute;bottom:0;inset-inline-end:0;width:11px;height:11px;border-radius:50%;' +
      'background:#22c55e;border:2px solid var(--vgt-head-bg);}' +
      '.vgt-head-meta{flex:1;min-width:0;}' +
      '.vgt-head-title{font-weight:700;font-size:15px;line-height:1.25;color:var(--vgt-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
      '.vgt-head-sub{font-size:12.5px;color:var(--vgt-muted);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
      '.vgt-close{background:transparent;border:none;color:var(--vgt-muted);cursor:pointer;padding:7px;border-radius:10px;' +
      'display:flex;transition:background .15s,color .15s;}' +
      '.vgt-close:hover{background:var(--vgt-surface);color:var(--vgt-text);}' +
      '.vgt-close svg{width:18px;height:18px;}' +
      // body
      '.vgt-body{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;scroll-behavior:smooth;background:var(--vgt-bg);}' +
      '.vgt-body::-webkit-scrollbar{width:6px;}' +
      '.vgt-body::-webkit-scrollbar-thumb{background:var(--vgt-border);border-radius:3px;}' +
      '.vgt-msg{max-width:82%;padding:10px 14px;font-size:14px;line-height:1.65;white-space:pre-wrap;word-wrap:break-word;' +
      'border-radius:var(--vgt-r-bubble);animation:vgt-in .26s cubic-bezier(.2,.7,.3,1) both;}' +
      '.vgt-msg.vgt-user{align-self:flex-end;background:var(--vgt-accent);color:var(--vgt-on-accent);border-bottom-right-radius:5px;}' +
      '.vgt-root.vgt-rtl .vgt-msg.vgt-user{border-bottom-right-radius:var(--vgt-r-bubble);border-bottom-left-radius:5px;}' +
      '.vgt-msg.vgt-bot{align-self:flex-start;background:var(--vgt-surface);color:var(--vgt-text);border-bottom-left-radius:5px;}' +
      '.vgt-root.vgt-rtl .vgt-msg.vgt-bot{border-bottom-left-radius:var(--vgt-r-bubble);border-bottom-right-radius:5px;}' +
      '.vgt-msg.vgt-err{background:rgba(239,68,68,.12);color:#ef4444;border:1px solid rgba(239,68,68,.3);align-self:stretch;max-width:100%;text-align:center;font-size:13px;}' +
      // intro (empty state)
      '.vgt-intro{display:flex;flex-direction:column;align-items:center;text-align:center;gap:14px;margin:auto;padding:24px 12px;animation:vgt-in .3s ease both;}' +
      '.vgt-intro-ava{width:64px;height:64px;border-radius:50%;display:flex;align-items:center;justify-content:center;' +
      'background:var(--vgt-accent-soft);color:var(--vgt-accent);}' +
      '.vgt-intro-ava svg{width:32px;height:32px;}' +
      '.vgt-intro-text{font-size:15.5px;font-weight:500;line-height:1.6;color:var(--vgt-text);max-width:280px;}' +
      '.vgt-chips{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:4px;}' +
      '.vgt-chip{border:1px solid var(--vgt-border);background:var(--vgt-bg);color:var(--vgt-accent);cursor:pointer;' +
      'font-family:inherit;font-size:13px;font-weight:500;padding:8px 14px;border-radius:999px;transition:all .15s;}' +
      '.vgt-chip:hover{background:var(--vgt-accent-soft);border-color:transparent;transform:translateY(-1px);}' +
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
      'transition:transform .15s,opacity .15s,box-shadow .15s;box-shadow:0 4px 12px -3px var(--vgt-accent-shadow);}' +
      '.vgt-send:hover{transform:scale(1.08);}.vgt-send:active{transform:scale(.93);}' +
      '.vgt-send:disabled{opacity:.35;cursor:default;transform:none;box-shadow:none;}' +
      '.vgt-send svg{width:18px;height:18px;}' +
      '.vgt-root.vgt-rtl .vgt-send svg{transform:scaleX(-1);}' +
      '.vgt-brand{text-align:center;font-size:11px;color:var(--vgt-muted);padding-top:9px;}' +
      '.vgt-brand a{color:var(--vgt-muted);text-decoration:none;font-weight:600;}' +
      // teaser (auto-greet)
      '.vgt-teaser{position:absolute;bottom:76px;max-width:250px;background:var(--vgt-bg);color:var(--vgt-text);' +
      'border:1px solid var(--vgt-border);border-radius:16px;padding:13px 15px;font-size:13.5px;line-height:1.6;cursor:pointer;' +
      'box-shadow:0 16px 44px -12px rgba(0,0,0,.4);animation:vgt-pop .35s cubic-bezier(.34,1.4,.64,1) both;}' +
      '.vgt-root.vgt-right .vgt-teaser{right:4px;}.vgt-root.vgt-left .vgt-teaser{left:4px;}' +
      '.vgt-teaser-x{position:absolute;top:-8px;inset-inline-end:-8px;width:22px;height:22px;border-radius:50%;border:none;' +
      'background:var(--vgt-surface);color:var(--vgt-muted);cursor:pointer;display:flex;align-items:center;justify-content:center;' +
      'box-shadow:0 2px 8px rgba(0,0,0,.2);}' +
      '.vgt-teaser-x svg{width:13px;height:13px;}' +
      // keyframes
      '@keyframes vgt-in{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}' +
      '@keyframes vgt-pop{from{opacity:0;transform:translateY(10px) scale(.9);}to{opacity:1;transform:translateY(0) scale(1);}}' +
      '@keyframes vgt-bounce{0%,60%,100%{transform:translateY(0);opacity:.5;}30%{transform:translateY(-5px);opacity:1;}}' +
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
    el('div', 'vgt-brand', 'Powered by <a href="https://vigent.ir" target="_blank" rel="noopener">Vigent</a>'),
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
    s.setProperty(
      '--vgt-font',
      config.font === 'inherit'
        ? 'inherit'
        : "'Vazirmatn',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,system-ui,sans-serif",
    )

    var r =
      config.corners === 'round'
        ? ['28px', '20px', '24px']
        : config.corners === 'sharp'
          ? ['12px', '9px', '11px']
          : ['22px', '17px', '18px']
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

    // avatar: image if provided, else the chosen preset icon
    if (config.avatar) {
      ava.innerHTML = '<img src="' + config.avatar + '" alt="">'
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
    if (!config.welcomeMessage && !(config.quickReplies && config.quickReplies.length)) return
    introVisible = true
    var intro = el('div', 'vgt-intro')
    intro.appendChild(el('div', 'vgt-intro-ava', svg(iconKey())))
    if (config.welcomeMessage) {
      var txt = el('div', 'vgt-intro-text')
      txt.textContent = config.welcomeMessage
      intro.appendChild(txt)
    }
    if (config.quickReplies && config.quickReplies.length) {
      var chips = el('div', 'vgt-chips')
      config.quickReplies.forEach(function (q) {
        var chip = el('button', 'vgt-chip')
        chip.type = 'button'
        chip.textContent = q
        chip.addEventListener('click', function () { send(q) })
        chips.appendChild(chip)
      })
      intro.appendChild(chips)
    }
    intro.setAttribute('data-vgt-intro', '1')
    body.appendChild(intro)
  }
  function clearIntro() {
    var intro = body.querySelector('[data-vgt-intro]')
    if (intro) intro.remove()
    introVisible = false
  }

  // ---- Messages ----
  function bubble(role, text) {
    var cls =
      role === 'user' ? 'vgt-msg vgt-user' : role === 'error' ? 'vgt-msg vgt-err' : 'vgt-msg vgt-bot'
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
    var node = el('div', 'vgt-msg vgt-bot vgt-typing', '<span></span><span></span><span></span>')
    body.appendChild(node)
    scrollDown()
    return node
  }
  function setStreaming(on) {
    streaming = on
    sendBtn.disabled = on
  }

  // ---- Sound ----
  var audioCtx
  function chime() {
    if (!config.sound) return
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)()
      var o = audioCtx.createOscillator()
      var g = audioCtx.createGain()
      o.connect(g)
      g.connect(audioCtx.destination)
      o.type = 'sine'
      var now = audioCtx.currentTime
      o.frequency.setValueAtTime(620, now)
      o.frequency.exponentialRampToValueAtTime(880, now + 0.12)
      g.gain.setValueAtTime(0.0001, now)
      g.gain.exponentialRampToValueAtTime(0.1, now + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.28)
      o.start(now)
      o.stop(now + 0.3)
    } catch (e) {}
  }

  function errorText(code) {
    if (code === 'NO_KEY')
      return t('⚠️ این دستیار هنوز پیکربندی نشده است. لطفاً با مدیر سایت تماس بگیرید.',
        '⚠️ This assistant is not configured yet. Please contact the site owner.')
    if (code === 'RATE_LIMIT')
      return t('پیام‌های زیادی ارسال شد. لطفاً چند لحظه صبر کنید.', 'Too many messages. Please wait a moment.')
    if (code === 'FORBIDDEN_ORIGIN')
      return t('این ویجت برای نمایش روی این دامنه مجاز نیست.', 'This widget is not allowed on this domain.')
    return t('خطا در دریافت پاسخ. دوباره تلاش کنید.', 'Failed to get a response. Please try again.')
  }

  function send(preset) {
    var text = (preset != null ? preset : input.value).trim()
    if (!text || streaming) return
    if (preset == null) { input.value = ''; autoGrow() }
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
          return res.json().catch(function () { return {} }).then(function (d) {
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
            if (r.done) { setStreaming(false); return }
            buf += decoder.decode(r.value, { stream: true })
            var parts = buf.split('\n\n')
            buf = parts.pop()
            parts.forEach(function (p) {
              var line = p.trim()
              if (line.indexOf('data:') !== 0) return
              try {
                var evt = JSON.parse(line.slice(5).trim())
                if (evt.type === 'meta') {
                  conversationId = evt.conversationId
                } else if (evt.type === 'delta') {
                  if (typing.parentNode) typing.remove()
                  if (!assistant) assistant = bubble('assistant', '')
                  assistant.textContent += evt.text
                  scrollDown()
                } else if (evt.type === 'done') {
                  if (!replied) { replied = true; chime() }
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
    x.addEventListener('click', function (e) { e.stopPropagation(); tz.remove() })
    tz.appendChild(x)
    tz.addEventListener('click', function () { tz.remove(); toggle(true) })
    root.appendChild(tz)
    chime()
  }

  function toggle(force) {
    isOpen = force != null ? force : !isOpen
    panel.classList.toggle('vgt-show', isOpen)
    launcher.classList.toggle('vgt-open', isOpen)
    launcher.setAttribute('aria-label', isOpen ? 'close chat' : 'open chat')
    if (isOpen) {
      var tz = root.querySelector('.vgt-teaser')
      if (tz) tz.remove()
      setTimeout(function () { input.focus() }, 80)
    }
  }

  // ---- Events ----
  sendBtn.addEventListener('click', function () { send() })
  input.addEventListener('input', autoGrow)
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  })
  launcher.addEventListener('click', function () { toggle() })
  closeBtn.addEventListener('click', function () { toggle(false) })
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
    if (!welcomeShown) { welcomeShown = true; renderIntro() }
    if (config.autoGreet) setTimeout(showTeaser, 4000)
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
    .then(function (r) { return r.ok ? r.json() : null })
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
