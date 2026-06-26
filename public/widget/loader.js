/* Vigent Web Widget loader — embed with:
   <script src="https://your-domain/widget/loader.js" data-agent-id="AGENT_ID"></script>
   Pure black & white, no dependencies. */
(function () {
  'use strict'

  var script = document.currentScript
  if (!script) return
  var agentId = script.getAttribute('data-agent-id')
  if (!agentId) {
    console.error('[vigent] missing data-agent-id')
    return
  }
  var base =
    script.getAttribute('data-base-url') || new URL(script.src).origin

  var conversationId = null
  var open = false
  var streaming = false
  var config = { name: 'Vigent', welcomeMessage: '', language: 'fa' }

  function el(tag, style, text) {
    var n = document.createElement(tag)
    if (style) n.style.cssText = style
    if (text != null) n.textContent = text
    return n
  }

  // ---- Styles ----
  var Z = 2147483000
  var isRtl = function () {
    return config.language === 'fa'
  }

  var btn = el(
    'button',
    'position:fixed;bottom:20px;inset-inline-end:20px;width:56px;height:56px;border-radius:50%;' +
      'background:#fff;color:#000;border:none;cursor:pointer;z-index:' +
      Z +
      ';box-shadow:0 8px 30px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;font-size:24px;',
  )
  btn.innerHTML = '&#128172;'
  btn.setAttribute('aria-label', 'chat')

  var panel = el(
    'div',
    'position:fixed;bottom:88px;inset-inline-end:20px;width:360px;max-width:calc(100vw - 40px);height:520px;' +
      'max-height:calc(100vh - 120px);background:#0a0a0a;border:1px solid rgba(255,255,255,.1);border-radius:16px;' +
      'z-index:' +
      Z +
      ';display:none;flex-direction:column;overflow:hidden;font-family:system-ui,-apple-system,sans-serif;' +
      'box-shadow:0 20px 60px rgba(0,0,0,.6);',
  )

  var header = el(
    'div',
    'padding:16px;border-bottom:1px solid rgba(255,255,255,.08);color:#fff;font-weight:500;font-size:15px;',
  )
  var body = el(
    'div',
    'flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;',
  )
  var inputWrap = el(
    'div',
    'display:flex;gap:8px;padding:12px;border-top:1px solid rgba(255,255,255,.08);',
  )
  var input = el(
    'input',
    'flex:1;background:#000;border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:10px 12px;color:#fff;outline:none;font-size:14px;',
  )
  input.type = 'text'
  var sendBtn = el(
    'button',
    'background:#fff;color:#000;border:none;border-radius:10px;padding:0 14px;cursor:pointer;font-size:14px;',
  )
  sendBtn.textContent = '→'

  inputWrap.appendChild(input)
  inputWrap.appendChild(sendBtn)
  panel.appendChild(header)
  panel.appendChild(body)
  panel.appendChild(inputWrap)

  function setDir() {
    var dir = isRtl() ? 'rtl' : 'ltr'
    panel.setAttribute('dir', dir)
    input.placeholder = isRtl() ? 'پیامی بنویسید…' : 'Type a message…'
    sendBtn.textContent = isRtl() ? '←' : '→'
  }

  function bubble(role, text) {
    var b = el(
      'div',
      'max-width:80%;padding:9px 12px;border-radius:14px;font-size:14px;line-height:1.5;white-space:pre-wrap;' +
        (role === 'user'
          ? 'background:#fff;color:#000;align-self:flex-end;'
          : 'background:#000;color:#fff;border:1px solid rgba(255,255,255,.1);align-self:flex-start;'),
      text,
    )
    body.appendChild(b)
    body.scrollTop = body.scrollHeight
    return b
  }

  function send() {
    var text = input.value.trim()
    if (!text || streaming) return
    input.value = ''
    bubble('user', text)
    var assistant = bubble('assistant', '')
    streaming = true

    fetch(base + '/api/widget/' + agentId + '/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, conversationId: conversationId }),
    })
      .then(function (res) {
        if (!res.ok || !res.body) {
          return res.json().then(function (d) {
            assistant.textContent =
              d && d.error === 'NO_KEY'
                ? '...'
                : isRtl()
                  ? 'خطا در دریافت پاسخ'
                  : 'Failed to get a response'
            streaming = false
          })
        }
        var reader = res.body.getReader()
        var decoder = new TextDecoder()
        var buf = ''
        function pump() {
          return reader.read().then(function (r) {
            if (r.done) {
              streaming = false
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
                if (evt.type === 'meta') conversationId = evt.conversationId
                else if (evt.type === 'delta') {
                  assistant.textContent += evt.text
                  body.scrollTop = body.scrollHeight
                }
              } catch (e) {}
            })
            return pump()
          })
        }
        return pump()
      })
      .catch(function () {
        assistant.textContent = isRtl()
          ? 'خطا در دریافت پاسخ'
          : 'Failed to get a response'
        streaming = false
      })
  }

  sendBtn.addEventListener('click', send)
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') send()
  })
  btn.addEventListener('click', function () {
    open = !open
    panel.style.display = open ? 'flex' : 'none'
    if (open) input.focus()
  })

  // ---- Init ----
  document.body.appendChild(btn)
  document.body.appendChild(panel)

  fetch(base + '/api/widget/' + agentId)
    .then(function (r) {
      return r.ok ? r.json() : null
    })
    .then(function (cfg) {
      if (cfg) config = cfg
      header.textContent = config.name || 'Vigent'
      setDir()
      if (config.welcomeMessage) bubble('assistant', config.welcomeMessage)
    })
    .catch(function () {
      header.textContent = 'Vigent'
      setDir()
    })
})()
