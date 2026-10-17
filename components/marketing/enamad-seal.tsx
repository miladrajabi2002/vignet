const ENAMAD_ID = '8135960'
const ENAMAD_CODE = 'gLG75YsUFqM1D6GfEMdO4iabvUscv0r5'
const ENAMAD_QUERY = `id=${ENAMAD_ID}&Code=${ENAMAD_CODE}`

/**
 * eNamad trust seal (نماد اعتماد الکترونیکی), server-rendered with no client
 * JavaScript.
 *
 * Two stacked images:
 * - underneath, a local copy (/brands/enamad-seal.png) so visitors who cannot
 *   reach eNamad still see the seal. eNamad drops connections from outside
 *   Iran (VPN users included) instead of refusing them, so the live request
 *   hangs rather than failing, and an onerror swap would come far too late;
 * - on top, the live badge served by eNamad. It is a status badge (valid,
 *   «منقضی شده», or a 1×1 blank once revoked), so whenever eNamad answers,
 *   its opaque white image covers the copy and the live status wins.
 *
 * Cost is contained: both images are lazy and low priority inside the
 * content-visibility footer, so nothing is requested until the footer is
 * about to scroll into view; the tile has a fixed size and both images are
 * absolutely positioned inside it, so a slow or failed load can never shift
 * the layout. The live image has no width/height on purpose: until it loads
 * it has no height, so its white backdrop paints nothing over the copy.
 *
 * eNamad validates both requests by their referrer, hence
 * `referrerPolicy="origin"` — never add rel="noreferrer" to this link.
 */
export function EnamadSeal({ label, className = '' }: { label: string; className?: string }) {
	return (
		<a
			referrerPolicy="origin"
			target="_blank"
			rel="noopener"
			href={`https://trustseal.enamad.ir/?${ENAMAD_QUERY}`}
			className={`vg-press relative inline-flex h-[90px] w-[84px] shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-vg-line bg-white ${className}`}
		>
			{/* eslint-disable-next-line @next/next/no-img-element */}
			<img
				src="/brands/enamad-seal.png"
				alt={label}
				loading="lazy"
				decoding="async"
				fetchPriority="low"
				className="absolute left-1/2 top-1/2 w-[68px] max-w-none -translate-x-1/2 -translate-y-1/2 text-center text-[10px] font-medium leading-[1.5] text-vg-cap"
			/>
			{/* eslint-disable-next-line @next/next/no-img-element */}
			<img
				referrerPolicy="origin"
				src={`https://trustseal.enamad.ir/logo.aspx?${ENAMAD_QUERY}`}
				alt=""
				loading="lazy"
				decoding="async"
				fetchPriority="low"
				className="absolute left-1/2 top-1/2 w-[68px] max-w-none -translate-x-1/2 -translate-y-1/2 bg-white"
				// Part of eNamad's official snippet; not a typed <img> attribute.
				{...{ code: ENAMAD_CODE }}
			/>
		</a>
	)
}
