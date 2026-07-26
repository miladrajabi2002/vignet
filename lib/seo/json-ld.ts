/**
 * Safely serialize a JSON-LD object for injection into a
 * <script type="application/ld+json"> via dangerouslySetInnerHTML.
 *
 * JSON.stringify does NOT escape `<`, `>`, or the U+2028/U+2029 line
 * separators, so any database/tenant-controlled string (a product name, a post
 * title) containing `</script>` would close the element and enable stored XSS.
 * Escaping the angle brackets and those two code points neutralizes that
 * without changing the parsed JSON value.
 *
 * Usage:
 *   <script type="application/ld+json"
 *     dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
 */

// Built via RegExp so the source file contains no literal separator chars
// (they are invisible and easy for tooling to mangle).
const LINE_SEPARATORS = new RegExp('[\\u2028\\u2029]', 'g')

export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    // Emit the six-character escape sequence, not the character itself.
    .replace(LINE_SEPARATORS, (c) => '\\u' + c.charCodeAt(0).toString(16))
}
