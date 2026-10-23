-- A manual order lists what was bought (catalog products or typed lines),
-- picked like the items of a new payment; title stays the one-line summary.
ALTER TABLE "ContactManualOrder" ADD COLUMN "items" JSONB;
