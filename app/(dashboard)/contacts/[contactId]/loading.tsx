import { BackRowSkeleton } from '@/components/dashboard/agent-detail-skeletons'
import {
  ContactEditorSkeleton,
  DetailHeaderCardSkeleton,
  HistoryPanelSkeleton,
  IdentityChipsCardSkeleton,
} from '@/components/dashboard/pages-skeletons'

/**
 * Route-level skeleton for /contacts/[contactId] — an exact mirror of the
 * page: back button, header card (avatar + name + badges), channel
 * identities card, and the 2-column grid (editable details editor +
 * conversation history panel).
 */
export default function ContactDetailLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <BackRowSkeleton />

      {/* Header card — avatar (lg) + name + channel badges + delete action */}
      <DetailHeaderCardSkeleton delay={-80} avatar="lg" />

      {/* Channel identities */}
      <IdentityChipsCardSkeleton delay={-160} />

      {/* Details editor + conversation history */}
      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <ContactEditorSkeleton delay={-200} />
        <HistoryPanelSkeleton delay={-260} rows={3} />
      </div>
    </div>
  )
}
