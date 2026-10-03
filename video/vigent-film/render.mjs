#!/usr/bin/env node
// Render the film frame by frame with headless Chromium, then encode with ffmpeg.
//   node render.mjs --out <frames dir> [--fps 60] [--workers 3] [--from 0] [--to <dur>] [--stills 1.2,5.5] [--cues cues.json] [--dsf 1.1]
// --dsf renders above 1080p so camera.py can resample down; --cues writes audio cue points and the per-frame camera.
// One browser process is the bottleneck, so for speed run several of these in parallel on separate --from/--to ranges.
// Needs `playwright` resolvable: set PW_DIR to a folder whose node_modules has it, or install it here.
import { createServer } from 'node:http'
import { readFile, mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { extname, join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d }
const require = createRequire(join(process.env.PW_DIR || here, 'x.js'))
const { chromium } = require('playwright')

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' }
const server = createServer(async (req, res) => {
	try {
		const p = join(here, decodeURIComponent(new URL(req.url, 'http://x').pathname.replace(/^\/$/, '/index.html')))
		res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' })
		res.end(await readFile(p))
	} catch { res.writeHead(404); res.end() }
}).listen(0, '127.0.0.1')
await new Promise((r) => server.once('listening', r))
const url = `http://127.0.0.1:${server.address().port}/?render=1`

const out = arg('out')
const fps = +arg('fps', 60)
const workers = +arg('workers', 3)
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ args: ['--font-render-hinting=none', '--disable-lcd-text', '--enable-font-subpixel-positioning', '--force-color-profile=srgb'] })
const open = async () => {
	const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: +arg('dsf', 1) })
	page.on('pageerror', (e) => console.error('PAGE ERROR', e.message))
	page.on('console', (m) => m.type() === 'error' && console.error('CONSOLE', m.text()))
	await page.goto(url)
	await page.waitForFunction('window.__ready === true', null, { timeout: 30000 })
	return page
}

const stills = arg('stills')
if (arg('cues')) { const p = await open(); const { writeFile } = await import('node:fs/promises'); await writeFile(arg('cues'), JSON.stringify(await p.evaluate((fps) => ({ ...window.__cues, fps, cam: Array.from({ length: Math.round(window.__dur * fps) }, (_, i) => window.__camAt(i / fps)) }), fps))); await p.close() }
if (stills) {
	const page = await open()
	for (const s of stills.split(',')) {
		await page.evaluate((t) => window.__seek(t), +s)
		await page.screenshot({ path: join(out, `t${(+s).toFixed(2).padStart(5, '0')}.png`) })
	}
} else {
	const first = await open()
	const dur = await first.evaluate('window.__dur')
	const f0 = Math.round(+arg('from', 0) * fps), f1 = Math.round(+arg('to', dur) * fps)
	const per = Math.ceil((f1 - f0) / workers)
	const t0 = Date.now()
	await Promise.all(Array.from({ length: workers }, async (_, w) => {
		const page = w === 0 ? first : await open()
		const a = f0 + w * per, b = Math.min(f1, a + per)
		for (let f = a; f < b; f++) {
			await page.evaluate((t) => window.__seek(t), f / fps)
			await page.screenshot({ path: join(out, `f${String(f).padStart(5, '0')}.png`) })
			if (w === 0 && (f - a) % 120 === 0) console.log(`worker 0: ${f - a}/${b - a} (${((Date.now() - t0) / 1000).toFixed(0)}s)`)
		}
	}))
	console.log(`frames ${f0}..${f1 - 1} at ${fps}fps in ${((Date.now() - t0) / 1000).toFixed(0)}s`)
}
await browser.close()
server.close()
