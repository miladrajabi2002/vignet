-- A14: per-image wallet charge for inbound photo understanding. The new
-- VISION LogType marks those UsageLog rows so usage analytics can separate
-- image understanding from CHAT / STT.
ALTER TYPE "LogType" ADD VALUE 'VISION';
