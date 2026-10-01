'use client'

import { BackToTop } from '@/components/marketing/back-to-top'
import { MotionPauser } from '@/components/marketing/site/motion-pauser'

/**
 * Dashboard-only client boundary for components the public site also uses.
 *
 * Next merges the client-reference manifests of sibling route-group layouts
 * ((marketing), (dashboard), (auth) all map to the "app" group) and the last
 * entry wins. When the dashboard layout imported BackToTop/MotionPauser
 * directly, every public page resolved them to the dashboard layout's chunks
 * and downloaded ~73 KB gzipped of dashboard JS (framer-motion, sidebar,
 * notification bell…). Wrapping them here keeps the dashboard's boundary
 * module distinct, so public pages load only the marketing chunks.
 */
export function DashboardPageEffects() {
	return (
		<>
			<BackToTop />
			{/* Pauses decorative CSS loops (overview flow, cards) while off-screen. */}
			<MotionPauser />
		</>
	)
}
