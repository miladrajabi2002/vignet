-- Faster severity/source/workspace filtering in the admin observability panel.
CREATE INDEX "ErrorLog_level_createdAt_idx" ON "ErrorLog"("level", "createdAt");
CREATE INDEX "ErrorLog_source_createdAt_idx" ON "ErrorLog"("source", "createdAt");
CREATE INDEX "ErrorLog_workspaceId_createdAt_idx" ON "ErrorLog"("workspaceId", "createdAt");

-- Efficiently locate the latest OTP delivery and retention/verification rows.
CREATE INDEX "OTPLog_phone_sentAt_idx" ON "OTPLog"("phone", "sentAt");
CREATE INDEX "OTPLog_verified_sentAt_idx" ON "OTPLog"("verified", "sentAt");
