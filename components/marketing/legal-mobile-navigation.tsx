'use client'

import { useRef, useState } from 'react'
import { ChevronDown, ListTree } from 'lucide-react'
import { MobileBottomSheet } from '@/components/ui/mobile-bottom-sheet'

export function LegalMobileNavigation({ sections }: { sections: string[] }) {
	const [open, setOpen] = useState(false)
	const triggerRef = useRef<HTMLButtonElement>(null)

	return (
		<div className="sticky top-20 z-30 lg:hidden">
			<button
				ref={triggerRef}
				type="button"
				onClick={() => setOpen(true)}
				aria-expanded={open}
				aria-haspopup="dialog"
				className="spatial-press flex min-h-12 w-full items-center gap-3 rounded-[1.15rem] border border-black/[0.08] bg-white/95 px-4 text-start text-sm font-semibold text-black shadow-[0_12px_34px_rgba(0,0,0,0.09)] backdrop-blur-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
			>
				<span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-black text-white">
					<ListTree className="h-4 w-4" aria-hidden="true" />
				</span>
				<span className="min-w-0 flex-1">فهرست سند</span>
				<span className="text-xs font-normal text-black/45">{sections.length.toLocaleString('fa-IR')} بخش</span>
				<ChevronDown className="h-4 w-4 shrink-0 text-black/45" aria-hidden="true" />
			</button>

			<MobileBottomSheet
				open={open}
				title="فهرست سند"
				description="برای رفتن مستقیم به هر بخش، عنوان آن را انتخاب کنید."
				closeLabel="بستن"
				triggerRef={triggerRef}
				onClose={() => setOpen(false)}
			>
				<nav aria-label="فهرست سند">
					<ol className="grid gap-2">
						{sections.map((section, index) => (
							<li key={section}>
								<a
									href={`#section-${index + 1}`}
									onClick={() => setOpen(false)}
									className="spatial-press flex min-h-12 items-center gap-3 rounded-xl border border-[var(--border-default)] bg-white px-3 text-sm font-semibold text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60"
								>
									<span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-black/[0.045] font-mono text-xs text-black/45">
										{String(index + 1).padStart(2, '0')}
									</span>
									<span className="min-w-0 flex-1">{section}</span>
								</a>
							</li>
						))}
					</ol>
				</nav>
			</MobileBottomSheet>
		</div>
	)
}
