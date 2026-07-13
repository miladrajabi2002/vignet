-- Keep the PostgreSQL enum aligned with prisma/schema.prisma. These values
-- were introduced by the vertical registry after BusinessType was created.
ALTER TYPE "BusinessType" ADD VALUE IF NOT EXISTS 'SUPPORT';
ALTER TYPE "BusinessType" ADD VALUE IF NOT EXISTS 'SOCIAL';
