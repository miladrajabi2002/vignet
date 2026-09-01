'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useLocale } from 'next-intl'
import { Check, Sparkles, X } from 'lucide-react'
import {
	getDashboardModules,
	getVerticalPack,
	type BusinessTypeValue,
	type DashboardModuleKey,
} from '@/lib/verticals/registry'

const MODULES: Partial<Record<DashboardModuleKey, { href: string; fa: string; en: string }>> = {
	products: { href: '/products', fa: 'محصولات و منو', en: 'Products & menu' },
	services: { href: '/services', fa: 'خدمات', en: 'Services' },
	menu: { href: '/menu', fa: 'منوی دیجیتال', en: 'Digital menu' },
	appointments: { href: '/appointments', fa: 'رزروها و نوبت‌ها', en: 'Bookings & appointments' },
	instagram: { href: '/instagram', fa: 'اتوماسیون اینستاگرام', en: 'Instagram automation' },
}

type ChangeDetail = {
	businessType: BusinessTypeValue
	services: string[]
	modules: DashboardModuleKey[]
	newlyEnabled: DashboardModuleKey[]
	verticalTitle?: string
	changedAt: number
}

export function VerticalChangeNotice({ businessType, services }: { businessType?: BusinessTypeValue | null; services: readonly string[] }) {
	const fa = useLocale() !== 'en'
	const initialModules = useMemo(() => getDashboardModules(businessType, services), [businessType, services])
	const [change, setChange] = useState<ChangeDetail | null>(null)

	useEffect(() => {
		function accept(detail: ChangeDetail | null) {
			if (!detail || Date.now() - Number(detail.changedAt) > 5_000) return
			setChange(detail)
		}
		function onChange(event: Event) {
			accept((event as CustomEvent<ChangeDetail>).detail)
		}
		window.addEventListener('vigent:vertical-changed', onChange)
		try {
			const stored = JSON.parse(localStorage.getItem('vigent:vertical-change') ?? 'null') as ChangeDetail | null
			if (stored?.businessType === businessType) accept(stored)
		} catch {}
		return () => window.removeEventListener('vigent:vertical-changed', onChange)
	}, [businessType])

	useEffect(() => {
		if (!change) return
		const timer = window.setTimeout(() => {
			setChange(null)
			try { localStorage.removeItem('vigent:vertical-change') } catch {}
		}, Math.max(0, 5_000 - (Date.now() - Number(change.changedAt))))
		return () => window.clearTimeout(timer)
	}, [change])

	function dismiss() {
		setChange(null)
		try { localStorage.removeItem('vigent:vertical-change') } catch {}
	}

	if (!change) return null
	const enabled = (change.newlyEnabled.length ? change.newlyEnabled : change.modules.filter((item) => !initialModules.includes(item)))
		.map((key) => ({ key, ...MODULES[key] }))
		.filter((item): item is { key: DashboardModuleKey; href: string; fa: string; en: string } => Boolean(item.href))
	const pack = getVerticalPack(change.businessType)
	const title = change.verticalTitle || (fa ? pack.titleFa : pack.titleEn)

	return (
		<aside className="fixed inset-x-3 z-[90] mx-auto max-w-xl rounded-[1.5rem] border border-white/10 bg-black p-4 text-white shadow-[0_26px_80px_rgba(0,0,0,0.28)] [animation:spatial-pop_240ms_cubic-bezier(0.23,1,0.32,1)] [bottom:calc(6rem+env(safe-area-inset-bottom))] motion-reduce:animate-none md:bottom-5 md:p-5" aria-live="polite">
			<div className="flex items-start gap-3">
				<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-black"><Sparkles className="h-4 w-4" /></span>
				<div className="min-w-0 flex-1">
					<p className="text-sm font-semibold">{fa ? `پنل برای «${title}» به‌روزرسانی شد` : `Dashboard updated for “${title}”`}</p>
					<p className="mt-1 text-[11px] leading-5 text-white/45">{enabled.length ? (fa ? 'ابزارهای تازه همین حالا به منو اضافه شدند' : 'New tools are now available in navigation') : (fa ? 'چیدمان و پیشنهادهای پنل با کسب‌وکار جدید هماهنگ شد' : 'Navigation and suggestions now match the new business')}</p>
					{enabled.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{enabled.map((item) => <Link key={item.key} href={item.href} onClick={dismiss} className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-white px-3 text-[11px] font-semibold text-black"><Check className="h-3 w-3" />{fa ? item.fa : item.en}</Link>)}</div>}
				</div>
				<button type="button" onClick={dismiss} aria-label={fa ? 'بستن' : 'Close'} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white/45 transition-colors hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
			</div>
		</aside>
	)
}
