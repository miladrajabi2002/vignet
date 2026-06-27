-- Track when each channel last received an inbound webhook message, so the
-- dashboard can show webhook health (e.g. "last message 2m ago" vs. silent).
ALTER TABLE "AgentChannel" ADD COLUMN "lastInboundAt" TIMESTAMP(3);
