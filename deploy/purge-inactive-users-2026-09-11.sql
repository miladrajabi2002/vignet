-- ============================================================================
--  Vignet — Purge 15 inactive users (>20 days idle) with ALL their data.
--  Run: sudo -u postgres psql -d vigent -f /tmp/purge_inactive_users.sql
--
--  Safety:
--   * ON_ERROR_STOP + single transaction — any guard failure rolls back all.
--   * Guards: exactly 15 users / 15 workspaces, no ADMIN, all TRIAL,
--     all non-internal (excludeFromAdminReports = false).
--   * Post-delete orphan check across EVERY table that has a workspaceId
--     column (dynamic via information_schema) — leftovers abort the txn.
--
--  Backup taken before this script ran:
--   * full dump:  /var/backups/vignet/vignet-20260911-044826.sql.gz (+S3)
--   * targeted:   /root/purge-backup-20260911/ (CSV per table)
-- ============================================================================
\set ON_ERROR_STOP on

BEGIN;

CREATE TEMP TABLE purge_users ON COMMIT DROP AS
SELECT u.id, u.phone, u."workspaceId", u."platformRole"
FROM "User" u
WHERE u.id IN (
  'cmrjp9r7f0002eon77erd5159','cmrkj53ft0002eofga6t6rdmk','cmrkzaxfj0002eox85h2ld9oy',
  'cmrt2prv20004eono4uzofbup','cmrt2yoos000eeono31o13fh8','cms3fia500002eol1xmtr3jjq',
  'cms3rhfmy000veol1rsqyr1g7','cmsdt3rz60006eovdjseibogm','cmsroxjcq000deojmnuhecgts',
  'cmsroyrpa000leojme32am3b2','cmsrozjtu000teojmjjv467vy','cmsrozstw0011eojmqci8vtt3',
  'cmsrp08hr0019eojm5bcvhq1q','cmsrp1sos0023eojmz29lmar9','cmssoftdl002feojmx0jzfmde'
);

-- ── GUARDS ──────────────────────────────────────────────────────────────────
DO $guards$
DECLARE
  n_users int; n_ws int; n_admin int; n_paid int; n_internal int;
BEGIN
  SELECT count(*), count(DISTINCT "workspaceId") INTO n_users, n_ws FROM purge_users;
  SELECT count(*) INTO n_admin FROM purge_users WHERE "platformRole" = 'ADMIN';
  SELECT count(*) INTO n_paid
    FROM purge_users p JOIN "Workspace" w ON w.id = p."workspaceId"
    WHERE w.plan <> 'TRIAL';
  SELECT count(*) INTO n_internal
    FROM purge_users p JOIN "Workspace" w ON w.id = p."workspaceId"
    WHERE w."excludeFromAdminReports" = true;

  IF n_users <> 15 OR n_ws <> 15 THEN
    RAISE EXCEPTION 'GUARD: expected 15 users / 15 workspaces, got % / %', n_users, n_ws;
  END IF;
  IF n_admin <> 0 THEN
    RAISE EXCEPTION 'GUARD: % ADMIN users in purge set — aborting', n_admin;
  END IF;
  IF n_paid <> 0 THEN
    RAISE EXCEPTION 'GUARD: % non-TRIAL workspaces in purge set — aborting', n_paid;
  END IF;
  IF n_internal <> 0 THEN
    RAISE EXCEPTION 'GUARD: % internal workspaces in purge set — aborting', n_internal;
  END IF;
  RAISE NOTICE 'guards OK: 15 TRIAL users, 15 workspaces, no admins, no internal';
END
$guards$;

-- ── 1) Tables WITHOUT a workspace FK (manual cleanup) ──────────────────────
DELETE FROM "ErrorLog"    WHERE "workspaceId" IN (SELECT "workspaceId" FROM purge_users);
DELETE FROM "SmsDelivery" WHERE "workspaceId" IN (SELECT "workspaceId" FROM purge_users)
                            OR phone IN (SELECT phone FROM purge_users);
