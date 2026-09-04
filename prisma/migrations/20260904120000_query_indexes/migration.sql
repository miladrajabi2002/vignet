-- Hot-path query indexes identified during the production audit.
--
-- 1. Conversation(workspaceId, status): the dashboard inbox counts/filters
--    conversations by workspace + OPEN/RESOLVED/HANDED_OFF on every load.
-- 2. Message(conversationId, createdAt): conversation threads are rendered
--    in createdAt order; the composite lets Postgres walk the index instead
--    of re-sorting every thread's messages.
-- 3. Contact(name): contact lists search and order by name.
-- 4. BlogPost(views): the admin "most viewed posts" panel orders by views.

CREATE INDEX "Conversation_workspaceId_status_idx" ON "Conversation"("workspaceId", "status");
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");
CREATE INDEX "Contact_name_idx" ON "Contact"("name");
CREATE INDEX "BlogPost_views_idx" ON "BlogPost"("views");
