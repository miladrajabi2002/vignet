import type { Config } from 'tailwindcss'

const IRIS = {
  50: '#f3f1ff',
  100: '#e6e1ff',
  200: '#d5cdff',
  300: '#b9adff',
  400: '#9685fb',
  500: '#765ff2',
  600: '#5b3de8',
  700: '#4c2fd0',
  800: '#3d27a6',
  900: '#302080',
  950: '#1e1452',
}

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // NOTE: no `base` key here — it would collide with the `base` fontSize
        // and generate `.text-base { color: var(--bg-base) }` (white), silently
        // overriding text color on any element using the `text-base` size class.
        // Backgrounds are referenced via arbitrary values, e.g. bg-[var(--bg-base)].
        surface: 'var(--bg-surface)',
        elevated: 'var(--bg-elevated)',
        hover: 'var(--bg-hover)',
        muted: 'var(--bg-muted)',
        border: {
          subtle: 'var(--border-subtle)',
          DEFAULT: 'var(--border-default)',
          hover: 'var(--border-hover)',
          strong: 'var(--border-strong)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
          hint: 'var(--text-hint)',
        },
        // Public-site palette (marketing redesign). Ink is the primary action,
        // signal violet marks data flow, `sub` (#55524C) is the lightest grey
        // allowed for body copy so it keeps 4.5:1 on the #F5F5F3 canvas.
        // One iris for every violet/purple utility (palette option C),
        // so stray Tailwind violet-*/purple-* classes can't drift from --signal.
        // 600 = --signal, 700 = --signal-strong, 100 = --signal-tint, 50 = --signal-soft.
        violet: IRIS,
        purple: IRIS,
        vg: {
          bg: '#f5f5f3',
          ink: '#111111',
          signal: '#5b3de8',
          soft: '#e6e1ff',
          tint: '#f3f1ff',
          sub: '#55524c',
          cap: '#6f6a64',
          dim: '#8c8780',
          ok: '#15803d',
          line: 'rgba(17,17,17,0.08)',
        },
        // Semantic — dashboard states only
        // --ok (#15803d) passes 4.5:1 as text on white; --green (#22c55e) is
        // 2.3:1 and stays for live dots and chart strokes only.
        success: 'var(--ok)',
        danger: 'var(--red)',
        warning: 'var(--amber)',
        info: 'var(--blue)',
      },
      // Four concentric radius steps (tokens in globals.css). Tailwind's own
      // md / lg / xl / 2xl / 3xl resolve onto the same steps so old and new
      // classes agree; `md` used to be a fifth, off-scale 6px.
      borderRadius: {
        chip: 'var(--radius-chip)',
        control: 'var(--radius-control)',
        card: 'var(--radius-card)',
        sheet: 'var(--radius-sheet)',
        md: 'var(--radius-chip)',
        lg: 'var(--radius-chip)',
        xl: 'var(--radius-control)',
        '2xl': 'var(--radius-card)',
        '3xl': 'var(--radius-sheet)',
      },
      // Three elevation levels (globals.css): hairline only / --elev-1 card /
      // --elev-2 floating. Tailwind's presets land on the same levels.
      boxShadow: {
        sm: 'var(--shadow-xs)',
        DEFAULT: 'var(--elev-1)',
        md: 'var(--elev-1)',
        lg: 'var(--elev-2)',
        xl: 'var(--elev-2)',
        '2xl': 'var(--elev-2)',
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
        fa: ['var(--font-fa)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // Persian glyphs need ≥12px on phones; 12px is the floor for any text.
        xs: ['12px', { lineHeight: '1.6' }],
        sm: ['13px', { lineHeight: '1.6' }],
        base: ['15px', { lineHeight: '1.7' }],
        lg: ['18px', { lineHeight: '1.5' }],
        xl: ['22px', { lineHeight: '1.3' }],
        '2xl': ['28px', { lineHeight: '1.2' }],
        '3xl': ['36px', { lineHeight: '1.15' }],
        '4xl': ['48px', { lineHeight: '1.1' }],
        '5xl': ['64px', { lineHeight: '1.05' }],
        '6xl': ['80px', { lineHeight: '1.0' }],
      },
      // IRANSansWeb ships 300 / 400 / 500 / 700 only. A 600 request resolved to
      // the 700 face, so "semibold" labels rendered exactly like bold titles and
      // the hierarchy collapsed. Every weight class now names a face that exists:
      // semibold is the label weight (500); extrabold/black collapse to bold.
      fontWeight: {
        light: '300',
        normal: '400',
        medium: '500',
        semibold: '500',
        bold: '700',
        extrabold: '700',
        black: '700',
      },
      animation: {
        shimmer: 'shimmer-sweep 2.5s linear infinite',
        blink: 'blink 1s step-end infinite',
        beam: 'beam-pulse 5s ease-in-out infinite',
        'beam-slow': 'beam-pulse 7s ease-in-out infinite',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
}

export default config
