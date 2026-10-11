const ENAMAD_ID = '8135960'
const ENAMAD_CODE = 'gLG75YsUFqM1D6GfEMdO4iabvUscv0r5'
const ENAMAD_QUERY = `id=${ENAMAD_ID}&Code=${ENAMAD_CODE}`

/**
 * eNamad trust seal (نماد اعتماد الکترونیکی), server-rendered with no client
 * JavaScript.
 *
 * The image is deliberately served by eNamad instead of being copied into
 * /public: it is a live status badge (valid, «منقضی شده», or a 1×1 blank
 * once revoked), so a local copy would keep vouching for the site after that
 * stops being true. Its cost is contained instead:
 * - lazy and low priority inside the content-visibility footer, so nothing
 *   is requested until the footer is about to scroll into view;
 * - the tile has a fixed size and the image is absolutely positioned inside
 *   it, so a slow or failed load can never shift the layout;
 * - no width/height attributes on purpose: an image that has not loaded has
 *   no height, so its white backdrop paints nothing and the label underneath
 *   stays readable. eNamad does not answer from outside Iran (VPN users
 *   included); those visitors get the label instead of an empty box.
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
			<span className="w-[60px] text-center text-[10px] font-medium leading-[1.5] text-vg-cap">{label}</span>
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
