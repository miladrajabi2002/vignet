CREATE TYPE "PlatformRole" AS ENUM ('USER', 'ADMIN');

ALTER TABLE "User"
ADD COLUMN "platformRole" "PlatformRole" NOT NULL DEFAULT 'USER';

UPDATE "User"
SET "platformRole" = 'ADMIN'
WHERE "phone" = '+989128352271';

CREATE INDEX "User_platformRole_idx" ON "User"("platformRole");
