/**
 * What the customer and the owner quote for a chat order: its per-workspace
 * number («1001»), or the six-letter code of an order placed before numbers
 * existed. The code itself stays the key the store plugin matches by.
 */
export function orderRef(draft: { number?: number | null; code: string }): string {
  return draft.number != null ? String(draft.number) : draft.code
}
