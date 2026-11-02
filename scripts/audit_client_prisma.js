#!/usr/bin/env node
/**
 * Audit: find every "use client" module whose static import graph reaches
 * Prisma (value import of @prisma/client or @/lib/prisma). Those break in the
 * browser with "Extensions.defineExtension is unable to run in this browser
 * environment".
 *
 * Usage: node audit_client_prisma.js [projectRoot]
 */
const fs = require('fs')
const path = require('path')

const ROOT = process.argv[2] || process.cwd()
const EXTS = ['.ts', '.tsx']
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'dist', 'build', 'tests', 'scripts', 'coverage'])
const PKG_IMPORTS = /^[^'".@]/ // bare package imports (react, lucide-react, ...) - not local code
const PRISMA_VALUE_IMPORT = /(from\s*['"]|require\(\s*['"])(@prisma\/client|@\/lib\/prisma)['"]/

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(path.join(dir, entry.name), out)
    } else if (EXTS.includes(path.extname(entry.name))) {
      out.push(path.join(dir, entry.name))
    }
  }
  return out
}

function isClientFile(src) {
  // 'use client' directive sits at the very top (comments may precede it)
  return src.slice(0, 400).includes("'use client'")
}

function resolveImport(fromFile, spec) {
  let base
  if (spec.startsWith('@/')) base = path.join(ROOT, spec.slice(2))
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(fromFile), spec)
  else return null // bare package or css
  for (const ext of [...EXTS, '.js', '/index.ts', '/index.tsx', '/index.js']) {
    const candidate = base.endsWith(ext) ? base : base + ext
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate
  }
  return null
}

function parseImports(src) {
  const specs = []
  const re = /(?:^|\n)\s*(?:import|export)(?:\s+type)?(?:\s+[\w*{},\s]+?)?\s*from\s*['"]([^'"]+)['"]|(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g
  let m
  while ((m = re.exec(src))) {
    const spec = m[1] || m[2]
    if (!spec) continue
    const statement = m[0]
    specs.push({ spec, isTypeOnly: isErasedImport(statement) })
  }
  return specs
}

/**
 * True when the bundler erases the statement: `import type ...`,
 * `export type ...`, or imports where every named specifier carries the
 * inline `type` modifier (e.g. `import { type Session } from '@/auth'`).
 */
function isErasedImport(statement) {
  if (/^\s*(?:import|export)\s+type\s/.test(statement)) return true
  const braces = statement.match(/\{([^}]*)\}/)
  if (!braces) return false // bare default/namespace import -> runtime edge
  const specifiers = braces[1].split(',').map((s) => s.trim()).filter(Boolean)
  return specifiers.length > 0 && specifiers.every((s) => /^type\s/.test(s))
}

function hasPrismaValueImport(src) {
  // strip every erased (type-only) import before testing; the codebase is
  // semicolon-free so never require ';' when matching
  const stripped = src
    .replace(/^\s*import\s+type\s[^\n]*/gm, '')
    .replace(/^\s*import\s*\{[^}\n]*\}\s*from\s*['"][^'"]+['"]/gm, (stmt) =>
      isErasedImport(stmt) ? '' : stmt)
  return PRISMA_VALUE_IMPORT.test(stripped)
}

function isServerActionFile(src) {
  // 'use server' modules imported from clients become RPC stubs - their code
  // (and their prisma imports) never reaches the browser bundle.
  return src.slice(0, 400).includes("'use server'")
}

const allFiles = walk(ROOT)
const prismaFiles = new Set(allFiles.filter((f) => hasPrismaValueImport(fs.readFileSync(f, 'utf8'))))

function parseDynamicImports(src) {
  const specs = []
  const re = /import\(\s*['"]([^'"]+)['"]\s*\)/g
  let m
  while ((m = re.exec(src))) specs.push(m[1])
  return specs
}

const offenders = []
for (const file of allFiles) {
  const src = fs.readFileSync(file, 'utf8')
  if (!isClientFile(src)) continue
  // BFS over static import graph (type-only imports excluded - they are erased)
  const parent = new Map([[file, null]])
  const queue = []
  for (const { spec, isTypeOnly } of parseImports(src)) {
    if (!isTypeOnly) {
      const r = resolveImport(file, spec)
      if (r && !parent.has(r)) { parent.set(r, file); queue.push(r) }
    }
  }
  let reached = null
  while (queue.length) {
    const cur = queue.shift()
    if (isServerActionFile(fs.readFileSync(cur, 'utf8'))) continue // boundary stub for client importers
    if (prismaFiles.has(cur)) { reached = cur; break }
    for (const { spec, isTypeOnly } of parseImports(fs.readFileSync(cur, 'utf8'))) {
      if (isTypeOnly) continue
      const r = resolveImport(cur, spec)
      if (r && !parent.has(r)) { parent.set(r, cur); queue.push(r) }
    }
  }
  if (reached) {
    // rebuild chain offender -> ... -> prisma file
    const chain = []
    let node = reached
    while (node) { chain.unshift(path.relative(ROOT, node)); node = parent.get(node) }
    offenders.push({ kind: 'FATAL', chain: chain.join('  ->  ') })
    continue
  }

  // Second pass: lazy (dynamic import) edges. They land in async chunks that
  // only execute if a client actually calls the importing function - bloat,
  // not a crash, but still worth reporting.
  const lazyParent = new Map([[file, null]])
  const lazyQueue = []
  const seed = (from, spec) => {
    const r = resolveImport(from, spec)
    if (r && !lazyParent.has(r)) { lazyParent.set(r, from); lazyQueue.push(r) }
  }
  {
    const src2 = fs.readFileSync(file, 'utf8')
    for (const spec of parseDynamicImports(src2)) seed(file, spec)
  }
  let lazyReached = null
  while (lazyQueue.length) {
    const cur = lazyQueue.shift()
    if (isServerActionFile(fs.readFileSync(cur, 'utf8'))) continue
    if (prismaFiles.has(cur)) { lazyReached = cur; break }
    const curSrc = fs.readFileSync(cur, 'utf8')
    for (const { spec, isTypeOnly } of parseImports(curSrc)) {
      if (!isTypeOnly) seed(cur, spec)
    }
    for (const spec of parseDynamicImports(curSrc)) seed(cur, spec)
  }
  if (lazyReached) {
    const chain = []
    let node = lazyReached
    while (node) { chain.unshift(path.relative(ROOT, node)); node = lazyParent.get(node) }
    offenders.push({ kind: 'LAZY', chain: chain.join('  ->  ') })
  }
}

if (offenders.length === 0) {
  console.log('CLEAN: no client module reaches Prisma (static or lazy).')
} else {
  const fatal = offenders.filter((o) => o.kind === 'FATAL')
  const lazy = offenders.filter((o) => o.kind === 'LAZY')
  if (fatal.length) {
    console.log(`FATAL (${fatal.length}): executes Prisma in the browser on load:`)
    for (const o of fatal) console.log(`  ${o.chain}`)
  }
  if (lazy.length) {
    console.log(`LAZY (${lazy.length}): Prisma lands in async chunks (executes only if called client-side):`)
    for (const o of lazy) console.log(`  ${o.chain}`)
  }
  process.exitCode = fatal.length ? 1 : 0
}
