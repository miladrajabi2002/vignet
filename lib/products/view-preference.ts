/** Remembers the products list layout (table or cards) between visits. */
export const PRODUCTS_VIEW_COOKIE = 'vigent-products-view'

export type ProductsView = 'table' | 'cards'

/** Client side: store the choice for a year so the next visit opens the same view. */
export function rememberProductsView(view: ProductsView) {
  document.cookie = `${PRODUCTS_VIEW_COOKIE}=${view}; path=/; max-age=31536000; samesite=lax`
}
