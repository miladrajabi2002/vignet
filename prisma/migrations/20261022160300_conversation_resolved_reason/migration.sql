-- Why a conversation is RESOLVED. The worker closes any conversation idle for
-- 24 hours; counting those as "solved" made the resolution rate mean "went
-- quiet". IDLE = closed by silence, OPERATOR = closed by a person. Older rows
-- stay NULL (unknown) and count as solved, as before.
ALTER TABLE "Conversation" ADD COLUMN "resolvedReason" TEXT;
