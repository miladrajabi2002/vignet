import { VigentoWorkspaceSkeleton } from '@/components/dashboard/pages-skeletons'

/**
 * Route-level skeleton for /vigento — mirrors the VigentoWorkspace page.
 * The exact source class (including its `inmax` typo) is reused so the
 * generated CSS places the 19rem aside beside the chat at xl.
 */
export default function VigentoLoading() {
  return <VigentoWorkspaceSkeleton />
}
