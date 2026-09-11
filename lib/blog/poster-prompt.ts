/**
 * Blog poster prompt builder — shared by the JSON import dialog and the
 * admin blog manager's "no cover image" helper.
 *
 * Generates a ready-to-paste image-generation prompt (Grok Image /
 * Midjourney / DALL-E) in one of three fixed accent palettes, including the
 * Vigent bilingual wordmark, vigent.ir URL and the 1536×1024 spec.
 */

export interface PosterColor {
  key: string
  labelFa: string
  labelEn: string
  hex: string
  moodFa: string
  moodEn: string
}

// ── Poster color variants (3 fixed palettes) ────────────────────────
export const POSTER_COLORS: PosterColor[] = [
  {
    key: 'blue',
    labelFa: 'آبی سلطنتی',
    labelEn: 'Royal Blue',
    hex: '#2563EB',
    moodFa: 'فناوری، هوش مصنوعی، اتوماسیون',
    moodEn: 'tech, AI, automation',
  },
  {
    key: 'green',
    labelFa: 'سبز زمردی',
    labelEn: 'Emerald',
    hex: '#10B981',
    moodFa: 'پشتیبانی، موفقیت، بهره‌وری',
    moodEn: 'support, success, productivity',
  },
  {
    key: 'amber',
    labelFa: 'کهربایی گرم',
    labelEn: 'Warm Amber',
    hex: '#F59E0B',
    moodFa: 'فروش، رشد، تجاری',
    moodEn: 'sales, growth, business',
  },
]

export function buildPosterPrompt(color: PosterColor, topic: string, summary: string): string {
  const colorName = color.labelEn.toLowerCase()
  const colorHex = color.hex
  return `You are a professional editorial poster designer for "Vigent" — an Iranian AI agent SaaS platform.

TASK: Design a blog cover poster at exactly 1536×1024 pixels (landscape, 3:2 ratio).

═══════════════════════════════════════════
MANDATORY ELEMENTS (every poster must have)
═══════════════════════════════════════════

1. Bilingual brand wordmark "ویجنت" (Persian, large, RTL) + "VIGENT" (English, smaller, below or beside the Persian) — both clearly visible and legible. Use a modern, clean sans-serif font. The Persian wordmark is the hero element.

2. Website URL "vigent.ir" — small, elegant, placed at the bottom corner (bottom-right or bottom-left). Use a monospace or refined sans-serif. Subtle but readable.

3. Topic visual — a conceptual illustration representing the blog post topic (see TOPIC below). Should be the dominant visual element, not the text.

4. Subtle blog-post hint — a small icon, badge, or tag that signals "this is a blog article" (e.g., a stylized article icon, a "خواندن" reading tag, or an abstract page-corner motif). Keep it minimal.

═══════════════════════════════════════════
TOPIC: ${topic}
═══════════════════════════════════════════

CONTENT SUMMARY (use this to inspire the visual):
${summary}

═══════════════════════════════════════════
VISUAL STYLE
═══════════════════════════════════════════

• Style: cinematic editorial tech illustration meets modern Persian poster design. Think Stripe blog covers × Iranian minimalism × Apple keynote aesthetics.
• Mood: professional, optimistic, premium, trustworthy — NOT corporate-stiff, NOT playful-cartoon.
• Composition: rule of thirds, generous negative space, clear focal point, the wordmark sits confidently but doesn't compete with the topic visual.
• Lighting: soft cinematic lighting, subtle glow on the focal subject, gentle gradient background (not flat, not busy).
• Depth: shallow depth-of-field on the topic subject, background softly blurred.
• Color palette: monochrome base (charcoal #0a0a0a → soft white #f5f5f5) with ONE ${colorName} accent (${colorHex}).
  - Use ${colorName} for glows, lighting and the focal illustration.
  - No other accent colors.
• Texture: subtle film grain, very light noise, NO harsh gradients, NO mesh gradients.
• Typography on poster: only the bilingual wordmark + URL + optionally a 3-5 word Persian headline (optional, only if it fits naturally). Do NOT clutter with long text.

═══════════════════════════════════════════
TECHNICAL SPECS
═══════════════════════════════════════════

• Dimensions: EXACTLY 1536 × 1024 pixels (landscape 3:2)
• Resolution: high detail, print-quality sharpness
• Aspect ratio flag: --ar 3:2 (or 1536:1024 if the tool supports custom)
• Quality flag: --q 2 --v 6 (Midjourney v6) or equivalent high-quality
• NO watermark, NO signature, NO stock-photo watermarks
• NO English text other than "VIGENT" wordmark and "vigent.ir" URL
• NO Persian text other than "ویجنت" wordmark and (optional) short headline

═══════════════════════════════════════════
NEGATIVE PROMPT (things to avoid)
═══════════════════════════════════════════

Avoid: cluttered composition, cheap stock-photo look, cartoon style, anime style, photorealistic humans (use abstract/silhouette instead), busy backgrounds, harsh colors, neon overload, drop shadows on text, comic-sans or decorative fonts, multiple competing focal points, text-heavy posters, low-contrast text on busy backgrounds, 3D render plastic look, any accent color other than ${colorName}.

═══════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════

Produce ONE final image at 1536×1024. Then provide:
1. A short description (2-3 sentences) of what you depicted and why it fits the topic.
2. The exact Midjourney/DALL-E prompt you used (for reproducibility).

═══════════════════════════════════════════
EXAMPLE OUTPUT PROMPT (for reference)
═══════════════════════════════════════════

"A cinematic editorial blog cover for Vigent, 1536x1024 landscape. Centered composition: a stylized glowing Telegram paper-plane icon emerging from a sleek smartphone, surrounded by subtle floating chat bubbles with Persian script fragments. Above, the bilingual wordmark 'ویجنت' in elegant Persian Nastaliq-modern sans-serif, with 'VIGENT' in clean uppercase Latin beneath. Bottom-right corner: 'vigent.ir' in refined monospace. Background: deep charcoal #0a0a0a with a soft ${colorName} ${colorHex} accent glow behind the focal subject, gentle radial gradient, subtle film grain. Shallow depth of field, soft cinematic lighting, premium tech-editorial aesthetic. A small 'مقاله' (article) tag in the top-left corner. Negative: clutter, cartoon, photorealistic humans, busy background, neon. --ar 3:2 --q 2 --v 6"

═══════════════════════════════════════════
NOW: design the poster for the topic above with the ${colorName} (${colorHex}) accent color. Output the image + description + the prompt you used.`
}

/** Derive the summary used inside the prompt from a post's excerpt/content. */
export function posterSummaryFrom(excerpt: string | null | undefined, content: string): string {
  return (
    (excerpt || '').slice(0, 180) ||
    content.replace(/[#*>\-|`\[\]()!]/g, ' ').slice(0, 180)
  )
}
