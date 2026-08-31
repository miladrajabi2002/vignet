'use client'

import { useSyncExternalStore } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

function subscribe(onChange: () => void) {
	const media = window.matchMedia(QUERY)
	media.addEventListener('change', onChange)
	return () => media.removeEventListener('change', onChange)
}

function getSnapshot() {
	return window.matchMedia(QUERY).matches
}

/** Hydration-safe access to the user's motion preference without a library. */
export function useReducedMotionPreference() {
	return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
