-- Courses & enrollment (capability «دوره و ثبت‌نام»), low-stock alerts,
-- in-chat booking reminders and the per-run Instagram automation log.
-- Purely additive: new tables, new nullable/defaulted columns.

-- CreateEnum
CREATE TYPE "InstagramAutomationOutcome" AS ENUM ('SENT', 'GATED', 'FOLLOW_CONFIRMED', 'FAILED');

-- CreateEnum
CREATE TYPE "CourseFormat" AS ENUM ('IN_PERSON', 'ONLINE', 'HYBRID');

-- CreateEnum
CREATE TYPE "CourseStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'WAITLISTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "bookingRemindersEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lowStockThreshold" INTEGER NOT NULL DEFAULT 3;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "lowStockAlertedAt" TIMESTAMP(3),
ADD COLUMN     "lowStockThreshold" INTEGER;

-- CreateTable
CREATE TABLE "InstagramAutomationRun" (
    "id" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "igUserId" TEXT NOT NULL,
    "igUsername" TEXT,
    "trigger" "InstagramAutomationType" NOT NULL,
    "outcome" "InstagramAutomationOutcome" NOT NULL,
    "conversationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstagramAutomationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "instructor" TEXT,
    "format" "CourseFormat" NOT NULL DEFAULT 'IN_PERSON',
    "location" TEXT,
    "price" DOUBLE PRECISION,
    "capacity" INTEGER NOT NULL DEFAULT 20,
    "status" "CourseStatus" NOT NULL DEFAULT 'DRAFT',
    "waitlistEnabled" BOOLEAN NOT NULL DEFAULT true,
    "enrollmentDeadline" TIMESTAMP(3),
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Tehran',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseSession" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CourseSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseEnrollment" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "contactId" TEXT,
    "conversationId" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "note" TEXT,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'PENDING',
    "source" TEXT NOT NULL DEFAULT 'dashboard',
    "idempotencyKey" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InstagramAutomationRun_automationId_createdAt_idx" ON "InstagramAutomationRun"("automationId", "createdAt");

-- CreateIndex
CREATE INDEX "InstagramAutomationRun_workspaceId_createdAt_idx" ON "InstagramAutomationRun"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "InstagramAutomationRun_igUserId_idx" ON "InstagramAutomationRun"("igUserId");

-- CreateIndex
CREATE INDEX "Course_workspaceId_status_idx" ON "Course"("workspaceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Course_workspaceId_slug_key" ON "Course"("workspaceId", "slug");

-- CreateIndex
CREATE INDEX "CourseSession_courseId_startsAt_idx" ON "CourseSession"("courseId", "startsAt");

-- CreateIndex
CREATE INDEX "CourseEnrollment_courseId_status_createdAt_idx" ON "CourseEnrollment"("courseId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "CourseEnrollment_contactId_idx" ON "CourseEnrollment"("contactId");

-- CreateIndex
CREATE INDEX "CourseEnrollment_conversationId_idx" ON "CourseEnrollment"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseEnrollment_workspaceId_idempotencyKey_key" ON "CourseEnrollment"("workspaceId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "InstagramAutomationRun" ADD CONSTRAINT "InstagramAutomationRun_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "InstagramAutomation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseSession" ADD CONSTRAINT "CourseSession_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseEnrollment" ADD CONSTRAINT "CourseEnrollment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseEnrollment" ADD CONSTRAINT "CourseEnrollment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseEnrollment" ADD CONSTRAINT "CourseEnrollment_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

