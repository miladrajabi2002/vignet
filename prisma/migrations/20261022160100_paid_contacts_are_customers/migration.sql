-- A paid card-to-card order has made its buyer a customer since
-- recordPaidCustomer() learnt to say so; payments confirmed before that left
-- their buyer as a lead. Promote them once. Only upward: a contact someone
-- marked "lost" or already "customer" is left alone.
UPDATE "Contact" AS ct SET "stage" = 'customer'
WHERE ct."stage" IN ('lead', 'qualified')
  AND ct."deletedAt" IS NULL
  AND EXISTS (
    SELECT 1 FROM "CardPayment" p
    JOIN "Conversation" cv ON cv."id" = p."conversationId"
    WHERE cv."contactId" = ct."id"
      AND p."status" = 'PAID'
      AND p."reference" NOT LIKE 'TEST-%'
  );
