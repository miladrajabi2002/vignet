// Minifies the embeddable web-widget loader before every production build.
//
//   source:   public/widget/loader.src.js   (hand-maintained, commented)
//   output:   public/widget/loader.js      (served to customer sites)
//
// The output path is what customer sites embed:
//   <script src="https://your-domain/widget/loader.js" data-agent-id="..."></script>
// The minified artifact is committed too, so a checkout without a build still
// serves a working widget; a build regenerates it from source.
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { minify } from 'terser'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'public', 'widget', 'loader.src.js')
const out = join(root, 'public', 'widget', 'loader.js')

const banner = `/* Vigent Web Widget loader — embed with:
   <script src="https://your-domain/widget/loader.js" data-agent-id="AGENT_ID"></script>
   Settings/theme are fetched live from /api/widget/<AGENT_ID> — nothing is baked in. */
`

const code = await readFile(src, 'utf8')
const result = await minify(code, {
  module: false,
  compress: { passes: 2 },
  mangle: { toplevel: false },
  format: { comments: false, preamble: banner },
})

if (!result.code) throw new Error('terser produced no output')
await writeFile(out, result.code, 'utf8')
const kb = (n) => (n / 1024).toFixed(1) + 'KB'
console.log(`[widget] loader minified: ${kb(code.length)} -> ${kb(result.code.length)}`)
