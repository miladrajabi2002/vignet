/**
 * Only absolute HTTP(S) URLs may become clickable links in chat Markdown.
 * Kept in a JSX-free module so the security rule can be unit-tested without
 * loading the React renderer.
 */
export function safeLinkHref(value: string): string {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : ''
  } catch {
    return ''
  }
}
