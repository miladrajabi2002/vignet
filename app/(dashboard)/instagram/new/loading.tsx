import { AutomationFormSkeleton } from '@/components/dashboard/pages-skeletons'

/**
 * Route-level skeleton for /instagram/new — mirrors AutomationForm
 * (create mode): account header + 2-column grid (scenario fields left,
 * account + trigger summary cards right).
 */
export default function InstagramNewAutomationLoading() {
  return <AutomationFormSkeleton />
}
