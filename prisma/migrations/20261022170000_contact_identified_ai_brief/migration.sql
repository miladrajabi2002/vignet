-- Customers vs audience. Every Instagram sender — a comment that ran a
-- scenario, a story reply — was filed as a customer under their profile name,
-- so the customers list (and the plan's customer count) filled with people
-- who never bought or said who they are. "identifiedAt" marks a real customer;
-- a NULL row is audience: it keeps its inbox name and photo only.
ALTER TABLE "Contact" ADD COLUMN "identifiedAt" TIMESTAMP(3),
ADD COLUMN "aiBrief" TEXT,
ADD COLUMN "customFields" JSONB;

CREATE INDEX "Contact_workspaceId_identifiedAt_idx" ON "Contact"("workspaceId", "identifiedAt");

-- Orders the owner records by hand on a customer's profile.
CREATE TABLE "ContactManualOrder" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amount" INTEGER,
    "orderedAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactManualOrder_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ContactManualOrder_workspaceId_contactId_orderedAt_idx" ON "ContactManualOrder"("workspaceId", "contactId", "orderedAt");

ALTER TABLE "ContactManualOrder" ADD CONSTRAINT "ContactManualOrder_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Existing rows. Where a name came from is not recorded, so a contact is a
-- customer when anything other than a channel profile vouches for it: a phone,
-- no messenger identity at all (added by hand, imported, web visitor who gave
-- details), a chat that collected their details, something the owner set
-- (stage, tags, notes) or a business record (order, booking, course place,
-- campaign delivery, paid cart or card payment).
UPDATE "Contact" AS k SET "identifiedAt" = k."createdAt"
WHERE k."identifiedAt" IS NULL AND (
     COALESCE(BTRIM(k.phone), '') <> ''
  OR (k."telegramId" IS NULL AND k."whatsappId" IS NULL AND k."instagramId" IS NULL
      AND k."rubikaId" IS NULL AND k."baleId" IS NULL)
  OR k.stage <> 'lead'
  OR COALESCE(CARDINALITY(k.tags), 0) > 0
  OR COALESCE(BTRIM(k.notes), '') <> ''
  OR EXISTS (SELECT 1 FROM "Conversation" c WHERE c."contactId" = k.id AND c."customerInfoState" = 'collected')
  OR EXISTS (SELECT 1 FROM "StoreOrder" o WHERE o."contactId" = k.id)
  OR EXISTS (SELECT 1 FROM "Appointment" a WHERE a."contactId" = k.id)
  OR EXISTS (SELECT 1 FROM "CourseEnrollment" e WHERE e."contactId" = k.id)
  OR EXISTS (SELECT 1 FROM "CampaignRecipient" r WHERE r."contactId" = k.id)
  OR EXISTS (SELECT 1 FROM "OrderDraft" d WHERE d."contactId" = k.id AND d.status = 'PAID')
  OR EXISTS (
    SELECT 1 FROM "CardPayment" p JOIN "Conversation" cv ON cv.id = p."conversationId"
    WHERE cv."contactId" = k.id AND p.status = 'PAID'
  )
);
