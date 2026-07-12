/**
 * Migration script: Add SUPPORT and SOCIAL to the BusinessType enum.
 *
 * Run with: bun run tsx scripts/migrate-business-types.ts
 *
 * This is needed because Prisma's `db:push` may not add enum values
 * to an existing PostgreSQL enum type. This script runs the raw SQL
 * directly.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Adding SUPPORT and SOCIAL to BusinessType enum...')

  // ALTER TYPE ... ADD VALUE cannot run inside a transaction block in
  // PostgreSQL < 12. In PG 12+ it can, but Prisma may wrap it. Use
  // $executeRawUnsafe with each statement separately.
  try {
    await prisma.$executeRawUnsafe(`ALTER TYPE "BusinessType" ADD VALUE IF NOT EXISTS 'SUPPORT'`)
    console.log('  ✓ SUPPORT added')
  } catch (e: any) {
    if (e.message?.includes('already exists')) {
      console.log('  ✓ SUPPORT already exists')
    } else {
      console.error('  ✗ SUPPORT failed:', e.message)
    }
  }

  try {
    await prisma.$executeRawUnsafe(`ALTER TYPE "BusinessType" ADD VALUE IF NOT EXISTS 'SOCIAL'`)
    console.log('  ✓ SOCIAL added')
  } catch (e: any) {
    if (e.message?.includes('already exists')) {
      console.log('  ✓ SOCIAL already exists')
    } else {
      console.error('  ✗ SOCIAL failed:', e.message)
    }
  }

  console.log('Done! You may need to restart your app server.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
