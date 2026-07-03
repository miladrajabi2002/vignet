import { redirect } from 'next/navigation'

/**
 * The "منابع سرور" page has been removed from the admin nav.
 * CPU + RAM live charts now live at the bottom of the dashboard.
 * This route redirects any old bookmarks to the dashboard.
 */
export default function AdminSystemPage() {
  redirect('/admin')
}
