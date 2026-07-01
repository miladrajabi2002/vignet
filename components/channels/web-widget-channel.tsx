'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import {
	Globe,
	Check,
	Copy,
	Loader2,
	Settings2,
	ChevronDown,
	AlertTriangle,
	ShieldAlert,
	Sparkles,
	Smartphone,
	RotateCw,
} from 'lucide-react'
import {
	normalizeWidgetSettings,
	normalizeDomains,
	WIDGET_ICONS,
	WIDGET_FONTS,
	type WidgetSettings,
	type WidgetFont,
} from '@/lib/widget/config'
import { WidgetPreview, WIDGET_ICON_COMPONENTS } from './widget-preview'

export function WebWidgetChannel({
	agentId,
	agentName,
	baseUrl,
	enabled,
	channelId,
	config,
	hasApiKey,
}: {
	agentId: string
	agentName: string
	baseUrl: string
	enabled: boolean
	channelId: string | null
	config: Record<string, unknown> | null
	hasApiKey: boolean
}) {
	const t = useTranslations('channels')
	const locale = useLocale()
	const isRtl = locale === 'fa'
	const router = useRouter()

	const [busy, setBusy] = useState(false)
	const [copied, setCopied] = useState(false)
	const [showSettings, setShowSettings] = useState(false)
	const [saving, setSaving] = useState(false)
	const [saved, setSaved] = useState(false)

	const initial = normalizeWidgetSettings(config)
	const [settings, setSettings] = useState<WidgetSettings>(initial)
	const [domainsText, setDomainsText] = useState(initial.allowedDomains.join('\n'))

	const snippet = `<script src="${baseUrl}/widget/loader.js" data-agent-id="${agentId}"></script>`

	function patch(p: Partial<WidgetSettings>) {
		setSettings((s) => ({ ...s, ...p }))
		setSaved(false)
	}

	async function enable() {
		setBusy(true)
		await fetch(`/api/agents/${agentId}/channels`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ type: 'WEB_WIDGET' }),
		})
		setBusy(false)
		router.refresh()
	}

	async function disable() {
		if (!channelId) return
		setBusy(true)
		await fetch(`/api/agents/${agentId}/channels/${channelId}`, { method: 'DELETE' })
		setBusy(false)
		router.refresh()
	}

	async function save() {
		setSaving(true)
		setSaved(false)
		const domains = normalizeDomains(domainsText)
		try {
			const res = await fetch(`/api/agents/${agentId}/channels`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					type: 'WEB_WIDGET',
					config: { ...settings, allowedDomains: domains },
				}),
			})
			if (!res.ok) throw new Error('save failed')
			setDomainsText(domains.join('\n'))
			setSaved(true)
			// Cache invalidation happens server-side in the POST /channels route.
			router.refresh()
		} catch {
			alert(t('saveError'))
		} finally {
			setSaving(false)
		}
	}

	function copy() {
		navigator.clipboard.writeText(snippet)
		setCopied(true)
		setTimeout(() => setCopied(false), 2000)
	}

	const liveSettings: WidgetSettings = {
		...settings,
		allowedDomains: normalizeDomains(domainsText),
	}
	const unprotected = liveSettings.allowedDomains.length === 0

	return (
		<div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
			<div className="flex items-center gap-3">
				<div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-default)] text-[var(--text-secondary)]">
					<Globe className="h-5 w-5" />
				</div>
				<div className="flex-1">
					<div className="font-medium text-[var(--text-primary)]">{t('webWidget')}</div>
					<div className="text-sm text-[var(--text-secondary)]">{t('widgetDesc')}</div>
				</div>
				{enabled ? (
					<button
						onClick={disable}
						disabled={busy}
						className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-default)] px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:text-danger disabled:opacity-50"
					>
						{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
						{t('disable')}
					</button>
				) : (
					<button
						onClick={enable}
						disabled={busy}
						className="inline-flex items-center gap-1 rounded-lg bg-[var(--white)] px-4 py-1.5 text-sm font-medium text-[var(--bg-base)] disabled:opacity-50"
					>
						{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
						{t('enable')}
					</button>
				)}
			</div>

			{enabled && (
				<div className="mt-4 space-y-4">
					{/* No-API-key warning */}
					{!hasApiKey && (
						<div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
							<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
							<div className="flex-1 text-sm text-[var(--text-primary)]">
								{t('noKeyWarning')}
								<Link
									href="/settings/ai-keys"
									className="ms-1 font-medium text-amber-500 underline hover:no-underline"
								>
									{t('noKeyCta')}
								</Link>
							</div>
						</div>
					)}

					{/* Embed code */}
					<div>
						<div className="mb-2 flex items-center justify-between">
							<span className="text-xs text-[var(--text-secondary)]">
								{t('embedCode')}
							</span>
							<button
								onClick={copy}
								className="inline-flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
							>
								{copied ? (
									<Check className="h-3.5 w-3.5 text-success" />
								) : (
									<Copy className="h-3.5 w-3.5" />
								)}
								{copied ? t('copied') : t('copy')}
							</button>
						</div>
						<pre
							dir="ltr"
							className="overflow-x-auto rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] p-3 text-xs text-[var(--text-primary)]"
						>
							<code>{snippet}</code>
						</pre>
					</div>

					{/* Settings toggle */}
					<button
						onClick={() => setShowSettings((v) => !v)}
						className="flex w-full items-center gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] px-4 py-3 text-start transition-colors hover:border-[var(--text-secondary)]"
					>
						<Settings2 className="h-4 w-4 text-[var(--text-secondary)]" />
						<div className="flex-1">
							<div className="text-sm font-medium text-[var(--text-primary)]">
								{t('widgetSettings')}
							</div>
							<div className="text-xs text-[var(--text-secondary)]">
								{t('widgetSettingsHint')}
							</div>
						</div>
						<ChevronDown
							className={`h-4 w-4 text-[var(--text-secondary)] transition-transform ${showSettings ? 'rotate-180' : ''}`}
						/>
					</button>

					{showSettings && (
						<div className="grid gap-5 lg:grid-cols-2">
							{/* Form */}
							<div className="space-y-5">
								{/* Appearance */}
								<section className="space-y-3">
									<h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
										{t('appearance')}
									</h4>

									<Field label={t('brandColor')}>
										<div className="flex items-center gap-2">
											<input
												type="color"
												value={settings.primaryColor}
												onChange={(e) => patch({ primaryColor: e.target.value })}
												className="h-9 w-12 cursor-pointer rounded-lg border border-[var(--border-default)] bg-transparent p-1"
											/>
											<input
												type="text"
												dir="ltr"
												value={settings.primaryColor}
												onChange={(e) => patch({ primaryColor: e.target.value })}
												className="w-28 rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none"
											/>
										</div>
									</Field>

									{/* Theme + Position side-by-side (compact) */}
									<div className="grid grid-cols-2 gap-3">
										<Field label={t('theme')}>
											<Segmented
												value={settings.theme}
												onChange={(v) => patch({ theme: v as WidgetSettings['theme'] })}
												options={[
													{ value: 'dark', label: t('themeDark') },
													{ value: 'light', label: t('themeLight') },
												]}
											/>
										</Field>
										<Field label={t('position')}>
											<Segmented
												value={settings.position}
												onChange={(v) =>
													patch({ position: v as WidgetSettings['position'] })
												}
												options={[
													{ value: 'right', label: t('posRight') },
													{ value: 'left', label: t('posLeft') },
												]}
											/>
										</Field>
									</div>

									<Field label={t('font')}>
										<div className="flex flex-wrap gap-2">
											{WIDGET_FONTS.map((f) => {
												const active = settings.font === f.value
												return (
													<button
														key={f.value}
														type="button"
														onClick={() => patch({ font: f.value as WidgetFont })}
														className={`rounded-xl border px-3.5 py-1.5 text-sm transition-colors ${
															active
																? 'border-[var(--white)] bg-[var(--white)] font-medium text-[var(--bg-base)]'
																: 'border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
														}`}
														style={{
															fontFamily: f.value === 'inherit' ? undefined : f.family,
														}}
													>
														{isRtl ? f.labelFa : f.labelEn}
													</button>
												)
											})}
										</div>
									</Field>

									<Field label={`${t('headerTitle')} · ${t('optional')}`}>
										<input
											type="text"
											value={settings.headerTitle ?? ''}
											placeholder={t('headerTitlePh')}
											onChange={(e) => patch({ headerTitle: e.target.value || null })}
											className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none"
										/>
									</Field>

									<Field label={`${t('launcherLabel')} · ${t('optional')}`}>
										<input
											type="text"
											value={settings.launcherLabel ?? ''}
											placeholder={t('launcherLabelPh')}
											onChange={(e) => patch({ launcherLabel: e.target.value || null })}
											className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none"
										/>
									</Field>

									<Field label={`${t('subtitle')} · ${t('optional')}`}>
										<input
											type="text"
											value={settings.subtitle ?? ''}
											placeholder={t('subtitlePh')}
											onChange={(e) => patch({ subtitle: e.target.value || null })}
											className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none"
										/>
									</Field>

									<Field label={t('icon')}>
										<div className="flex flex-wrap gap-2">
											{WIDGET_ICONS.map((key) => {
												const Ico = WIDGET_ICON_COMPONENTS[key]
												const active = settings.icon === key
												return (
													<button
														key={key}
														type="button"
														onClick={() => patch({ icon: key })}
														className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-colors ${
															active
																? 'border-[var(--white)] bg-[var(--white)] text-[var(--bg-base)]'
																: 'border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
														}`}
													>
														<Ico className="h-5 w-5" />
													</button>
												)
											})}
										</div>
									</Field>

									{/* Corners — range slider for flexibility */}
									<Field
										label={`${t('corners')} · ${settings.cornerRadius || settings.corners === 'soft' ? settings.cornerRadius || 17 : settings.corners === 'round' ? 20 : settings.corners === 'sharp' ? 9 : 17}px`}
									>
										<div className="space-y-2">
											<input
												type="range"
												min={0}
												max={30}
												step={1}
												value={settings.cornerRadius}
												onChange={(e) => patch({ cornerRadius: Number(e.target.value) })}
												className="w-full accent-[var(--white)]"
											/>
											<div className="flex items-center gap-1.5">
												<RotateCw className="h-3 w-3 text-[var(--text-muted)]" />
												<span className="text-[11px] text-[var(--text-muted)]">
													{isRtl
														? '۰ = استفاده از پیش‌فرض (ملایم). می‌توانید از ۱ تا ۳۰ تنظیم کنید.'
														: '0 = use preset (soft). Drag 1–30 for a custom radius.'}
												</span>
											</div>
											<div className="flex gap-1.5 pt-1">
												{(['sharp', 'soft', 'round'] as const).map((preset) => (
													<button
														key={preset}
														type="button"
														onClick={() => patch({ cornerRadius: 0, corners: preset })}
														className={`rounded-md border px-2 py-1 text-[11px] transition-colors ${
															settings.cornerRadius === 0 && settings.corners === preset
																? 'border-[var(--white)] bg-[var(--white)] text-[var(--bg-base)]'
																: 'border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
														}`}
													>
														{t(
															`corners${preset.charAt(0).toUpperCase()}${preset.slice(1)}` as Parameters<
																typeof t
															>[0],
														)}
													</button>
												))}
											</div>
										</div>
									</Field>
								</section>

								{/* Interaction */}
								<section className="space-y-3">
									<h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
										<Sparkles className="h-3.5 w-3.5" />
										{t('interaction')}
									</h4>

									<Toggle
										label={t('autoGreetLabel')}
										hint={t('autoGreetHint')}
										checked={settings.autoGreet}
										onChange={(v) => patch({ autoGreet: v })}
									/>
									{settings.autoGreet && (
										<Field
											label={`${t('autoGreetDelayLabel')} · ${(settings.autoGreetDelayMs / 1000).toFixed(1)}s`}
										>
											<input
												type="range"
												min={1000}
												max={15000}
												step={500}
												value={settings.autoGreetDelayMs}
												onChange={(e) =>
													patch({ autoGreetDelayMs: Number(e.target.value) })
												}
												className="w-full accent-[var(--white)]"
											/>
										</Field>
									)}

									{/* Lead capture */}
									<Toggle
										label={t('leadCaptureLabel')}
										hint={t('leadCaptureHint')}
										checked={settings.leadCapture}
										onChange={(v) => patch({ leadCapture: v })}
									/>
									{settings.leadCapture && (
										<Field label={`${t('leadCaptureMessage')} · ${t('optional')}`}>
											<textarea
												rows={2}
												value={settings.leadCaptureMessage ?? ''}
												placeholder={t('leadCaptureMessagePh')}
												onChange={(e) =>
													patch({ leadCaptureMessage: e.target.value || null })
												}
												className="w-full resize-none rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none"
											/>
										</Field>
									)}
								</section>

								{/* Security */}
								<section className="space-y-3">
									<h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
										<ShieldAlert className="h-3.5 w-3.5" />
										{t('security')}
									</h4>
									<Field label={t('allowedDomains')}>
										<textarea
											dir="ltr"
											rows={3}
											value={domainsText}
											placeholder={t('allowedDomainsPh')}
											onChange={(e) => {
												setDomainsText(e.target.value)
												setSaved(false)
											}}
											className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none"
										/>
										<p className="mt-1 text-xs text-[var(--text-secondary)]">
											{t('allowedDomainsHint')}
										</p>
									</Field>
									{unprotected && (
										<div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-[var(--text-primary)]">
											<AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
											{t('unprotectedWarning')}
										</div>
									)}
								</section>

								<div className="flex items-center gap-3">
									<button
										onClick={save}
										disabled={saving}
										className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--white)] px-4 py-2 text-sm font-medium text-[var(--bg-base)] disabled:opacity-50"
									>
										{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
										{saving ? t('saving') : t('save')}
									</button>
									{saved && (
										<span className="inline-flex items-center gap-1 text-sm text-success">
											<Check className="h-4 w-4" />
											{t('saved')}
										</span>
									)}
								</div>
							</div>

							{/* Live preview */}
							<div className="space-y-2">
								<div className="flex items-center justify-between">
									<span className="text-xs text-[var(--text-secondary)]">
										{t('livePreview')}
									</span>
									<span className="inline-flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
										<Smartphone className="h-3 w-3" />
										{isRtl ? 'پیش‌نمایش تعاملی' : 'Interactive preview'}
									</span>
								</div>
								<WidgetPreview
									settings={liveSettings}
									agentName={agentName}
									isRtl={isRtl}
								/>
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	)
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<label className="block">
			<span className="mb-1.5 block text-sm text-[var(--text-primary)]">{label}</span>
			{children}
		</label>
	)
}

function Toggle({
	label,
	hint,
	checked,
	onChange,
}: {
	label: string
	hint: string
	checked: boolean
	onChange: (v: boolean) => void
}) {
	return (
		<button
			type="button"
			onClick={() => onChange(!checked)}
			className="flex w-full items-center gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] p-3 text-start"
		>
			<div className="flex-1">
				<div className="text-sm text-[var(--text-primary)]">{label}</div>
				<div className="text-xs text-[var(--text-secondary)]">{hint}</div>
			</div>
			<span
				className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
					checked ? 'bg-[var(--white)]' : 'bg-[var(--border-default)]'
				}`}
			>
				<span
					className={`absolute top-0.5 h-4 w-4 rounded-full transition-all ${
						checked
							? 'start-[18px] bg-[var(--bg-base)]'
							: 'start-0.5 bg-[var(--text-secondary)]'
					}`}
				/>
			</span>
		</button>
	)
}

function Segmented({
	value,
	onChange,
	options,
}: {
	value: string
	onChange: (v: string) => void
	options: { value: string; label: string }[]
}) {
	return (
		<div className="inline-flex w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] p-0.5">
			{options.map((o) => (
				<button
					key={o.value}
					onClick={() => onChange(o.value)}
					className={`flex-1 rounded-md px-3 py-1.5 text-sm transition-colors ${
						value === o.value
							? 'bg-[var(--white)] font-medium text-[var(--bg-base)]'
							: 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
					}`}
				>
					{o.label}
				</button>
			))}
		</div>
	)
}
