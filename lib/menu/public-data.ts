/**
 * The public menu's data: catalog rows → serializable sections the client
 * component renders. Pure, so the dashboard preview builds the same shape.
 */
import { extractTypedVariations, type VariationRow } from '@/lib/products/description'
import { badgesFromTags, type MenuBadge, type MenuSettings } from '@/lib/menu/settings'

// Local copies of the catalog helpers: presentation.ts reaches the database,
// and this module also runs in the dashboard's client-side preview.
const variationLabel = (variation: VariationRow) => Object.values(variation.attributes).map((value) => value.trim()).filter(Boolean).join('، ')
const isVariationAvailable = (variation: VariationRow) =>
  variation.manageStock ? (variation.stockQuantity ?? 0) > 0 : variation.inStock !== false

export interface PublicMenuVariant {
  id: number
  label: string
  price: number | null
  soldOut: boolean
}

export interface PublicMenuItem {
  id: string
  name: string
  description: string | null
  price: number | null
  comparePrice: number | null
  soldOut: boolean
  image: string | null
  badges: MenuBadge[]
  variants: PublicMenuVariant[]
}

export interface PublicMenuSection {
  key: string
  name: string
  items: PublicMenuItem[]
}

export interface PublicMenuData {
  name: string
  slug: string
  settings: MenuSettings
  sections: PublicMenuSection[]
  /** Customer chat (the agent), when a chat link is live. */
  chatUrl: string | null
  /** From the table QR («?t=7»). */
  table: string | null
}

export interface MenuSourceProduct {
  id: string
  name: string
  description: string | null
  price: number | null
  comparePrice: number | null
  stock: number | null
  images: string[]
  categoryId: string | null
  tags?: string[]
  attributes?: unknown
}

export function toMenuItem(product: MenuSourceProduct): PublicMenuItem {
  const variations = extractTypedVariations(product.attributes)
  const variants = variations.map((variation) => ({
    id: variation.id,
    label: variationLabel(variation),
    price: variation.price ?? null,
    soldOut: !isVariationAvailable(variation),
  })).filter((variant) => variant.label)
  const pricedVariants = variants.filter((variant) => variant.price != null && !variant.soldOut)
  // A sized dish («کوچک / بزرگ») shows its lowest open price as «از …».
  const price = pricedVariants.length ? Math.min(...pricedVariants.map((variant) => variant.price!)) : product.price
  return {
    id: product.id,
    name: product.name,
    description: product.description?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || null,
    price,
    comparePrice: product.comparePrice != null && price != null && product.comparePrice > price ? product.comparePrice : null,
    soldOut: product.stock === 0 || (variants.length > 0 && variants.every((variant) => variant.soldOut)),
    image: product.images[0] ?? null,
    badges: badgesFromTags(product.tags ?? []),
    variants: variants.slice(0, 12),
  }
}

/** Sections in the owner's category order; uncategorized items go last. */
export function buildMenuSections(
  categories: Array<{ id: string; name: string }>,
  products: MenuSourceProduct[],
): PublicMenuSection[] {
  const known = new Set(categories.map((category) => category.id))
  return [
    ...categories.map((category) => ({
      key: category.id,
      name: category.name,
      items: products.filter((product) => product.categoryId === category.id).map(toMenuItem),
    })),
    {
      key: 'other',
      name: categories.length ? 'سایر' : 'منو',
      items: products.filter((product) => !product.categoryId || !known.has(product.categoryId)).map(toMenuItem),
    },
  ].filter((section) => section.items.length > 0)
}

/** schema.org Restaurant → Menu → MenuSection → MenuItem (prices in IRR). */
export function menuJsonLd(data: PublicMenuData, pageUrl: string) {
  const settings = data.settings
  return {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: data.name,
    url: pageUrl,
    ...(settings.logo ? { logo: settings.logo } : {}),
    ...(settings.coverImage ? { image: settings.coverImage } : {}),
    ...(settings.phone ? { telephone: settings.phone } : {}),
    ...(settings.address ? { address: settings.address } : {}),
    ...(settings.openAt && settings.closeAt ? { openingHours: `Mo-Su ${settings.openAt}-${settings.closeAt}` } : {}),
    hasMenu: {
      '@type': 'Menu',
      name: `منوی ${data.name}`,
      hasMenuSection: data.sections.map((section) => ({
        '@type': 'MenuSection',
        name: section.name,
        hasMenuItem: section.items.map((item) => ({
          '@type': 'MenuItem',
          name: item.name,
          ...(item.description ? { description: item.description } : {}),
          ...(item.image ? { image: item.image } : {}),
          ...(item.price != null ? {
            offers: {
              '@type': 'Offer',
              priceCurrency: 'IRR',
              price: Math.round(item.price * 10),
              availability: item.soldOut ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
            },
          } : {}),
        })),
      })),
    },
  }
}
