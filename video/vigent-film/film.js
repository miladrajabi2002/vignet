/* Vigent feature film — one paused GSAP timeline; every state is a pure function of time.
   window.__seek(t) renders frame t; window.__dur is the length in seconds. */
(() => {
	// lazy rendering defers a tween's first write to the next tick, which makes a seeked frame depend on what was seeked before it
	gsap.defaults({ lazy: false })
	// 3D transforms put a tweening element on its own compositor layer, whose cached raster depends on earlier frames
	gsap.config({ force3D: false })
	gsap.ticker.lagSmoothing(0)
	const $ = (s, r = document) => r.querySelector(s)
	const $$ = (s, r = document) => [...r.querySelectorAll(s)]
	const fa = (n) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d])
	const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v))
	const prog = (t, a, b) => clamp((t - a) / (b - a))
	const easeOut = (p) => 1 - Math.pow(1 - p, 3)
	const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x) }

	const S = 'fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"'
	const ICON = {
		check: `<path ${S} stroke-width="2.8" d="M20 6 9 17l-5-5"/>`,
		bell: `<path ${S} d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0"/>`,
		lock: `<rect ${S} x="3" y="11" width="18" height="11" rx="2"/><path ${S} d="M7 11V7a5 5 0 0 1 10 0v4"/>`,
		cart: `<circle ${S} cx="8" cy="21" r="1"/><circle ${S} cx="19" cy="21" r="1"/><path ${S} d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>`,
		file: `<path ${S} d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7ZM14 2v4a2 2 0 0 0 2 2h4M16 13H8M16 17H8"/>`,
		globe: `<circle ${S} cx="12" cy="12" r="10"/><path ${S} d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20"/>`,
		help: `<circle ${S} cx="12" cy="12" r="10"/><path ${S} d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/>`,
		package: `<path ${S} d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16ZM3.3 7l8.7 5 8.7-5M12 22V12"/>`,
		mic: `<path ${S} d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3ZM19 10v2a7 7 0 0 1-14 0v-2M12 19v3"/>`,
		play: `<path fill="currentColor" d="M8 4.5v15l12-7.5z"/>`,
		heart: `<path fill="currentColor" d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>`,
		calendar: `<rect ${S} x="3" y="4" width="18" height="18" rx="2"/><path ${S} d="M16 2v4M8 2v4M3 10h18"/>`,
		userplus: `<path ${S} d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle ${S} cx="9" cy="7" r="4"/><path ${S} d="M19 8v6M22 11h-6"/>`,
		users: `<path ${S} d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle ${S} cx="9" cy="7" r="4"/><path ${S} d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>`,
		msg: `<path ${S} d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>`,
		arrowl: `<path ${S} d="M19 12H5M12 19l-7-7 7-7"/>`,
		sliders: `<path ${S} d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4"/>`,
		chart: `<path ${S} d="M3 3v16a2 2 0 0 0 2 2h16M18 17V9M13 17V5M8 17v-3"/>`,
		target: `<circle ${S} cx="12" cy="12" r="10"/><circle ${S} cx="12" cy="12" r="6"/><circle ${S} cx="12" cy="12" r="2"/>`,
		alert: `<path ${S} d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3ZM12 9v4M12 17h.01"/>`,
		hand: `<circle ${S} cx="12" cy="8" r="4"/><path ${S} d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>`,
		pen: `<path ${S} d="M12 20h9M16.4 3.6a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>`,
		sun: `<circle ${S} cx="12" cy="12" r="4"/><path ${S} d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>`,
		send: `<path ${S} d="M21 4 2.5 11.2l5.7 2.1L10 19.5l2.6-3.2 5 3.7L21 4zM8.2 13.3 17 7.7l-6.2 6.9"/>`,
		circle: `<circle ${S} cx="12" cy="12" r="9" stroke-dasharray="4 3.2"/><circle ${S} cx="12" cy="12" r="4.5"/>`,
		book: `<path ${S} d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>`,
		lang: `<path ${S} d="m5 8 6 6M4 14l6-6 2-3M2 5h12M7 2h1M22 22l-5-10-5 10M14 18h6"/>`,
		ig: `<rect ${S} x="2" y="2" width="20" height="20" rx="5"/><path ${S} d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37zM17.5 6.5h.01"/>`,
		coat: `<path fill="currentColor" d="M8.2 2 5 3.8 1.8 8.4l3 2.2.2 10.4h6.3V8.2L8.2 2Zm7.6 0L19 3.8l3.2 4.6-3 2.2-.2 10.4h-6.3V8.2L15.8 2ZM9.8 2h4.4L12 5.8Z"/>`,
	}
	const fillIcons = (root = document) => $$('.ic[data-i]', root).forEach((el) => { el.innerHTML = `<svg viewBox="0 0 24 24">${ICON[el.dataset.i]}</svg>` })

	const CH = {
		ig: { n: 'اینستاگرام', c: '#be185d', i: 'assets/instagram.svg' },
		tg: { n: 'تلگرام', c: '#0369a1', i: 'assets/telegram.svg' },
		bale: { n: 'بله', c: '#00a37a', i: 'assets/bale.svg' },
		rub: { n: 'روبیکا', c: '#794387', i: 'assets/rubika.svg' },
		site: { n: 'ویجت سایت', c: '#5b3de8', i: 'assets/site.svg' },
		link: { n: 'لینک چت', c: '#111111', i: 'assets/link.svg' },
	}
	const CHK = Object.keys(CH)

	/* ───────────── DOM that is generated ───────────── */
	const waveHTML = (n, max, col) => `<span class="wave" style="color:${col}">${Array.from({ length: n }, (_, i) => `<b style="height:${Math.round(8 + max * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.37 + 1)))}px"></b>`).join('')}</span>`

	// A — wall: [channel, text, x, y, visible at frame 0, badge]
	const WALL = [
		['ig', 'سلام! کت مشکی سایز M موجوده؟', 330, 130, 1, 3], ['tg', 'سفارشم کی می‌رسه؟', 830, 112, 1, 0], ['site', 'جمعه ساعت ۵ وقت دارید؟', 1290, 160, 1, 2], ['bale', 'فاکتور رسمی می‌دید؟', 1690, 108, 0, 0],
		['rub', 'منوی امروز چیه؟', 215, 345, 1, 0], ['ig', 'قیمت؟', 1745, 318, 1, 7],
		['tg', null, 205, 560, 0, 0], ['link', 'ثبت‌نام دوره تا کی بازه؟', 1700, 545, 1, 0],
		['ig', 'رنگ دیگه هم دارید؟', 235, 770, 1, 0], ['site', 'Do you ship abroad?', 1690, 770, 0, 1],
		['bale', 'نوبت فردا رو لغو کنید', 345, 955, 0, 0], ['tg', 'ارسال به شیراز چند روزه؟', 850, 925, 1, 4], ['rub', 'آدرس شعبه کجاست؟', 1275, 968, 0, 0], ['ig', 'موجود شد خبرم کنید', 1660, 948, 1, 0],
	]
	const wall = WALL.map(([ch, text, x, y, vis, badge], i) => {
		const el = document.createElement('div')
		el.className = 'ab'
		el.innerHTML = `<div class="abf"><img src="${CH[ch].i}">${text ? `<span${/^[A-Z]/.test(text) ? ' class="ltr"' : ''}>${text}</span>` : `${waveHTML(22, 34, '#6b6b76')}<span style="color:#6b6b76">۰:۰۶</span>`}</div>${badge ? `<span class="abn">${fa(badge)}</span>` : ''}`
		$('#aWall').appendChild(el)
		gsap.set(el, { x, y, xPercent: -50, yPercent: -50 })
		return { el, f: el.firstChild, x, y, vis, i }
	})

	// persistent channel icons: row under the title in B, grid beside the inbox in C
	const B_POS = CHK.map((_, i) => ({ x: 1510 - i * 220 - 100, y: 826 }))
	const C_POS = CHK.map((_, i) => ({ x: 1717 - (i % 3) * 180 - 100, y: 622 + Math.floor(i / 3) * 186 }))
	const chis = CHK.map((k, i) => {
		const el = document.createElement('div')
		el.className = 'chi'
		el.innerHTML = `<img src="${CH[k].i}"><span>${CH[k].n}</span>`
		$('#chIcons').appendChild(el)
		gsap.set(el, { x: B_POS[i].x, y: B_POS[i].y })
		return el
	})

	// C — inbox rows
	const ROWS = [
		['ig', 'سارا', 'سلام! کت مشکی سایز M موجوده؟', '#fce7f3'], ['tg', 'امیر', 'سفارشم کی می‌رسه؟', '#e0f2fe'], ['bale', 'مهدی', 'فاکتور رسمی می‌دید؟', '#d9f5ec'],
		['site', 'نگار', 'جمعه عصر وقت دارید؟', '#ede9fe'], ['rub', 'رضا', 'منوی امروز چیه؟', '#f3e8f7'], ['link', 'لیلا', 'ثبت‌نام دوره تا کی بازه؟', '#ececf0'],
	]
	const rows = ROWS.map(([ch, name, msg, bgc], i) => {
		const el = document.createElement('div')
		el.className = 'row'
		el.style.top = `${112 + i * 122}px`
		el.innerHTML = `<div class="sel"></div><span class="av" style="background:${bgc};color:${CH[ch].c}">${name[0]}</span><div><div class="nm">${name}</div><div class="ms">${msg}</div></div>
			<div class="ch" style="color:${CH[ch].c}"><img src="${CH[ch].i}">${CH[ch].n}</div>
			<div class="st"><span class="tag pur stw">در حال پاسخ<span class="dots"><i></i><i></i><i></i></span></span><span class="tag grn std"><i class="ic" data-i="check"></i>پاسخ داده شد</span></div>`
		$('#cRows').appendChild(el)
		return el
	})

	// E — calendar
	const CAL = { w: 1728, timeW: 130, headH: 84, rowH: 104 }
	CAL.colW = (CAL.w - CAL.timeW) / 7
	const colX = (d) => CAL.w - CAL.timeW - (d + 1) * CAL.colW
	const slot = (d, r) => ({ left: colX(d) + 8, top: CAL.headH + r * CAL.rowH + 8, width: CAL.colW - 16, height: CAL.rowH - 16 })
	const px = (o) => Object.entries(o).map(([k, v]) => `${k}:${v}px`).join(';')
	{
		const DAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه']
		const TIMES = ['۱۵:۰۰', '۱۶:۰۰', '۱۷:۰۰', '۱۸:۰۰', '۱۹:۰۰']
		const BUSY = [[0, 2, 3], [1, 4], [0, 1, 3], [2, 4], [0, 3, 4], [1, 2], [0, 3]]
		let h = ''
		DAYS.forEach((d, i) => { h += `<div class="cday" style="left:${colX(i)}px;width:${CAL.colW}px${i === 6 ? ';color:var(--pur)' : ''}">${d}</div><div class="cline" style="left:${colX(i) + CAL.colW}px;top:0;width:1.5px;height:604px"></div>` })
		TIMES.forEach((t, r) => { h += `<div class="ctime" style="top:${CAL.headH + r * CAL.rowH}px;height:${CAL.rowH}px">${t}</div><div class="cline" style="left:0;top:${CAL.headH + r * CAL.rowH}px;width:${CAL.w}px;height:1.5px"></div>` })
		BUSY.forEach((rs, d) => rs.forEach((r) => { h += `<div class="cbusy" style="${px(slot(d, r))}">رزرو شده</div>` }))
		;[1, 2, 4].forEach((r) => { h += `<div class="cfree" style="${px(slot(6, r))}">${TIMES[r]} · خالی</div>` })
		$('#eGrid').innerHTML = h
		$('#eBooked').style.cssText += ';' + px(slot(6, 2))
		$('#eScan').style.cssText += `;left:0;width:${CAL.colW}px`
	}

	// F — sources around the Learning Center card
	const SRC = [['file', 'فایل PDF', 270, 440], ['globe', 'آدرس سایت', 1650, 440], ['help', 'پرسش‌های پرتکرار', 270, 800], ['package', 'کاتالوگ محصولات', 1650, 800]]
	const srcs = SRC.map(([ic, label, x, y], i) => {
		const el = document.createElement('div')
		el.className = 'src'
		el.innerHTML = `<i class="ic" data-i="${ic}"></i>${label}`
		$('#fSrcs').appendChild(el)
		gsap.set(el, { x, y, xPercent: -50, yPercent: -50 })
		const tx = x < 960 ? 510 : 1410, ty = y < 620 ? 500 : 740
		const sx = x < 960 ? x + 175 : x - 175
		const d = `M${sx} ${y} C ${(sx + tx) / 2} ${y}, ${(sx + tx) / 2} ${ty}, ${tx} ${ty}`
		$('#fLines').insertAdjacentHTML('beforeend', `<path d="${d}" stroke="#b9adff" stroke-width="4" stroke-dasharray="2 13" stroke-linecap="round" class="fl"/><circle r="11" fill="#765ff2" class="fd"/>`)
		return { el, x, y, i }
	})
	const fPaths = $$('#fLines .fl'), fDots = $$('#fLines .fd')
	const fLen = fPaths.map((p) => p.getTotalLength())

	// H — waveform, two layers (unplayed / played)
	$('#hWave').innerHTML = `<div class="abs" id="hW1" style="inset:0;display:flex;align-items:center">${waveHTML(78, 84, 'rgba(255,255,255,.34)')}</div><div class="abs" id="hW2" style="inset:0;display:flex;align-items:center">${waveHTML(78, 84, '#b9adff')}</div>`
	const hBars = [$$('#hW1 b'), $$('#hW2 b')]

	// J — bars and donut
	const BARS = [150, 214, 172, 246, 196, 268, 222] // sample shape, deliberately not a growth curve
	$('#jBars').innerHTML = BARS.map((h, i) => `<div class="bar" style="left:${6 + i * 72}px;height:${h}px"></div>`).join('')
	const DON = [['#c837ab', 0.4], ['#2aabee', 0.25], ['#00a37a', 0.2], ['#5b3de8', 0.15]]
	const DR = 86, DC = 2 * Math.PI * DR
	$('#jDonut').innerHTML = `<circle cx="115" cy="115" r="${DR}" stroke="#efeff3" stroke-width="30"/>` + DON.map(([c]) => `<circle class="da" cx="115" cy="115" r="${DR}" stroke="${c}" stroke-width="30" stroke-linecap="butt" transform="rotate(-90 115 115)"/>`).join('')
	const dArcs = $$('#jDonut .da')
	const jLineLen = $('#jL1').getTotalLength()

	// K — capability chips
	const KC = [
		['book', 'یادگیری از اطلاعات شما', 315, 370], ['cart', 'خرید کامل در گفتگو', 745, 370], ['calendar', 'رزرو و نوبت‌دهی', 1175, 370], ['msg', 'همهٔ برنامه‌ها، یک صندوق', 1605, 370],
		['mic', 'پیام صوتی فارسی', 300, 600], ['ig', 'اتوماسیون اینستاگرام', 680, 600], ['lang', 'به زبان خود مشتری', 1240, 600], ['bell', 'ربات تلگرام مدیریتی', 1620, 600],
		['package', 'پیش‌سفارش و هشدار موجودی', 330, 830], ['users', 'CRM و تحویل به اپراتور', 775, 830], ['sliders', 'کنترل کامل رفتار', 1195, 830], ['chart', 'گزارش شفاف', 1585, 830],
	]
	const chips = KC.map(([ic, label, x, y]) => {
		const el = document.createElement('div')
		el.className = 'kc'
		el.innerHTML = `<i class="ic" data-i="${ic}"></i>${label}`
		$('#kChips').appendChild(el)
		gsap.set(el, { x, y, xPercent: -50, yPercent: -50 })
		return { el, x, y }
	})

	fillIcons()

	function build() {
		// pack the recap chips from their measured widths (after the fonts have loaded)
		const KROWS = [[0, 4, 370, 0], [4, 8, 600, 180], [8, 12, 830, 0]], gap = 26
		for (let fs = 35; fs >= 27; fs--) {
			chips.forEach((c) => { c.el.style.fontSize = `${fs}px` })
			if (KROWS.every(([a, b, , hole]) => chips.slice(a, b).reduce((s, c) => s + c.el.offsetWidth, 0) + gap * 3 + hole <= 1660)) break
		}
		KROWS.forEach(([a, b, y, hole]) => {
			const ws = chips.slice(a, b).map((c) => c.el.offsetWidth)
			let x = 960 + (ws.reduce((s, w) => s + w, 0) + gap * (ws.length - 1) + hole) / 2
			chips.slice(a, b).forEach((c, k) => { if (hole && k === 2) x -= hole; c.x = x - ws[k] / 2; c.y = y; gsap.set(c.el, { x: c.x, y }); x -= ws[k] + gap })
		})
		/* ───────────── measure (before any tween moves things) ───────────── */
		const R = (el) => { const r = (typeof el === 'string' ? $(el) : el).getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 } }
		const M = {}
		;$('#dAdded').style.top = `${R('#dProd').y + R('#dProd').h - R('#dChat').y + 14}px` // the chip sits 14 px under the product card, whatever its height
		;['#dAdd', '#dItem', '#dPay', '#dProd', '#fOk', '#g2f', '#g1d', '#iBtnR', '#iHand', '#iAlert', '#jSeg2', '#lCta', '#dChat'].forEach((s) => { M[s] = R(s) })
		const jSw = $$('#jCtrl .sw').map((el) => R(el))
		const row0 = R(rows[0])
		const freeEls = $$('#eGrid .cfree'), busyEls = $$('#eGrid .cbusy')
		const free17 = R(freeEls[1])
		const hA = ['#hl1', '#hl2', '#hl3'].map((r) => R($(`${r} .bub.a`)))

		/* ───────────── timeline helpers ───────────── */
		const tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out', duration: 0.5 } })
		const IN = (sel, t, from = {}, to = {}) => tl.fromTo(sel, { autoAlpha: 0, y: 26, ...from }, { autoAlpha: 1, y: 0, x: 0, duration: 0.5, ...to }, t)
		const POP = (sel, t, to = {}, from = {}) => tl.fromTo(sel, { autoAlpha: 0, scale: 0.6, ...from }, { autoAlpha: 1, scale: 1, duration: 0.45, ease: 'back.out(1.9)', ...to }, t)
		const OUT = (sel, t, to = {}) => tl.to(sel, { autoAlpha: 0, duration: 0.22, ease: 'power2.in', ...to }, t)
		const whipOut = (id, t) => tl.to(id, { x: -260, autoAlpha: 0, filter: 'blur(12px)', duration: 0.36, ease: 'power3.in' }, t)
		const whipIn = (id, t) => { tl.fromTo(id, { x: 300, autoAlpha: 0, filter: 'blur(12px)' }, { x: 0, autoAlpha: 1, filter: 'blur(0px)', duration: 0.6, ease: 'power3.out' }, t); tl.set(id, { filter: 'none' }, t + 0.61) }
		const titleIn = (id, t) => tl.fromTo($$(`${id} .pill, ${id} .h > div, ${id} .sub`).length > 1 ? $$(`${id} .pill, ${id} .h > div, ${id} .sub`) : $$(`${id} .pill, ${id} .h`), { autoAlpha: 0, x: 70 }, { autoAlpha: 1, x: 0, duration: 0.55, stagger: 0.08 }, t)
		const splitWords = (el) => {
			const txt = el.textContent
			el.textContent = ''
			return txt.split(/(\s+)/).filter(Boolean).map((tok) => {
				if (/^\s+$/.test(tok)) { el.appendChild(document.createTextNode(tok)); return null }
				const s = document.createElement('span')
				s.className = 'w'
				s.textContent = tok
				el.appendChild(s)
				return s
			}).filter(Boolean)
		}
		const typeIn = (sel, t, st = 0.055) => tl.fromTo(splitWords($(sel)), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.28, stagger: st, ease: 'power2.out' }, t)

		// spark — the persistent actor
		gsap.set('#spark', { xPercent: -50, yPercent: -50, x: 960, y: 540, scale: 0 })
		const rots = [] // quarter-turns of the star, summed in frame() so overlapping turns stay seek-order independent
		const sparkTo = (t, x, y, s, d = 0.6, ease = 'power3.inOut', turn = d + 0.15) => { rots.push([t, turn]); tl.to('#spark', { x, y, scale: s, duration: d, ease }, t) }
		const spin = (t, d = 0.5) => rots.push([t, d])
		const pulses = [], clicks = [] // rings are drawn in frame(): repeated fromTo tweens on one element would depend on seek history
		const pulse = (t, s = 2.6) => pulses.push([t, s])

		// pointer
		gsap.set('#ptr', { x: 1500, y: 1120 })
		const ptrShow = (t, x, y) => tl.set('#ptr', { autoAlpha: 1, x: x - 9, y: y - 6 }, t)
		const ptrTo = (t, x, y, d = 0.5) => tl.to('#ptr', { x: x - 9, y: y - 6, duration: d, ease: 'power2.inOut' }, t)
		const ptrHide = (t) => tl.to('#ptr', { autoAlpha: 0, duration: 0.2 }, t)
		const click = (t, target) => {
			tl.to('#ptr svg', { scale: 0.8, duration: 0.09, ease: 'power1.in', transformOrigin: '9px 6px' }, t).to('#ptr svg', { scale: 1, duration: 0.13 }, t + 0.09) // done within 0.22 s: clicks 0.24 s apart must not overlap
			clicks.push(t + 0.04)
			if (target) tl.to(target, { scale: 0.95, duration: 0.09, ease: 'power1.in' }, t).to(target, { scale: 1, duration: 0.25 }, t + 0.09)
		}

		/* ───────────── A · wall of messages (0.0 → 2.8) ───────────── */
		gsap.set('#sA', { autoAlpha: 1 })
		wall.filter((b) => !b.vis).forEach((b, k) => POP(b.el, 0.12 + k * 0.2))
		$$('#aWall .abn').forEach((n, k) => tl.fromTo(n, { scale: 0 }, { scale: 1, duration: 0.3, ease: 'back.out(3)' }, 0.25 + k * 0.17))
		tl.to('#aHead', { scale: 0.86, autoAlpha: 0, filter: 'blur(10px)', duration: 0.3, ease: 'power2.in' }, 1.42)
		tl.set('#spark', { autoAlpha: 1 }, 1.5)
		tl.fromTo('#spark', { scale: 0 }, { scale: 1.3, duration: 0.5, ease: 'back.out(2)' }, 1.5)
		pulse(1.62, 3.4)
		;[...wall].sort((a, b) => Math.hypot(a.x - 960, a.y - 540) - Math.hypot(b.x - 960, b.y - 540)).forEach((b, k) => {
			const t = 1.72 + k * 0.035
			tl.to(b.el, { x: 960, y: 540, scale: 0.1, rotation: (b.x < 960 ? -1 : 1) * 14, duration: 0.6, ease: 'power3.in' }, t)
			tl.to(b.el, { autoAlpha: 0, duration: 0.1 }, t + 0.5)
		})
		;[2.25, 2.45].forEach((t) => { tl.to('#spark', { scale: 1.48, duration: 0.09, ease: 'power1.out' }, t).to('#spark', { scale: 1.3, duration: 0.11 }, t + 0.09) })
		spin(1.9, 0.9)
		pulse(2.78, 4.2)
		tl.set('#sA', { autoAlpha: 0 }, 2.95)

		/* ───────────── B · title (2.8 → 4.9) ───────────── */
		tl.set('#sB', { autoAlpha: 1 }, 2.75)
		sparkTo(2.74, 960, 205, 1.12, 0.4, 'power3.out')
		tl.fromTo('.bL1', { x: 560, autoAlpha: 0, filter: 'blur(14px)' }, { x: 0, autoAlpha: 1, filter: 'blur(0px)', duration: 0.55 }, 2.88)
		tl.fromTo('.bL2', { x: -560, autoAlpha: 0, filter: 'blur(14px)' }, { x: 0, autoAlpha: 1, filter: 'blur(0px)', duration: 0.55 }, 2.98)
		IN('#bSub', 3.4)
		chis.forEach((el, i) => { tl.set(el, { autoAlpha: 1 }, 3.48 + i * 0.07); tl.fromTo(el, { scale: 0.3, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.45, ease: 'back.out(2)' }, 3.48 + i * 0.07) })
		// foreground fly-through: the headline passes the camera, the inbox is already underneath
		tl.to('#bHead', { scale: 3.6, autoAlpha: 0, filter: 'blur(18px)', duration: 0.5, ease: 'power3.in' }, 4.87)
		OUT('#bSub', 4.8)
		tl.set('#sB', { autoAlpha: 0 }, 5.4)

		/* ───────────── C · one inbox (4.9 → 8.75) ───────────── */
		tl.set('#sC', { autoAlpha: 1 }, 4.9)
		chis.forEach((el, i) => tl.to(el, { x: C_POS[i].x, y: C_POS[i].y, scale: 0.8, duration: 0.8, ease: 'power3.inOut' }, 4.92 + i * 0.03))
		sparkTo(4.9, 150, 160, 0.5, 0.75)
		tl.fromTo('#cPanel', { autoAlpha: 0, y: 180, rotationX: 16, transformPerspective: 1800 }, { autoAlpha: 1, y: 0, rotationX: 0, duration: 0.8 }, 5.0)
		titleIn('#cTitle', 5.2)
		tl.to('#foot', { opacity: 1, duration: 0.4 }, 5.6)
		rows.forEach((el, i) => {
			const t = 5.55 + i * 0.12
			tl.fromTo(el, { autoAlpha: 0, x: 110 }, { autoAlpha: 1, x: 0, duration: 0.45 }, t)
			tl.to(chis[i].firstChild, { scale: 1.22, duration: 0.14, ease: 'power1.out' }, t).to(chis[i].firstChild, { scale: 1, duration: 0.25 }, t + 0.14)
			gsap.set($('.std', el), { autoAlpha: 0 })
			if (i > 0) {
				const d = 6.55 + (i - 1) * 0.17
				tl.to($('.stw', el), { autoAlpha: 0, duration: 0.1 }, d)
				tl.fromTo($('.std', el), { autoAlpha: 0, scale: 0.7 }, { autoAlpha: 1, scale: 1, duration: 0.3, ease: 'back.out(2.2)' }, d + 0.05)
			}
		})
		spin(6.5, 0.9)
		pulse(6.55, 2.2)
		ptrShow(7.2, 1380, 1120)
		ptrTo(7.25, row0.x + 560, row0.cy + 8, 0.6)
		click(7.9, rows[0])
		tl.to($('.sel', rows[0]), { opacity: 1, duration: 0.15 }, 7.95)
		// selection → expansion: the row becomes the chat panel of D
		tl.to($$('.ch, .st', rows[0]), { autoAlpha: 0, duration: 0.12 }, 8.0)
		const cm = M['#dChat']
		tl.set('#morph', { autoAlpha: 1, x: row0.x, y: row0.y, width: row0.w, height: row0.h, borderRadius: 24 }, 8.14)
		tl.to('#morph', { x: cm.x, y: cm.y, width: cm.w, height: cm.h, borderRadius: 34, duration: 0.6, ease: 'power3.inOut' }, 8.15)
		tl.to('#mAv', { right: 36, top: 18, width: 64, height: 64, duration: 0.6, ease: 'power3.inOut' }, 8.15)
		tl.to('#mNm', { right: 116, top: 24, fontSize: 32, duration: 0.6, ease: 'power3.inOut' }, 8.15)
		tl.to('#mMsg', { right: 36, top: 126, fontSize: 34, lineHeight: 1.55, color: '#111111', padding: '18px 28px', backgroundColor: 'rgba(239,239,243,1)', duration: 0.6, ease: 'power3.inOut' }, 8.15)
		tl.to('#cTitle', { autoAlpha: 0, x: 90, duration: 0.3, ease: 'power2.in' }, 8.05)
		chis.forEach((el, i) => tl.to(el, { autoAlpha: 0, scale: 0.5, duration: 0.25, ease: 'power2.in' }, 8.05 + i * 0.02))
		ptrHide(8.1)
		tl.to('#sC', { autoAlpha: 0, duration: 0.35 }, 8.25)

		/* ───────────── D · checkout inside the chat (8.75 → 14.9) ───────────── */
		tl.set('#sD', { autoAlpha: 1 }, 8.36)
		gsap.set('#dU', { autoAlpha: 0 })
		tl.set('#dU', { autoAlpha: 1 }, 8.75)
		gsap.set('#dChat', { autoAlpha: 0 })
		tl.set('#dChat', { autoAlpha: 1 }, 8.75)
		tl.set('#morph', { autoAlpha: 0 }, 8.78)
		sparkTo(8.3, 160, 386, 0.5, 0.65)
		tl.fromTo($$('#dChat > .ph > span:last-child, #dChat > div:last-child'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 }, 8.75)
		titleIn('#dTitle', 8.42)
		IN('#dThink', 8.98, { y: 0, x: -20 }, { duration: 0.3 })
		spin(9.35, 0.7)
		OUT('#dThink', 9.95, { duration: 0.12 })
		POP('#dA', 10.02, { transformOrigin: '0% 100%' })
		typeIn('#dA1', 10.1)
		typeIn('#dA2', 10.45)
		IN('#dChip', 10.75, { y: 0, x: -30 })
		IN('#dProd', 11.0)
		IN('#dCart', 9.15, { y: 50 })
		tl.to('#dSkel', { autoAlpha: 0, duration: 0.2 }, 12.45)
		gsap.set(['#dItem', '#dShip', '#dDiv', '#dPay', '#dPaid', '#dOrder', '#dAdded'], { autoAlpha: 0 })
		ptrShow(11.3, 520, 1120)
		ptrTo(11.35, M['#dAdd'].cx, M['#dAdd'].cy + 4, 0.55)
		click(11.95, '#dAdd')
		// the product card travels from the chat into the cart
		const pd = M['#dProd'], it = M['#dItem']
		tl.set('#flyProd', { autoAlpha: 1, x: pd.x + pd.w - 330, y: pd.y + 40, scale: 1 }, 12.03)
		tl.to('#flyProd', { x: it.x + it.w - 330, duration: 0.55, ease: 'power2.inOut' }, 12.05)
		tl.to('#flyProd', { y: it.y - 70, duration: 0.3, ease: 'power2.out' }, 12.05).to('#flyProd', { y: it.y + 2, duration: 0.25, ease: 'power2.in' }, 12.35)
		tl.to('#flyProd', { autoAlpha: 0, duration: 0.12 }, 12.6)
		IN('#dAdded', 12.1, { y: 0, x: -20 })
		IN('#dItem', 12.55, { y: 0 }, { duration: 0.25 })
		IN('#dShip', 12.7, { y: 14 }, { duration: 0.35 })
		tl.to('#dDiv', { autoAlpha: 1, duration: 0.2 }, 12.8)
		tl.fromTo('#dPay', { autoAlpha: 0, scale: 0.94 }, { autoAlpha: 1, scale: 1, duration: 0.4, ease: 'back.out(1.6)' }, 12.88)
		ptrTo(13.1, M['#dPay'].cx - 120, M['#dPay'].cy + 8, 0.5)
		click(13.72, '#dPay')
		tl.to('#dPay', { autoAlpha: 0, duration: 0.14 }, 13.82)
		tl.fromTo('#dPaid', { autoAlpha: 0, scale: 0.96 }, { autoAlpha: 1, scale: 1, duration: 0.35, ease: 'back.out(2)' }, 13.84)
		tl.fromTo('#dOrder', { autoAlpha: 0, y: -40, scale: 0.9 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.5, ease: 'back.out(1.7)' }, 14.15)
		ptrHide(14.1)
		whipOut('#sD', 14.9)

		/* ───────────── E · booking (15.0 → 19.1) ───────────── */
		whipIn('#sE', 15.02)
		sparkTo(14.95, 148, 242, 0.5, 0.6)
		titleIn('#eTitle', 15.15)
		tl.fromTo('#eCal', { rotationX: 42, y: 150, autoAlpha: 0, scale: 0.9 }, { rotationX: 7, y: 0, autoAlpha: 1, scale: 1, duration: 0.95 }, 15.08)
		tl.to('#eCal', { rotationX: 0, duration: 1.0, ease: 'power1.inOut' }, 16.03)
		busyEls.forEach((el, k) => tl.fromTo(el, { autoAlpha: 0, scale: 0.7 }, { autoAlpha: 1, scale: 1, duration: 0.3, ease: 'back.out(1.6)' }, 15.4 + rnd(k) * 0.55))
		gsap.set(freeEls, { autoAlpha: 0 })
		gsap.set(['#eBooked', '#eScan'], { autoAlpha: 0 })
		IN('#eWho', 15.4, { y: 0 })
		POP('#eU', 15.45, { transformOrigin: '100% 100%' })
		// scan → finding: the highlight sweeps the week and stops on Friday
		tl.fromTo('#eScan', { x: colX(0), autoAlpha: 0 }, { autoAlpha: 1, duration: 0.15 }, 15.95)
		tl.to('#eScan', { x: colX(6), duration: 0.75, ease: 'power2.inOut' }, 16.0)
		spin(16.0, 0.75)
		freeEls.forEach((el, k) => POP(el, 16.72 + k * 0.1))
		POP('#eA', 16.95, { transformOrigin: '0% 100%' })
		ptrShow(17.0, 620, 1120)
		ptrTo(17.05, free17.cx + 20, free17.cy + 10, 0.6)
		click(17.72, freeEls[1])
		OUT(freeEls[1], 17.8, { duration: 0.1 })
		tl.fromTo('#eBooked', { autoAlpha: 0, scale: 0.8 }, { autoAlpha: 1, scale: 1, duration: 0.4, ease: 'back.out(2.4)' }, 17.8)
		tl.to([freeEls[0], freeEls[2]], { autoAlpha: 0.35, duration: 0.3 }, 17.85)
		tl.to('#eScan', { autoAlpha: 0, duration: 0.3 }, 17.9)
		ptrHide(18.05)
		gsap.set('#eToast', { xPercent: -50, x: 960, y: 912 })
		tl.fromTo('#eToast', { autoAlpha: 0, y: 980, scale: 0.9 }, { autoAlpha: 1, y: 912, scale: 1, duration: 0.5, ease: 'back.out(1.8)' }, 18.1)
		tl.fromTo('#eTeam', { autoAlpha: 0, x: -24 }, { autoAlpha: 1, x: 0, duration: 0.4 }, 18.45)
		pulse(18.12, 2.4)
		whipOut('#sE', 19.1)

		/* ───────────── F · learning (19.2 → 23.4) ───────────── */
		whipIn('#sF', 19.22)
		sparkTo(19.15, 1358, 378, 0.5, 0.6)
		tl.fromTo($$('#fTitle .pill, #fTitle .h'), { autoAlpha: 0, y: -30 }, { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.08 }, 19.32)
		srcs.forEach((s, k) => POP(s.el, 19.42 + k * 0.08))
		fPaths.forEach((p, k) => tl.fromTo(p, { opacity: 0 }, { opacity: 1, duration: 0.4 }, 19.7 + k * 0.06))
		tl.fromTo('#fCard', { autoAlpha: 0, scale: 0.92, y: 40 }, { autoAlpha: 1, scale: 1, y: 0, duration: 0.55 }, 19.5)
		gsap.set(['#fB2', '#fDone'], { autoAlpha: 0 })
		IN('#fQ', 19.95, { y: 14 }, { duration: 0.3 })
		typeIn('#fQt', 20.02)
		IN('#fA', 20.65, { y: 14 }, { duration: 0.3 })
		typeIn('#fAt', 20.72)
		spin(20.6, 0.6)
		POP('#fSrcTag', 21.2)
		tl.to(srcs[1].el, { scale: 1.14, duration: 0.16, ease: 'power1.out' }, 21.2).to(srcs[1].el, { scale: 1, duration: 0.3 }, 21.36)
		tl.fromTo(['#fOk', '#fEdit'], { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.35, stagger: 0.06 }, 21.4)
		ptrShow(21.45, 1300, 1120)
		ptrTo(21.5, M['#fOk'].cx + 40, M['#fOk'].cy + 8, 0.55)
		click(22.12, '#fOk')
		OUT(['#fOk', '#fEdit'], 22.22, { duration: 0.14 })
		tl.fromTo('#fDone', { autoAlpha: 0, scale: 0.95 }, { autoAlpha: 1, scale: 1, duration: 0.4, ease: 'back.out(2)' }, 22.3)
		OUT('#fB1', 22.25, { duration: 0.12 })
		POP('#fB2', 22.32)
		pulse(22.3, 3)
		spin(22.3, 0.6)
		srcs.forEach((s, k) => tl.to(s.el, { scale: 1.08, duration: 0.14, ease: 'power1.out' }, 22.4 + k * 0.07).to(s.el, { scale: 1, duration: 0.3 }, 22.54 + k * 0.07))
		ptrHide(22.5)
		tl.to('#fTitle', { autoAlpha: 0, y: -30, duration: 0.18, ease: 'power2.in' }, 23.1)
		whipOut('#sF', 23.28) // gone by 23.64, before the edit point at 23.74

		/* ───────────── G · Instagram automation, dark (23.5 → 29.2) ───────────── */
		tl.to('#bgDark', { clipPath: 'circle(2300px at 1358px 378px)', duration: 0.42, ease: 'power2.in' }, 23.24)
		tl.to('#foot', { color: '#9c9ca8', duration: 0.3 }, 23.3)
		whipIn('#sG', 23.74)
		const gcx = [380, 960, 1540]
		sparkTo(23.32, gcx[0], 262, 0.5, 0.3, 'power3.inOut', 0.3)
		tl.fromTo($$('#gTitle .pill, #gTitle .h'), { autoAlpha: 0, y: -30 }, { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.08 }, 23.86)
		gsap.set('#tw3b', { autoAlpha: 0 })
		tl.set('#tw3b', { autoAlpha: 1 }, 23.74)
		tl.to('#tw3b', { scale: 4.5, autoAlpha: 0, filter: 'blur(14px)', duration: 0.32, ease: 'power3.in' }, 23.745)
		tl.to('#g2sk', { autoAlpha: 0, duration: 0.2 }, 25.85)
		const gc = ['#gc1', '#gc2', '#gc3']
		gc.forEach((c, i) => tl.fromTo(c, { y: 140, autoAlpha: 0, scale: 0.94 }, { y: 0, autoAlpha: i ? 0.62 : 1, scale: i ? 0.94 : 1, duration: 0.6 }, 23.78 + i * 0.1))
		const focus = (t, i) => gc.forEach((c, k) => tl.to(c, { opacity: k === i ? 1 : 0.62, scale: k === i ? 1 : 0.94, duration: 0.4, ease: 'power2.inOut' }, t))
		gsap.set(['#g2ok'], { autoAlpha: 0 })
		gsap.set('#gStrip', { xPercent: -50, x: 960 })
		POP('#g1a', 24.2, { transformOrigin: '100% 100%' })
		POP('#g1b', 24.75, { transformOrigin: '0% 100%' })
		spin(24.6, 0.5)
		IN('#g1t', 24.95, { y: 0, x: -20 }, { duration: 0.3 })
		POP('#g1d', 25.25)
		const g1d = M['#g1d']
		tl.set('#flyPkt', { autoAlpha: 1, x: g1d.x - 20, y: g1d.cy - 17, scale: 1 }, 25.5)
		tl.to('#flyPkt', { x: 730, y: 430, duration: 0.4, ease: 'power2.inOut' }, 25.5)
		tl.to('#flyPkt', { autoAlpha: 0, scale: 0.3, duration: 0.12 }, 25.88)
		focus(25.55, 1)
		sparkTo(25.5, gcx[1], 262, 0.5, 0.5)
		POP('#g2a', 25.9, { transformOrigin: '0% 100%' })
		POP('#g2f', 26.25)
		ptrShow(26.2, 1250, 1120)
		ptrTo(26.25, M['#g2f'].cx + 10, M['#g2f'].cy + 8, 0.5)
		click(26.8, '#g2f')
		OUT('#g2f', 26.88, { duration: 0.12 })
		POP('#g2ok', 26.92)
		POP('#g2p', 27.15, { transformOrigin: '0% 100%' })
		spin(27.0, 0.5)
		IN('#g2t', 27.4, { y: 0, x: -20 }, { duration: 0.3 })
		tl.fromTo('#g2steps', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 }, 25.95)
		;[26.0, 26.9, 27.2].forEach((t, k) => tl.to($$('#g2steps .gst')[k], { color: '#fff', borderColor: '#765ff2', backgroundColor: 'rgba(118,95,242,.25)', duration: 0.25 }, t))
		ptrHide(27.2)
		focus(27.5, 2)
		sparkTo(27.45, gcx[2], 262, 0.5, 0.5)
		tl.fromTo('#g3bar', { scaleX: 0 }, { scaleX: 1, duration: 1.3, ease: 'none' }, 27.5)
		POP('#g3m', 27.7)
		tl.fromTo('#g3h', { autoAlpha: 0, scale: 0.2, rotation: -20 }, { autoAlpha: 1, scale: 1, rotation: 0, duration: 0.5, ease: 'back.out(3)' }, 27.98)
		POP('#g3d', 28.22, { transformOrigin: '0% 100%' })
		IN('#g3t', 28.42, { y: 0, x: -20 }, { duration: 0.3 })
		tl.fromTo('#gStrip', { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'back.out(1.6)' }, 26.7)
		gc.forEach((c) => tl.to(c, { opacity: 1, scale: 1, duration: 0.4, ease: 'power2.inOut' }, 28.62))
		tl.to('#gTitle', { autoAlpha: 0, y: -30, duration: 0.18, ease: 'power2.in' }, 29.02)
		tl.set(['#bgDark', '#sG'], { clipPath: 'circle(2300px at 1540px 262px)' }, 29.19)
		tl.to(['#bgDark', '#sG'], { clipPath: 'circle(0px at 1540px 262px)', duration: 0.3, ease: 'power2.out' }, 29.2)
		tl.set('#sG', { autoAlpha: 0 }, 29.51)
		tl.to('#foot', { color: '#6b6b70', duration: 0.3 }, 29.3)

		/* ───────────── H · voice and languages (29.3 → 33.0) ───────────── */
		whipIn('#sH', 29.5)
		sparkTo(29.46, 110, 336, 0.42, 0.5) // leaves once the dark has closed on it
		titleIn('#hT1', 29.54)
		tl.fromTo('#hVoice', { autoAlpha: 0, x: -90 }, { autoAlpha: 1, x: 0, duration: 0.5 }, 29.5)
		IN('#hTr', 29.85, { y: 30 })
		typeIn('#hTxt', 29.9, 0.085)
		spin(30.0, 0.8)
		titleIn('#hT2', 29.85)
		;['#hl1', '#hl2', '#hl3'].forEach((r, i) => {
			const t = 30.05 + i * 0.44
			gsap.set($$(`${r} > *`), { autoAlpha: 0 })
			POP($(`${r} .lt`), t)
			POP($(`${r} .bub.u`), t + 0.06, { transformOrigin: '100% 100%' })
			tl.fromTo($(`${r} .ar`), { autoAlpha: 0, x: 24 }, { autoAlpha: 1, x: 0, duration: 0.25 }, t + 0.2)
			POP($(`${r} .bub.a`), t + 0.3, { transformOrigin: '0% 100%' })
			sparkTo(t + 0.08, hA[i].x - 46, hA[i].cy, 0.42, 0.3, 'power2.inOut')
		})
		whipOut('#sH', 33.0)

		/* ───────────── I · CRM, hand-off, Telegram manager bot (33.1 → 37.9) ───────────── */
		whipIn('#sI', 33.12)
		sparkTo(33.05, 104, 440, 0.48, 0.6)
		titleIn('#iTitle', 33.22)
		IN('#iCrm', 33.28, { y: 50 })
		IN('#iTg', 33.38, { y: 70 })
		tl.fromTo('#iRep', { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 0.45 }, 33.62)
		gsap.set(['#iAlert', '#iReply', '#iHand2', '#iSent'], { autoAlpha: 0 })
		POP('#iTag', 33.75)
		typeIn('#iSumT', 33.88, 0.05)
		POP('#iMsg', 34.35, { transformOrigin: '100% 100%' })
		POP('#iFlag', 34.62)
		const ih = M['#iHand'], ia = M['#iAlert']
		tl.to('#iFlag', { x: 7, duration: 0.05, repeat: 5, yoyo: true, ease: 'none' }, 34.7)
		sparkTo(34.7, ih.x + 44, ih.cy, 0.42, 0.28)
		pulse(35.0, 2.4)
		tl.to('#iHand', { scale: 1.03, duration: 0.14 }, 35.0).to('#iHand', { autoAlpha: 0, scale: 1, duration: 0.14 }, 35.14)
		tl.fromTo('#iHand2', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2 }, 35.14)
		tl.set('#flyPkt', { autoAlpha: 1, x: ih.x + ih.w - 40, y: ih.cy - 17, scale: 1 }, 35.12)
		tl.to('#flyPkt', { x: ia.x - 10, duration: 0.42, ease: 'power2.inOut' }, 35.14)
		tl.to('#flyPkt', { y: ia.cy - 17, duration: 0.42, ease: 'power2.out' }, 35.14)
		tl.to('#flyPkt', { autoAlpha: 0, scale: 0.3, duration: 0.1 }, 35.54)
		sparkTo(35.1, 1150, 120, 0.42, 0.5)
		tl.fromTo('#iAlert', { autoAlpha: 0, y: 40, scale: 0.92 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.45, ease: 'back.out(1.8)' }, 35.5)
		ptrShow(35.55, 1500, 1120)
		ptrTo(35.6, M['#iBtnR'].cx + 10, M['#iBtnR'].cy + 8, 0.5)
		click(36.15, '#iBtnR')
		POP('#iReply', 36.3, { transformOrigin: '0% 100%' })
		IN('#iSent', 36.6, { y: 0 }, { duration: 0.25 })
		ptrHide(36.4)
		whipOut('#sI', 37.75)

		/* ───────────── J · control and report (38.0 → 40.9) ───────────── */
		whipIn('#sJ', 37.87)
		sparkTo(37.8, 980, 330, 0.44, 0.6)
		titleIn('#jTitle', 37.96)
		IN('#jCtrl', 37.98, { y: 50 })
		IN('#jRep', 38.06, { y: 50 })
		gsap.set(['#jP2', '#jLive'], { autoAlpha: 0 })
		gsap.set('#jL1', { strokeDasharray: jLineLen, strokeDashoffset: jLineLen })
		const jL2 = $('#jL2').getTotalLength()
		gsap.set('#jL2', { strokeDasharray: jL2, strokeDashoffset: jL2 })
		tl.to('#jL2', { strokeDashoffset: 0, duration: 0.9, ease: 'power2.inOut' }, 38.85)
		$$('#jBars .bar').forEach((b, k) => tl.fromTo(b, { scaleY: 0 }, { scaleY: 1, duration: 0.6 }, 38.5 + k * 0.06))
		tl.to('#jL1', { strokeDashoffset: 0, duration: 0.9, ease: 'power2.inOut' }, 38.7)
		ptrShow(38.5, 1500, 1120)
		ptrTo(38.55, M['#jSeg2'].cx, M['#jSeg2'].cy + 8, 0.5)
		click(39.1)
		tl.to('#jThumb', { x: -192, duration: 0.35, ease: 'power3.inOut' }, 39.15)
		OUT('#jP1', 39.2, { duration: 0.15 })
		IN('#jP2', 39.32, { y: 10 }, { duration: 0.3 })
		POP('#jLive', 39.4)
		$$('#jCtrl .sw').forEach((sw, k) => {
			const t = 39.62 + k * 0.24
			ptrTo(t - (k ? 0.2 : 0.36), jSw[k].cx + 4, jSw[k].cy + 8, k ? 0.18 : 0.34)
			click(t, sw)
			tl.to(sw, { backgroundColor: '#5b3de8', duration: 0.25 }, t + 0.05)
			tl.to(sw.firstChild, { x: -36, duration: 0.25, ease: 'back.out(2)' }, t + 0.05)
		})
		ptrHide(40.34)
		spin(39.6, 0.6)
		whipOut('#sJ', 40.9)
		tl.to('#foot', { opacity: 0, duration: 0.3 }, 40.85)

		/* ───────────── K · recap (41.0 → 43.9) ───────────── */
		tl.set('#sK', { autoAlpha: 1 }, 40.95)
		sparkTo(40.9, 960, 600, 1.15, 0.6)
		tl.fromTo('#kHead', { autoAlpha: 0, y: -40 }, { autoAlpha: 1, y: 0, duration: 0.5 }, 41.28)
		const order = chips.map((c, i) => i).sort((a, b) => Math.hypot(chips[a].x - 960, chips[a].y - 600) - Math.hypot(chips[b].x - 960, chips[b].y - 600))
		order.forEach((ci, k) => {
			const c = chips[ci], t = 41.25 + k * 0.035, o = 43.45 + (11 - k) * 0.018
			tl.fromTo(c.el, { x: 960, y: 600, scale: 0.2 }, { x: c.x, y: c.y, scale: 1, duration: 0.6, ease: 'back.out(1.3)' }, t)
			tl.fromTo(c.el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.22, ease: 'none' }, t + 0.14) // visible only once it has left the pile
			tl.to(c.el, { x: 960, y: 600, scale: 0.1, duration: 0.42, ease: 'power3.in' }, o)
			tl.to(c.el, { autoAlpha: 0, duration: 0.16, ease: 'none' }, o + 0.1)
		})
		pulse(41.25, 3)
		spin(41.3, 1.2)
		tl.to('#kHead', { autoAlpha: 0, y: -50, duration: 0.3, ease: 'power2.in' }, 43.42)
		tl.set('#sK', { autoAlpha: 0 }, 44.2)

		/* ───────────── L · end card (43.9 → 47.5) ───────────── */
		tl.set('#sL', { autoAlpha: 1 }, 43.9)
		pulse(43.9, 4.5)
		sparkTo(43.9, 635, 220, 0.5, 0.36)
		tl.fromTo('#lLogo', { autoAlpha: 0, scale: 0.7, transformOrigin: '105px 44px' }, { autoAlpha: 1, scale: 1, duration: 0.6, ease: 'back.out(1.5)' }, 43.94)
		tl.to('#spark', { autoAlpha: 0, duration: 0.22 }, 44.2)
		tl.fromTo('#lTag', { autoAlpha: 0, y: 50 }, { autoAlpha: 1, y: 0, duration: 0.55 }, 44.16)
		POP('#lCta', 44.44)
		tl.fromTo('#lUrl', { autoAlpha: 0, x: -50 }, { autoAlpha: 1, x: 0, duration: 0.45 }, 44.56)
		IN('#lSub', 44.7)
		ptrShow(44.72, 1500, 1120)
		ptrTo(44.76, M['#lCta'].cx + 60, M['#lCta'].cy + 14, 0.52)
		click(45.36, '#lCta')
		tl.to('#ptr', { autoAlpha: 0, duration: 0.25 }, 45.7)

		const END = 46.9 // the score's own final hit lands about 0.4 s before this

		/* ───────────── T · typographic beat. Authored after the end; the edit list plays it between F and G ───────────── */
		const TB = 48.0, TB_END = 49.4, TB_AT = 23.74
		tl.set('#sL', { autoAlpha: 0 }, TB - 0.02)
		tl.set('#bgDark', { clipPath: 'circle(2300px at 960px 540px)' }, TB - 0.02)
		tl.set('#foot', { opacity: 1, color: '#9c9ca8' }, TB - 0.02)
		tl.set('#spark', { autoAlpha: 1, x: gcx[0], y: 262, scale: 0.5 }, TB - 0.02) // exactly where G picks it up
		tl.set('#sT', { autoAlpha: 1 }, TB)
		$$('#sT .tw').forEach((w, k) => {
			const t = TB + 0.1 + k * 0.4
			tl.fromTo(w, { autoAlpha: 0, scale: 1.5, filter: 'blur(16px)' }, { autoAlpha: 1, scale: 1, filter: 'blur(0px)', duration: 0.24, ease: 'power3.out' }, t)
			if (k < 2) tl.to(w, { autoAlpha: 0, scale: 0.86, duration: 0.1, ease: 'power2.in' }, t + 0.32) // the third word stays: #tw3b takes over at the edit point
		})
		tl.to({}, { duration: 0.001 }, TB_END - 0.001)

		/* ───────────── procedural layer: pure function of t ───────────── */
		// camera: one slow push or pull with a little drift per scene, blended across each cut.
		// It is applied to the finished frames by camera.py (sub-pixel resampling); a slow CSS scale makes text step in whole pixels.
		// Scale never drops below 1.02 so the drift cannot expose the frame edge.
		const CAM = [
			[0, 2.8, [1.02, 0, 0], [1.05, 0, 0]], [2.8, 4.9, [1.02, 0, 0], [1.06, 0, 0]], [4.9, 8.45, [1.02, 14, 0], [1.06, -14, -6]], [8.45, 15.0, [1.02, -12, 0], [1.06, 12, -8]],
			[15.0, 19.2, [1.06, 0, -9], [1.02, 0, 0]], [19.2, 23.45, [1.02, 0, 8], [1.06, 0, -6]], [23.45, 29.25, [1.06, 14, 0], [1.02, -14, 0]], [29.25, 33.05, [1.02, -14, 0], [1.06, 14, -6]],
			[33.05, 37.8, [1.06, 14, 0], [1.02, -14, 0]], [37.8, 40.95, [1.02, 12, 0], [1.055, -12, -6]], [40.95, 43.9, [1.02, 0, 0], [1.055, 0, 0]], [43.9, 46.9, [1.02, 0, 0], [1.05, 0, 0]],
		]
		const camAt = (seg, t) => { const [a, b, p, q] = seg, k = clamp((t - a) / (b - a)); return p.map((v, i) => v + (q[i] - v) * k) }
		const camera = (t) => {
			let ci = CAM.findIndex((s) => t < s[1])
			if (ci < 0) ci = CAM.length - 1
			let cam = camAt(CAM[ci], t)
			const W = 0.28
			if (ci > 0 && t - CAM[ci][0] < W) { const o = camAt(CAM[ci - 1], t), k = smooth(0.5 + (t - CAM[ci][0]) / (2 * W)); cam = cam.map((v, i) => o[i] + (v - o[i]) * k) }
			else if (ci < CAM.length - 1 && CAM[ci][1] - t < W) { const o = camAt(CAM[ci + 1], t), k = smooth(0.5 + (t - CAM[ci][1]) / (2 * W)); cam = cam.map((v, i) => v + (o[i] - v) * k) }
			return cam
		}
		const RENDER = location.search.includes('render')
		const smooth = (p) => p * p * (3 - 2 * p)
		const io = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2)
		const star = $('#spark .core img')
		const dotEls = $$('#stage .dots i')
		const countEls = [[$('#iN1'), 42], [$('#iN2'), 3], [$('#iN3'), 5]]
		// t = authored time (drives the action), f = film time (drives the camera and the ambient layers, which must not jump at an edit)
		function frame(t, f) {
			if (!RENDER) { const cam = camera(f); gsap.set('#cam', { scale: cam[0], x: cam[1], y: cam[2] }) } // live preview only
			gsap.set(star, { rotation: rots.reduce((r, [a, d]) => r + 90 * io(prog(t, a, a + d)), 0) })
			const ring = (list, dur, s0, s1, o0) => { let sc = s0, op = 0; for (const [a, s] of list) if (t >= a && t < a + dur) { const e = 1 - Math.pow(1 - (t - a) / dur, 2); sc = s0 + ((s || s1) - s0) * e; op = o0 * (1 - e) } return { scale: sc, opacity: op } }
			gsap.set('#spark .ring', ring(pulses, 0.6, 1, 2.6, 0.9))
			gsap.set('#ptr .pr', ring(clicks.map((a) => [a]), 0.45, 0.3, 1.6, 0.9))
			gsap.set('#lRing', ring([[45.43], [45.98]], 0.85, 1, 1.22, 0.7)) // both rings finish before the last frame
			gsap.set('#g1', { x: 60 * Math.sin(f * 0.33), y: 40 * Math.cos(f * 0.27) })
			gsap.set('#g2', { x: 70 * Math.cos(f * 0.29), y: 50 * Math.sin(f * 0.31) })
			gsap.set('#gd1', { x: 90 * Math.sin(f * 0.4), y: 50 * Math.cos(f * 0.35) })
			gsap.set('#grid', { y: (f * 7) % 44 })
			gsap.set('#spark .halo', { scale: 1 + 0.1 * Math.sin(f * 3.1) })
			if (t < 3) wall.forEach((b) => gsap.set(b.f, { x: 12 * Math.sin(t * 1.3 + b.i * 1.9) })) // sideways only: slow vertical text motion snaps to whole pixels
			dotEls.forEach((d, k) => { d.style.opacity = 0.25 + 0.75 * Math.max(0, Math.sin(t * 9 - (k % 3) * 1.1)) })
			// F: knowledge flows along the lines into the card
			if (t > 19 && t < 24) fPaths.forEach((p, k) => {
				const q = (((t - 19.8) * 0.9 + k * 0.23) % 1 + 1) % 1
				const pt = p.getPointAtLength(q * fLen[k])
				fDots[k].setAttribute('cx', pt.x); fDots[k].setAttribute('cy', pt.y)
				fDots[k].setAttribute('opacity', t > 19.9 ? Math.sin(q * Math.PI) : 0)
				p.setAttribute('stroke-dashoffset', -t * 40)
			})
			// H: voice playback
			if (t > 29 && t < 33.5) {
				const p = prog(t, 29.7, 30.8), env = Math.sin(clamp(p * 1.02) * Math.PI)
				$('#hW2').style.clipPath = `inset(0 ${(1 - p) * 100}% 0 0)`
				hBars.forEach((bs) => bs.forEach((b, k) => { b.style.transform = `scaleY(${1 + env * 0.45 * Math.sin(t * 17 + k * 0.8) * Math.exp(-Math.abs(k / 78 - p) * 9)})` }))
			}
			// I: daily report counts up
			if (t > 33 && t < 38.5) countEls.forEach(([el, n], k) => { el.textContent = fa(Math.round(n * easeOut(prog(t, 33.7 + k * 0.1, 34.4 + k * 0.1)))) })
			// J: donut sweeps in
			if (t > 37.9 && t < 41.5) {
				const p = easeOut(prog(t, 38.55, 39.7))
				let acc = 0
				DON.forEach(([, f], k) => {
					const vis = clamp((p - acc) / f) * f
					dArcs[k].setAttribute('stroke-dasharray', `${Math.max(0, vis * DC - 3)} ${DC}`)
					dArcs[k].setAttribute('stroke-dashoffset', -acc * DC)
					acc += f
				})
			}
		}

		// retime: stretches where only the pointer travels or a result is being held play faster. [authored start, end, speed]
		const WARP = [[6.5, 7.9, 1.4], [9.1, 9.98, 4], [11.4, 11.95, 1.4], [13.1, 13.7, 1.4], [14.65, 14.9, 2], [22.82, 23.08, 1.8], [31.9, 33.0, 4], [36.9, 37.75, 2.5], [40.3, 40.9, 2]]
		// edit list: authored ranges in the order the film plays them
		const EDL = [[0, TB_AT], [TB, TB_END], [TB_AT, END]]
		const span = (a0, a1) => WARP.reduce((len, [s, e, v]) => len - Math.max(0, Math.min(a1, e) - Math.max(a0, s)) * (1 - 1 / v), a1 - a0)
		const DUR = EDL.reduce((d, [s, e]) => d + span(s, e), 0)
		const toFilm = (a) => { let f = 0; for (const [s, e] of EDL) { if (a >= s && a < e) return f + span(s, a); f += span(s, e) } return DUR }
		const toAuth = (f) => {
			let acc = 0
			for (const [s, e] of EDL) {
				const len = span(s, e)
				if (f < acc + len) { let lo = s, hi = e; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (span(s, m) < f - acc) lo = m; else hi = m } return (lo + hi) / 2 }
				acc += len
			}
			return END
		}
		CAM.forEach((seg) => { seg[0] = toFilm(seg[0]); seg[1] = seg[1] >= END ? DUR : toFilm(seg[1]) }) // the camera runs in film time, straight through the inserted beat
		const CUES = {
			whoosh: [2.7, 4.85, 8.13, 14.9, 19.1, 23.26, 23.74, 29.2, 33.0, 37.75, 40.9, 43.45],
			click: [7.9, 11.95, 13.72, 17.72, 22.12, 26.8, 36.15, 39.1, 39.62, 39.86, 40.1, 45.36],
			pop: [10.02, 13.84, 17.8, 22.3, 35.5, TB + 0.12, TB + 0.52, TB + 0.92],
		}
		window.__cues = { duration: DUR, title: toFilm(2.8), splice: toFilm(29.2), events: Object.fromEntries(Object.entries(CUES).map(([k, v]) => [k, v.map((a) => +toFilm(a).toFixed(3)).sort((a, b) => a - b)])) }
		window.__camAt = (f) => camera(f).map((v) => +v.toFixed(5))
		window.__tl = tl
		window.__dur = DUR
		window.__seek = (f) => { const t = toAuth(f); tl.time(t); frame(t, f) }
		window.__seek(0)
		window.__ready = true

		/* preview chrome — skipped when rendering */
		if (!location.search.includes('render')) {
			const fit = () => { const s = Math.min(innerWidth / 1920, (innerHeight - 40) / 1080); $('#stage').style.transform = `scale(${s})` }
			fit(); addEventListener('resize', fit)
			const ui = document.createElement('div')
			ui.id = 'ui'
			ui.innerHTML = `<button id="pp">pause</button><input id="sc" type="range" min="0" max="${window.__dur}" step="0.01" value="0"><span id="tt"></span>`
			document.body.appendChild(ui)
			let playing = true, t0 = performance.now(), base = 0
			const loop = () => {
				if (playing) { const t = (base + (performance.now() - t0) / 1000) % window.__dur; window.__seek(t); $('#sc').value = t; $('#tt').textContent = t.toFixed(2) }
				requestAnimationFrame(loop)
			}
			$('#pp').onclick = () => { playing = !playing; base = +$('#sc').value; t0 = performance.now(); $('#pp').textContent = playing ? 'pause' : 'play' }
			$('#sc').oninput = (e) => { playing = false; $('#pp').textContent = 'play'; window.__seek(+e.target.value); $('#tt').textContent = (+e.target.value).toFixed(2) }
			loop()
		}
	}

	const imgs = $$('img').map((im) => (im.complete ? Promise.resolve() : new Promise((r) => { im.onload = im.onerror = r })))
	Promise.all([document.fonts.load('700 40px IRS', 'ا'), document.fonts.load('500 40px IRS', 'ا'), document.fonts.load('400 40px IRS', 'ا'), document.fonts.load('300 40px IRS', 'ا'), ...imgs]).then(() => document.fonts.ready).then(build)
})()
