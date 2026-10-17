-- Chat orders get a per-workspace number («1001», «1002»…) at confirmation.
-- Orders placed before this keep their six-letter code: that is what their
-- customers were given.
ALTER TABLE "Workspace" ADD COLUMN "orderSeq" INTEGER NOT NULL DEFAULT 1000;
ALTER TABLE "OrderDraft" ADD COLUMN "number" INTEGER;

CREATE UNIQUE INDEX "OrderDraft_workspaceId_number_key" ON "OrderDraft"("workspaceId", "number");
