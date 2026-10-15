import Link from 'next/link'
import { ArrowLeft, WalletCards } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { GatewayFlowMotion } from '@/components/payments/gateway-flow-motion'
import { getPlatformGatewaySettings } from '@/lib/payments/card/platform'

const SAMPLE_AMOUNT = 1_250_347

/**
 * «نمای کلی»: the payment gateway before it is live — the flow animated on
 * a sample card and the way in. Once it is live the overview's flow shows
 * the real cards instead (components/dashboard/gateway-dock.tsx) and the
 * page leaves this tile out. Silent when the platform has the gateway off,
 * the business is paused, or the database has no gateway tables.
 */
export async function GatewayOverviewTile({ workspaceId, locale }: { workspaceId: string; locale: 'fa' | 'en' }) {
	const fa = locale !== 'en'
	const available = await (async () => {
		const [workspace, platform] = await Promise.all([
			prisma.workspace.findUnique({ where: { id: workspaceId }, select: { payGatewaySuspendedAt: true } }),
			getPlatformGatewaySettings(),
		])
		return platform.enabled && !workspace?.payGatewaySuspendedAt
	})().catch(() => false)
	if (!available) return null

	return (
		<section aria-label={fa ? 'درگاه پرداخت' : 'Payment gateway'} className="spatial-surface grid gap-5 rounded-card p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] lg:items-center">
			<div className="min-w-0">
				<span className="inline-flex items-center gap-1.5 rounded-full bg-[#ede9fe] px-2.5 py-1 text-[12px] font-bold text-[#5b3de8]"><WalletCards className="size-3.5" aria-hidden />{fa ? 'درگاه پرداخت ویجنت' : 'Vigent payment gateway'}</span>
				<h2 className="mt-2.5 text-[17px] font-extrabold leading-8 text-[var(--text-primary)]">{fa ? 'کارت‌به‌کارت، بدون اینکه شما حساب را چک کنید' : 'Card-to-card, without you checking the account'}</h2>
				<p className="mt-1.5 text-[13.5px] leading-7 text-[var(--text-secondary)]">
					{fa
						? 'ایجنت کارت شما را با یک مبلغ دقیق در گفتگو می‌فرستد؛ پیامک واریز بانک که برسد، سفارش، نوبت یا ثبت‌نام خودکار تأیید می‌شود. بدون درگاه بانکی، اینماد و کد مالیاتی.'
						: 'The agent sends your card with an exact amount in the chat; when the bank’s deposit SMS arrives, the order, booking or sign-up is confirmed by itself. No bank gateway or Enamad needed.'}
				</p>
				<Link href="/payments" className="spatial-press mt-3.5 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-[var(--text-primary)] px-4 text-sm font-bold text-white dark:text-neutral-900">
					{fa ? 'راه‌اندازی قدم‌به‌قدم' : 'Set it up step by step'}<ArrowLeft className="size-4 ltr:rotate-180" aria-hidden />
				</Link>
			</div>
			<GatewayFlowMotion bankKey="mellat" pan="6104 33•• •••• 5675" holder={fa ? 'نام شما' : 'Your name'} amount={SAMPLE_AMOUNT} lang={locale} />
		</section>
	)
}
