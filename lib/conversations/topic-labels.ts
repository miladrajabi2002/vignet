/** Display names for the conversation topics in lib/ai/turn-signal.ts. */
export const TOPIC_LABELS: Record<string, readonly [string, string]> = {
  product: ['محصول', 'Product'],
  price: ['قیمت', 'Price'],
  stock: ['موجودی', 'Stock'],
  shipping: ['ارسال', 'Shipping'],
  payment: ['پرداخت', 'Payment'],
  order: ['سفارش', 'Order'],
  return: ['مرجوعی و ضمانت', 'Returns & warranty'],
  booking: ['رزرو', 'Booking'],
  info: ['اطلاعات کلی', 'General info'],
  complaint: ['شکایت', 'Complaint'],
}

export function topicLabel(code: string, locale: 'fa' | 'en'): string {
  const value = TOPIC_LABELS[code]
  return value ? value[locale === 'fa' ? 0 : 1] : code
}
