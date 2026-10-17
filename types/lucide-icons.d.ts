// Per-icon lucide modules, imported by components/marketing/site/sprite-icons.tsx
// for their drawing data (`__iconNode`) next to the icon component itself.
declare module 'lucide-react/dist/esm/icons/*.mjs' {
	import type { IconNode, LucideIcon } from 'lucide-react'

	export const __iconNode: IconNode
	const Icon: LucideIcon
	export default Icon
}
