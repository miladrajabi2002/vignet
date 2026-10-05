/**
 * Render-test every modified dashboard loading skeleton server-side.
 * Run: npx tsx scripts/skeleton-render-check.tsx
 */
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

async function main() {
  const routes: [string, string][] = [
    ['contacts', '../app/(dashboard)/contacts/(list)/loading'],
    ['conversations', '../app/(dashboard)/conversations/(list)/loading'],
    ['overview', '../app/(dashboard)/overview/loading'],
    ['billing', '../app/(dashboard)/billing/loading'],
    ['products', '../app/(dashboard)/products/(list)/loading'],
    ['courses', '../app/(dashboard)/courses/loading'],
    ['services', '../app/(dashboard)/services/loading'],
    ['appointments', '../app/(dashboard)/appointments/loading'],
  ]

  let failed = 0
  for (const [name, path] of routes) {
    try {
      const mod = await import(path)
      const Comp = mod.default
      const html = renderToStaticMarkup(<Comp />)
      const kb = (html.length / 1024).toFixed(1)
      console.log(`✅ ${name.padEnd(14)} ${kb} kB, ${html.split('skeleton-shimmer').length - 1} shimmer blocks`)
    } catch (error) {
      failed++
      console.error(`❌ ${name}:`, error)
    }
  }

  // Shared building blocks used across pages.
  const blocks = await import('../components/dashboard/dashboard-skeletons')
  for (const key of [
    'DashboardHeaderSkeleton',
    'ContactsToolbarSkeleton',
    'ContactsListSkeleton',
    'ContactRowSkeleton',
    'ContactCardSkeleton',
    'VigentoCardSkeleton',
    'OperatorBotCardSkeleton',
    'ConversationFiltersSkeleton',
    'CommerceTabsSkeleton',
    'ProductCardSkeleton',
  ]) {
    try {
      const Comp = (blocks as Record<string, unknown>)[key] as React.ComponentType
      const html = renderToStaticMarkup(<Comp />)
      console.log(`✅ ${key.padEnd(30)} ${html.length} bytes`)
    } catch (error) {
      failed++
      console.error(`❌ ${key}:`, error)
    }
  }

  const ui = await import('../components/ui/skeleton')
  for (const key of ['ConversationCardSkeleton', 'InboxCardSkeleton']) {
    try {
      const Comp = (ui as Record<string, unknown>)[key] as React.ComponentType
      const html = renderToStaticMarkup(<Comp />)
      console.log(`✅ ${key.padEnd(30)} ${html.length} bytes`)
    } catch (error) {
      failed++
      console.error(`❌ ${key}:`, error)
    }
  }

  if (failed) {
    console.error(`\n${failed} FAILURES`)
    process.exit(1)
  }
  console.log('\nAll skeleton renders OK')
}

void main()