DELETE FROM "OTPLog"      WHERE phone IN (SELECT phone FROM purge_users);

-- ── 2) Main cascade: workspace delete removes User + entire tree ──────────
--      (Agent, AgentChannel, ChatLink, Conversation, Message, Contact,
--       KnowledgeBase/Chunks, Products, UsageLog, Wallet, Payments, Vigento,
--       Campaigns, Services, Appointments, Store*, Blog*, Improvement*, ...)
DELETE FROM "Workspace" WHERE id IN (SELECT "workspaceId" FROM purge_users);

-- ── 3) In-transaction verification ──────────────────────────────────────────
DO $verify$
DECLARE
  left_users int; left_ws int; left_agents int; left_otp int; left_sms int; left_err int;
  orphan_total int := 0;
  r record;
  q text;
BEGIN
  SELECT count(*) INTO left_users FROM "User"    WHERE id IN (SELECT id FROM purge_users);
  SELECT count(*) INTO left_ws    FROM "Workspace" WHERE id IN (SELECT "workspaceId" FROM purge_users);
  SELECT count(*) INTO left_agents FROM "Agent"  WHERE "workspaceId" IN (SELECT "workspaceId" FROM purge_users);
  SELECT count(*) INTO left_otp   FROM "OTPLog"  WHERE phone IN (SELECT phone FROM purge_users);
  SELECT count(*) INTO left_sms   FROM "SmsDelivery" WHERE phone IN (SELECT phone FROM purge_users)
                                            OR "workspaceId" IN (SELECT "workspaceId" FROM purge_users);
  SELECT count(*) INTO left_err   FROM "ErrorLog" WHERE "workspaceId" IN (SELECT "workspaceId" FROM purge_users);

  IF left_users + left_ws + left_agents + left_otp + left_sms + left_err <> 0 THEN
    RAISE EXCEPTION 'VERIFY FAILED: users=% ws=% agents=% otp=% sms=% err=%',
      left_users, left_ws, left_agents, left_otp, left_sms, left_err;
  END IF;

  -- dynamic orphan check: any table with a workspaceId column still holding rows?
  FOR r IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND c.column_name = 'workspaceId'
      AND t.table_type = 'BASE TABLE'
      AND c.table_name NOT IN ('purge_users')
  LOOP
    q := format('SELECT count(*) FROM %I WHERE "workspaceId" IN (SELECT "workspaceId" FROM purge_users)', r.table_name);
    EXECUTE q INTO orphan_total;
    IF orphan_total > 0 THEN
      RAISE EXCEPTION 'ORPHANS: table % has % leftover rows for purged workspaces', r.table_name, orphan_total;
    END IF;
  END LOOP;

  -- user-id referencing columns
  SELECT count(*) INTO orphan_total FROM "LoginEvent" WHERE "userId" IN (SELECT id FROM purge_users);
  IF orphan_total > 0 THEN RAISE EXCEPTION 'ORPHANS: LoginEvent %', orphan_total; END IF;
  SELECT count(*) INTO orphan_total FROM "WorkspaceVigentoThread" WHERE "actorId" IN (SELECT id FROM purge_users);
  IF orphan_total > 0 THEN RAISE EXCEPTION 'ORPHANS: WorkspaceVigentoThread %', orphan_total; END IF;
  SELECT count(*) INTO orphan_total FROM "KnowledgeApproval" WHERE "verifiedByUserId" IN (SELECT id FROM purge_users);
  IF orphan_total > 0 THEN RAISE EXCEPTION 'ORPHANS: KnowledgeApproval %', orphan_total; END IF;

  RAISE NOTICE 'verify OK: zero leftovers in all workspace-scoped tables';
END
$verify$;

COMMIT;

-- ── post-commit summary ─────────────────────────────────────────────────────
SELECT 'users_total_after' AS metric, count(*)::text AS value FROM "User"
UNION ALL SELECT 'workspaces_total_after', count(*)::text FROM "Workspace"
UNION ALL SELECT 'agents_total_after', count(*)::text FROM "Agent";
