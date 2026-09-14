-- A15: agent-level opt-in for inbound photo understanding (machine-vision).
-- Deliberately OFF by default: every analysed image is billed, so businesses
-- must turn it on per agent (mirrors how voice input is surfaced, but the
-- safe default here is "off" until an operator opts in).
ALTER TABLE "Agent" ADD COLUMN "imageInputEnabled" BOOLEAN NOT NULL DEFAULT false;

-- A15: per-image vision price joins the platform commercial settings so the
-- admin panel can see and tune it exactly like the STT per-minute tariff.
ALTER TABLE "PlatformAiSettings" ADD COLUMN "visionPricePerImageIRR" INTEGER NOT NULL DEFAULT 800;
