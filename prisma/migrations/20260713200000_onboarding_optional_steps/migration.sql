ALTER TABLE "Workspace"
  ADD COLUMN "onboardingKnowledgeSkipped" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "onboardingChannelSkipped" BOOLEAN NOT NULL DEFAULT false;
