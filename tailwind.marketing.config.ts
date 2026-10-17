import type { Config } from 'tailwindcss'
import base from './tailwind.config'

/*
 * Tailwind build for the public site (app/marketing.css). Same theme as the
 * app; only the content differs, so public pages stop downloading every
 * dashboard and admin utility (~90% of the old shared stylesheet).
 *
 * The list must cover every file a public page imports. tests/marketing-css-
 * content.test.ts walks the imports from app/(marketing) and fails when a new
 * import is not matched here — add it to this list when that happens.
 */
export const MARKETING_CONTENT = [
  './app/*marketing*/**/*.{js,ts,jsx,tsx,mdx}',
  './app/global-not-found.tsx',
  './app/root-document.tsx',
  './components/marketing/**/*.{js,ts,jsx,tsx,mdx}',
  './components/blog/{blog-image,trend-spark,public-blog-index,public-post-card,view-beacon}.tsx',
  './components/docs/**/*.{ts,tsx}',
  './components/motion/**/*.{ts,tsx}',
  './components/i18n/**/*.{ts,tsx}',
  './components/system/**/*.{ts,tsx}',
  './components/providers.tsx',
  './components/instagram/ios-kit.tsx',
  './components/payments/bank-card.tsx',
  './components/ui/{copy-button,language-switcher,logo,mobile-bottom-sheet}.tsx',
]

const config: Config = {
  ...base,
  content: MARKETING_CONTENT,
}

export default config
