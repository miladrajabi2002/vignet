import { redirect } from 'next/navigation'

/**
 * The standalone "کسب‌وکارها" page has been merged into "کاربران".
 * Each user row now shows its workspace name, plan, agents, conversations,
 * and a 7-day conversation sparkline — so the separate workspace list is
 * redundant. This route redirects any old bookmarks to the unified users page.
 *
 * The per-workspace detail page at /admin/workspaces/[workspaceId] is kept
 * because it's linked from user detail rows and deep links.
 */
export default function AdminWorkspacesPage() {
  redirect('/admin/users')
}
