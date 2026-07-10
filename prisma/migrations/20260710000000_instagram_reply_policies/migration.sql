ALTER TABLE "InstagramAutomationSettings"
ADD COLUMN "dmReplyPolicy" TEXT,
ADD COLUMN "storyReplyPolicy" TEXT,
ADD COLUMN "commentReplyPolicy" TEXT,
ADD COLUMN "storyReactionReplyEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "storyReactionReplyText" TEXT,
ADD COLUMN "commentEmojiReplyEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "commentEmojiReplyText" TEXT,
ADD COLUMN "likeDmAfterReply" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "likeStoryReplyAfterReply" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "likeStoryReactionAfterReply" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "likeCommentAfterReply" BOOLEAN NOT NULL DEFAULT false;

UPDATE "InstagramAutomationSettings"
SET "dmReplyPolicy" = "replyPolicy",
    "storyReplyPolicy" = "replyPolicy",
    "commentReplyPolicy" = "replyPolicy";

ALTER TABLE "InstagramAutomationSettings"
ALTER COLUMN "dmReplyPolicy" SET NOT NULL,
ALTER COLUMN "dmReplyPolicy" SET DEFAULT 'AGENT_EXCEPT_SCENARIOS',
ALTER COLUMN "storyReplyPolicy" SET NOT NULL,
ALTER COLUMN "storyReplyPolicy" SET DEFAULT 'AGENT_EXCEPT_SCENARIOS',
ALTER COLUMN "commentReplyPolicy" SET NOT NULL,
ALTER COLUMN "commentReplyPolicy" SET DEFAULT 'AGENT_EXCEPT_SCENARIOS';
