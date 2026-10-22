import { ImageResponse } from 'next/og'

/*
 * The 1200×630 share card served at /opengraph-image and /twitter-image
 * (app/opengraph-image/route.tsx, app/twitter-image/route.tsx). They are plain
 * route handlers rather than the opengraph-image file convention: the files
 * sit above both root layouts, where Next would not attach them anyway, and
 * as convention files Next resolved them before any layout set metadataBase
 * and logged a spurious warning. app/root-document.tsx lists them explicitly.
 */
export const alt = 'Vigent — AI sales, support and omnichannel CRM'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export function renderShareImage() {
	return new ImageResponse(
		(
			<div
				style={{
					alignItems: 'stretch',
					background: '#050505',
					color: 'white',
					display: 'flex',
					flexDirection: 'column',
					height: '100%',
					justifyContent: 'space-between',
					overflow: 'hidden',
					padding: '64px 72px',
					position: 'relative',
					width: '100%',
				}}
			>
				<div style={{ display: 'flex', gap: 12, left: 72, position: 'absolute', top: 64 }}>
					<div style={{ background: '#fff', borderRadius: 99, height: 14, width: 14 }} />
					<div style={{ background: '#fff', borderRadius: 99, height: 14, opacity: 0.35, width: 14 }} />
					<div style={{ background: '#fff', borderRadius: 99, height: 14, opacity: 0.12, width: 14 }} />
				</div>

				<div
					style={{
						border: '1px solid rgba(255,255,255,0.12)',
						borderRadius: 999,
						height: 440,
						position: 'absolute',
						right: -70,
						top: -95,
						width: 440,
					}}
				/>
				<div
					style={{
						border: '1px solid rgba(255,255,255,0.07)',
						borderRadius: 999,
						height: 630,
						position: 'absolute',
						right: -165,
						top: -190,
						width: 630,
					}}
				/>

				<div style={{ display: 'flex', flexDirection: 'column', marginTop: 112, maxWidth: 930 }}>
					<div style={{ color: 'rgba(255,255,255,0.42)', display: 'flex', fontSize: 22, letterSpacing: 5 }}>
						INTELLIGENT BUSINESS OPERATIONS
					</div>
					<div style={{ display: 'flex', fontSize: 104, fontWeight: 700, letterSpacing: -6, lineHeight: 1.05, marginTop: 28 }}>
						Vigent
					</div>
					<div style={{ color: 'rgba(255,255,255,0.62)', display: 'flex', fontSize: 34, lineHeight: 1.35, marginTop: 22 }}>
						AI sales, support, booking and CRM — one workspace, every channel.
					</div>
				</div>

				<div style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between' }}>
					<div style={{ display: 'flex', gap: 10 }}>
						{['Instagram', 'Telegram', 'Bale', 'Web'].map((channel) => (
							<div
								key={channel}
								style={{
									border: '1px solid rgba(255,255,255,0.14)',
									borderRadius: 999,
									color: 'rgba(255,255,255,0.55)',
									display: 'flex',
									fontSize: 17,
									padding: '10px 18px',
								}}
							>
								{channel}
							</div>
						))}
					</div>
					<div style={{ color: 'rgba(255,255,255,0.35)', display: 'flex', fontSize: 20 }}>vigent.ir</div>
				</div>
			</div>
		),
		{ ...size },
	)
}
