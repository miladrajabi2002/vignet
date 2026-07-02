// Builds public/downloads/vigent-wordpress.zip from wordpress-plugin/vigent-woo.
// Dependency-free ZIP writer (STORE method — no compression; the plugin is tiny).
// Run with: npm run plugin:zip
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = join(root, 'wordpress-plugin', 'vigent-woo')
const outFile = join(root, 'public', 'downloads', 'vigent-wordpress.zip')

// ─── CRC32 ───────────────────────────────────────────────────────────────
const CRC_TABLE = new Uint32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  CRC_TABLE[n] = c >>> 0
}
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

// ─── collect files ───────────────────────────────────────────────────────
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

const files = walk(srcDir).map((p) => ({
  // Keep the plugin folder name as the top-level dir inside the zip —
  // WordPress uses it as the plugin slug.
  name: 'vigent-woo/' + relative(srcDir, p).split('\\').join('/'),
  data: readFileSync(p),
}))

// ─── build zip (local headers + central directory, STORE method) ─────────
const localParts = []
const centralParts = []
let offset = 0

for (const f of files) {
  const nameBuf = Buffer.from(f.name, 'utf8')
  const crc = crc32(f.data)
  const local = Buffer.alloc(30)
  local.writeUInt32LE(0x04034b50, 0) // local file header signature
  local.writeUInt16LE(20, 4) // version needed
  local.writeUInt16LE(0x0800, 6) // flags: UTF-8 names
  local.writeUInt16LE(0, 8) // method: store
  local.writeUInt16LE(0, 10) // mod time
  local.writeUInt16LE(0x5821, 12) // mod date (arbitrary fixed date)
  local.writeUInt32LE(crc, 14)
  local.writeUInt32LE(f.data.length, 18) // compressed size
  local.writeUInt32LE(f.data.length, 22) // uncompressed size
  local.writeUInt16LE(nameBuf.length, 26)
  local.writeUInt16LE(0, 28) // extra length
  localParts.push(local, nameBuf, f.data)

  const central = Buffer.alloc(46)
  central.writeUInt32LE(0x02014b50, 0) // central dir signature
  central.writeUInt16LE(20, 4) // version made by
  central.writeUInt16LE(20, 6) // version needed
  central.writeUInt16LE(0x0800, 8) // flags: UTF-8
  central.writeUInt16LE(0, 10) // method
  central.writeUInt16LE(0, 12) // time
  central.writeUInt16LE(0x5821, 14) // date
  central.writeUInt32LE(crc, 16)
  central.writeUInt32LE(f.data.length, 20)
  central.writeUInt32LE(f.data.length, 24)
  central.writeUInt16LE(nameBuf.length, 28)
  central.writeUInt32LE(offset, 42) // local header offset
  centralParts.push(central, nameBuf)

  offset += local.length + nameBuf.length + f.data.length
}

const centralSize = centralParts.reduce((s, b) => s + b.length, 0)
const eocd = Buffer.alloc(22)
eocd.writeUInt32LE(0x06054b50, 0) // end of central dir signature
eocd.writeUInt16LE(files.length, 8)
eocd.writeUInt16LE(files.length, 10)
eocd.writeUInt32LE(centralSize, 12)
eocd.writeUInt32LE(offset, 16)

mkdirSync(dirname(outFile), { recursive: true })
writeFileSync(outFile, Buffer.concat([...localParts, ...centralParts, eocd]))
console.log(`✓ ${relative(root, outFile)} (${files.length} files)`)
