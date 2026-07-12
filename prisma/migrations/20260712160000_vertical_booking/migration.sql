-- Operational business profile. The selected vertical controls dashboard
-- composition; channels remain independent capabilities.
CREATE TYPE "BusinessType" AS ENUM (
    'COMMERCE',
    'FOOD',
    'APPOINTMENTS',
    'SERVICES',
    'EDUCATION',
    'CUSTOM'
);

ALTER TABLE "Workspace"
    ADD COLUMN "businessType" "BusinessType" NOT NULL DEFAULT 'CUSTOM',
    ADD COLUMN "businessProfile" JSONB;

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'APPOINTMENT';

CREATE TYPE "AppointmentStatus" AS ENUM (
    'PENDING',
    'CONFIRMED',
    'CANCELLED',
    'COMPLETED',
    'NO_SHOW'
);

CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "slotIntervalMinutes" INTEGER NOT NULL DEFAULT 30,
    "bufferBeforeMinutes" INTEGER NOT NULL DEFAULT 0,
    "bufferAfterMinutes" INTEGER NOT NULL DEFAULT 0,
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Tehran',
    "location" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServiceAvailabilityRule" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "capacity" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ServiceAvailabilityRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServiceDateException" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "closed" BOOLEAN NOT NULL DEFAULT true,
    "startMinute" INTEGER,
    "endMinute" INTEGER,
    "capacity" INTEGER,
    "note" TEXT,

    CONSTRAINT "ServiceDateException_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "contactId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Tehran',
    "partySize" INTEGER NOT NULL DEFAULT 1,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'CONFIRMED',
    "source" TEXT NOT NULL DEFAULT 'dashboard',
    "idempotencyKey" TEXT,
    "notes" TEXT,
    "metadata" JSONB,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Service_workspaceId_slug_key"
    ON "Service"("workspaceId", "slug");
CREATE INDEX "Service_workspaceId_active_idx"
    ON "Service"("workspaceId", "active");

CREATE UNIQUE INDEX "ServiceAvailabilityRule_serviceId_weekday_startMinute_endMinute_key"
    ON "ServiceAvailabilityRule"("serviceId", "weekday", "startMinute", "endMinute");
CREATE INDEX "ServiceAvailabilityRule_serviceId_weekday_active_idx"
    ON "ServiceAvailabilityRule"("serviceId", "weekday", "active");

CREATE UNIQUE INDEX "ServiceDateException_serviceId_date_key"
    ON "ServiceDateException"("serviceId", "date");
CREATE INDEX "ServiceDateException_serviceId_date_idx"
    ON "ServiceDateException"("serviceId", "date");

CREATE UNIQUE INDEX "Appointment_workspaceId_idempotencyKey_key"
    ON "Appointment"("workspaceId", "idempotencyKey");
CREATE INDEX "Appointment_workspaceId_startsAt_idx"
    ON "Appointment"("workspaceId", "startsAt");
CREATE INDEX "Appointment_serviceId_startsAt_status_idx"
    ON "Appointment"("serviceId", "startsAt", "status");
CREATE INDEX "Appointment_contactId_startsAt_idx"
    ON "Appointment"("contactId", "startsAt");

ALTER TABLE "Service" ADD CONSTRAINT "Service_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceAvailabilityRule" ADD CONSTRAINT "ServiceAvailabilityRule_serviceId_fkey"
    FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceDateException" ADD CONSTRAINT "ServiceDateException_serviceId_fkey"
    FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_serviceId_fkey"
    FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
