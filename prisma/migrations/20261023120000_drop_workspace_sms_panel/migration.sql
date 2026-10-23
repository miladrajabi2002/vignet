-- The workspace SMS panel (20261023090000_workspace_sms_panel) is withdrawn:
-- its tables were never used (no panel saved, no SMS sent).
DROP TABLE IF EXISTS "SmsRecipient";
DROP TABLE IF EXISTS "SmsCampaign";
DROP TABLE IF EXISTS "WorkspaceSmsProvider";
DROP TYPE IF EXISTS "SmsRecipientStatus";
DROP TYPE IF EXISTS "SmsCampaignStatus";
DROP TYPE IF EXISTS "SmsCampaignKind";
DROP TYPE IF EXISTS "SmsProviderType";
