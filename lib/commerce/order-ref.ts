/**
 * What the customer and the owner quote for a chat order: its per-workspace
 * number («1001»), or the six-letter code of an order placed before numbers
 * existed. The code itself stays the key the store plugin matches by.
 */
export function orderRef(draft: { number?: number | null; code: string }): string {
  return draft.number != null ? String(draft.number) : draft.code
}

/**
 * An order or payment reference as it fits a row: a long id a connected site
 * sent («cmvlfwfe20009eolos64nv8oz») is cut to its last six characters, which
 * a search by «contains» still finds. Short codes and numbers stay whole.
 */
export function displayOrderCode(code: string): string {
  return code.length > 12 ? code.slice(-6).toUpperCase() : code
}
