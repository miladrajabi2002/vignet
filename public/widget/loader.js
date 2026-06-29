/* Vigent Web Widget loader — embed with:
   <script src="https://your-domain/widget/loader.js" data-agent-id="AGENT_ID"></script>
   Zero dependencies. Themeable (color / light-dark / position) from the dashboard. */
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
  var config = {
    name: 'Vigent',
    welcomeMessage: '',
    language: 'fa',
    theme: 'dark',
    primaryColor: '#0F0F10',
    position: 'right',
    launcherLabel: null,
    avatar: null,
  }

  function isRtl() {
    return config.language === 'fa'
  }
  function t(fa, en) {
    return isRtl() ? fa : en
  }

  // ---- Color helpers (compute a legible foreground for the brand color) ----
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
    return (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255 > 0.6
      ? '#000000'
      : '#ffffff'
  }
  function softColor(hex, alpha) {
    var c = rgb(hex)
    return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + alpha + ')'
  }

  // ---- Stylesheet (one injected <style>; classes enable hover + keyframes) ----
  var NS = 'vgt'
  function injectStyles() {
    if (document.getElementById('vgt-styles')) return
    var css =
      // Force LTR on the container so positioning (inset-inline-*) is deterministic
      // regardless of the host page direction; inner text direction is set per-panel.
      '.vgt-root{position:fixed;bottom:20px;z-index:2147483000;direction:ltr;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,system-ui,sans-serif;}' +
      '.vgt-root.vgt-right{inset-inline-end:20px;}' +
      '.vgt-root.vgt-left{inset-inline-start:20px;}' +
      // launcher
      '.vgt-launcher{display:flex;align-items:center;gap:8px;height:56px;padding:0 6px;border:none;cursor:pointer;border-radius:28px;background:var(--vgt-accent);color:var(--vgt-on-accent);box-shadow:0 10px 30px -8px rgba(0,0,0,.45);transition:transform .18s cubic-bezier(.34,1.56,.64,1),box-shadow .2s;}' +
      '.vgt-launcher:hover{transform:translateY(-2px) scale(1.03);box-shadow:0 16px 40px -10px rgba(0,0,0,.55);}' +
      '.vgt-launcher:active{transform:scale(.96);}' +
      '.vgt-launcher-ico{width:44px;height:44px;flex:0 0 44px;display:flex;align-items:center;justify-content:center;}' +
      '.vgt-launcher-ico svg{width:24px;height:24px;}' +
      '.vgt-launcher-label{font-size:14px;font-weight:600;padding-inline-end:12px;white-space:nowrap;}' +
      '.vgt-launcher.vgt-open .vgt-ico-chat{display:none;}' +
      '.vgt-launcher:not(.vgt-open) .vgt-ico-close{display:none;}' +
      // panel
      '.vgt-panel{position:absolute;bottom:72px;width:380px;max-width:calc(100vw - 32px);height:600px;max-height:calc(100vh - 120px);' +
      'display:flex;flex-direction:column;overflow:hidden;border-radius:20px;background:var(--vgt-bg);color:var(--vgt-text);' +
      'border:1px solid var(--vgt-border);box-shadow:0 24px 70px -16px rgba(0,0,0,.5);opacity:0;transform:translateY(12px) scale(.96);' +
      'transform-origin:bottom right;pointer-events:none;transition:opacity .22s ease,transform .22s cubic-bezier(.34,1.3,.64,1);}' +
      '.vgt-root.vgt-left .vgt-panel{transform-origin:bottom left;right:auto;left:0;}' +
      '.vgt-root.vgt-right .vgt-panel{right:0;}' +
      '.vgt-panel.vgt-show{opacity:1;transform:translateY(0) scale(1);pointer-events:auto;}' +
      // header
      '.vgt-head{display:flex;align-items:center;gap:12px;padding:16px;background:var(--vgt-accent);color:var(--vgt-on-accent);}' +
      '.vgt-avatar{width:38px;height:38px;flex:0 0 38px;border-radius:50%;background:var(--vgt-on-accent);color:var(--vgt-accent);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;overflow:hidden;}' +
      '.vgt-avatar img{width:100%;height:100%;object-fit:cover;}' +
      '.vgt-head-meta{flex:1;min-width:0;}' +
      '.vgt-head-title{font-weight:700;font-size:15px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
      '.vgt-head-status{display:flex;align-items:center;gap:5px;font-size:12px;opacity:.85;margin-top:2px;}' +
      '.vgt-dot{width:7px;height:7px;border-radius:50%;background:#22c55e;box-shadow:0 0 0 0 rgba(34,197,94,.6);animation:vgt-pulse 2s infinite;}' +
      '.vgt-close{background:transparent;border:none;color:inherit;cursor:pointer;opacity:.8;padding:4px;border-radius:8px;display:flex;transition:opacity .15s,background .15s;}' +
      '.vgt-close:hover{opacity:1;background:rgba(0,0,0,.12);}' +
      '.vgt-close svg{width:20px;height:20px;}' +
      // body
      '.vgt-body{flex:1;overflow-y:auto;padding:18px 16px;display:flex;flex-direction:column;gap:12px;scroll-behavior:smooth;background:var(--vgt-bg);}' +
      '.vgt-body::-webkit-scrollbar{width:6px;}' +
      '.vgt-body::-webkit-scrollbar-thumb{background:var(--vgt-border);border-radius:3px;}' +
      '.vgt-msg{max-width:82%;padding:10px 14px;font-size:14px;line-height:1.6;white-space:pre-wrap;word-wrap:break-word;border-radius:16px;animation:vgt-in .25s ease both;}' +
      '.vgt-msg.vgt-user{align-self:flex-end;background:var(--vgt-accent);color:var(--vgt-on-accent);border-bottom-right-radius:4px;}' +
      '.vgt-root.vgt-rtl .vgt-msg.vgt-user{border-bottom-right-radius:16px;border-bottom-left-radius:4px;}' +
      '.vgt-msg.vgt-bot{align-self:flex-start;background:var(--vgt-surface);color:var(--vgt-text);border:1px solid var(--vgt-border);border-bottom-left-radius:4px;}' +
      '.vgt-root.vgt-rtl .vgt-msg.vgt-bot{border-bottom-left-radius:16px;border-bottom-right-radius:4px;}' +
      '.vgt-msg.vgt-err{background:rgba(239,68,68,.12);color:#ef4444;border:1px solid rgba(239,68,68,.3);align-self:stretch;max-width:100%;text-align:center;font-size:13px;}' +
      // typing
      '.vgt-typing{display:flex;gap:4px;align-items:center;padding:14px;}' +
      '.vgt-typing span{width:7px;height:7px;border-radius:50%;background:var(--vgt-muted);animation:vgt-bounce 1.2s infinite;}' +
      '.vgt-typing span:nth-child(2){animation-delay:.18s;}' +
      '.vgt-typing span:nth-child(3){animation-delay:.36s;}' +
      // input
      '.vgt-foot{padding:12px 14px 10px;border-top:1px solid var(--vgt-border);background:var(--vgt-bg);}' +
      '.vgt-inputwrap{display:flex;gap:6px;align-items:flex-end;background:var(--vgt-surface);border:1.5px solid var(--vgt-border);border-radius:18px;padding:5px;padding-inline-start:16px;transition:border-color .18s,box-shadow .18s,background .18s;}' +
      '.vgt-inputwrap:focus-within{border-color:var(--vgt-accent);box-shadow:0 0 0 4px var(--vgt-accent-soft);background:var(--vgt-bg);}' +
      '.vgt-input{flex:1;background:transparent;border:none;outline:none;resize:none;color:var(--vgt-text);font-size:14.5px;line-height:1.55;max-height:110px;min-height:24px;padding:9px 0;margin:0;font-family:inherit;}' +
      '.vgt-input::placeholder{color:var(--vgt-muted);opacity:1;}' +
      '.vgt-send{flex:0 0 40px;width:40px;height:40px;border:none;cursor:pointer;border-radius:50%;background:var(--vgt-accent);color:var(--vgt-on-accent);display:flex;align-items:center;justify-content:center;transition:transform .15s,opacity .15s,box-shadow .15s;box-shadow:0 4px 12px -3px var(--vgt-accent-soft);}' +
      '.vgt-send:hover{transform:scale(1.08);box-shadow:0 6px 16px -3px var(--vgt-accent-soft);}' +
      '.vgt-send:active{transform:scale(.94);}' +
      '.vgt-send:disabled{opacity:.35;cursor:default;transform:none;box-shadow:none;}' +
      '.vgt-send svg{width:18px;height:18px;}' +
      '.vgt-root.vgt-rtl .vgt-send svg{transform:scaleX(-1);}' +
      '.vgt-brand{text-align:center;font-size:11px;color:var(--vgt-muted);padding-top:8px;}' +
      '.vgt-brand a{color:var(--vgt-muted);text-decoration:none;font-weight:600;}' +
      // keyframes
      '@keyframes vgt-in{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);}}' +
      '@keyframes vgt-bounce{0%,60%,100%{transform:translateY(0);opacity:.5;}30%{transform:translateY(-5px);opacity:1;}}' +
      '@keyframes vgt-pulse{0%{box-shadow:0 0 0 0 rgba(34,197,94,.5);}70%{box-shadow:0 0 0 6px rgba(34,197,94,0);}100%{box-shadow:0 0 0 0 rgba(34,197,94,0);}}' +
      '@media (max-width:480px){.vgt-panel{width:calc(100vw - 24px);height:calc(100vh - 96px);}}'
    var style = document.createElement('style')
    style.id = 'vgt-styles'
    style.textContent = css
    document.head.appendChild(style)
  }

  // ---- SVG icons ----
  var ICONS = {
    chat: '<svg class="vgt-ico-chat" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>',
    close:
      '<svg class="vgt-ico-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>',
  }

  function el(tag, cls, html) {
    var n = document.createElement(tag)
    if (cls) n.className = cls
    if (html != null) n.innerHTML = html
    return n
  }

  // ---- Build DOM ----
  injectStyles()
  var root = el('div', 'vgt-root')
  var panel = el('div', 'vgt-panel')
  panel.setAttribute('role', 'dialog')
  panel.setAttribute('aria-label', 'chat')

  var head = el('div', 'vgt-head')
  var avatar = el('div', 'vgt-avatar')
  var headMeta = el('div', 'vgt-head-meta')
  var headTitle = el('div', 'vgt-head-title')
  var headStatus = el(
    'div',
    'vgt-head-status',
    '<span class="vgt-dot"></span><span class="vgt-status-text"></span>',
  )
  headMeta.appendChild(headTitle)
  headMeta.appendChild(headStatus)
  var closeBtn = el('button', 'vgt-close', ICONS.x)
  closeBtn.setAttribute('aria-label', 'close')
  head.appendChild(avatar)
  head.appendChild(headMeta)
  head.appendChild(closeBtn)

  var body = el('div', 'vgt-body')

  var foot = el('div', 'vgt-foot')
  var inputWrap = el('div', 'vgt-inputwrap')
  var input = el('textarea', 'vgt-input')
  input.rows = 1
  var sendBtn = el('button', 'vgt-send', ICONS.send)
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
  var launcherIco = el('span', 'vgt-launcher-ico', ICONS.chat + ICONS.close)
  launcher.appendChild(launcherIco)

  root.appendChild(panel)
  root.appendChild(launcher)

  // ---- Apply theme/config to the DOM ----
  function applyConfig() {
    var dark = config.theme !== 'light'
    var accent = config.primaryColor || '#0F0F10'
    var s = root.style
    s.setProperty('--vgt-accent', accent)
    s.setProperty('--vgt-on-accent', contrast(accent))
    s.setProperty('--vgt-accent-soft', softColor(accent, 0.22))
    s.setProperty('--vgt-bg', dark ? '#0c0c0e' : '#ffffff')
    s.setProperty('--vgt-surface', dark ? '#1a1a1f' : '#f4f4f5')
    s.setProperty('--vgt-text', dark ? '#f4f4f5' : '#18181b')
    s.setProperty('--vgt-muted', dark ? '#8a8a93' : '#9ca3af')
    s.setProperty('--vgt-border', dark ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.08)')

    root.classList.toggle('vgt-right', config.position !== 'left')
    root.classList.toggle('vgt-left', config.position === 'left')
    root.classList.toggle('vgt-rtl', isRtl())
    panel.setAttribute('dir', isRtl() ? 'rtl' : 'ltr')

    headTitle.textContent = config.name || 'Vigent'
    var stEl = headStatus.querySelector('.vgt-status-text')
    if (stEl) stEl.textContent = t('آنلاین', 'Online')
    input.placeholder = t('پیام خود را بنویسید…', 'Type a message…')

    if (config.avatar) {
      avatar.innerHTML = '<img src="' + config.avatar + '" alt="">'
    } else {
      avatar.textContent = (config.name || 'V').trim().charAt(0).toUpperCase()
    }

    if (config.launcherLabel) {
      if (!launcher.querySelector('.vgt-launcher-label')) {
        launcher.appendChild(el('span', 'vgt-launcher-label', ''))
      }
      launcher.querySelector('.vgt-launcher-label').textContent =
        config.launcherLabel
    }
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
    return t('خطا در دریافت پاسخ. دوباره تلاش کنید.', 'Failed to get a response. Please try again.')
  }

  function send() {
    var text = input.value.trim()
    if (!text || streaming) return
    input.value = ''
    autoGrow()
    bubble('user', text)
    setStreaming(true)
    var typing = showTyping()
    var assistant = null

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
                  conversationId = evt.conversationId
                } else if (evt.type === 'delta') {
                  if (typing.parentNode) typing.remove()
                  if (!assistant) assistant = bubble('assistant', '')
                  assistant.textContent += evt.text
                  scrollDown()
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
    input.style.height = Math.min(input.scrollHeight, 96) + 'px'
  }

  function toggle(force) {
    isOpen = force != null ? force : !isOpen
    panel.classList.toggle('vgt-show', isOpen)
    launcher.classList.toggle('vgt-open', isOpen)
    launcher.setAttribute('aria-label', isOpen ? 'close chat' : 'open chat')
    if (isOpen) setTimeout(function () { input.focus() }, 60)
  }

  // ---- Events ----
  sendBtn.addEventListener('click', send)
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
  function mount() {
    document.body.appendChild(root)
    applyConfig()
  }
  if (document.body) mount()
  else document.addEventListener('DOMContentLoaded', mount)

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
      applyConfig()
      if (config.welcomeMessage) bubble('assistant', config.welcomeMessage)
    })
    .catch(function () {
      applyConfig()
    })
})()
