-- Migration: Add SUPPORT and SOCIAL to BusinessType enum
-- Run this if you get "invalid input value for enum BusinessType: SOCIAL"
-- 
-- Usage with psql:
--   psql "your-database-url" -f scripts/migrate-business-types.sql
--
-- Or via Prisma:
--   bun run tsx scripts/migrate-business-types.ts

ALTER TYPE "BusinessType" ADD VALUE IF NOT EXISTS 'SUPPORT';
ALTER TYPE "BusinessType" ADD VALUE IF NOT EXISTS 'SOCIAL';
