import { redirect } from 'next/navigation'

// Analytics is now merged into /overview for a cleaner dashboard.
// Per-agent analytics still lives at /agents/[id]/analytics.
export default function AnalyticsRedirect() {
	redirect('/overview')
}
