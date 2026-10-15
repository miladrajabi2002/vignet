export interface WooSyncResult {
  /** The plugin accepted a request to push its whole catalog again. */
  resyncRequested?: boolean
  products?: {
    count?: number
    errors?: unknown[]
    skipped?: boolean
  }
  orders?: {
    count?: number
    errors?: unknown[]
    skipped?: boolean
  }
}

export interface SyncFeedback {
  type: 'ok' | 'err'
  msg: string
}

/**
 * Keep the manual-sync result consistent wherever a WooCommerce connection
 * appears. The plugin normally pushes deltas, so a skipped pull is healthy,
 * not an error that needs implementation details such as "webhook-only".
 */
export function formatWooSyncResult(
  result: WooSyncResult,
  now: Date = new Date(),
): SyncFeedback {
  const productCount = result.products?.count ?? 0
  const orderCount = result.orders?.count ?? 0
  const errorCount =
    (result.products?.errors?.length ?? 0) +
    (result.orders?.errors?.length ?? 0)
  const errorText = [
    ...(result.products?.errors ?? []),
    ...(result.orders?.errors ?? []),
  ].map(String).join('\n')
  const skipped =
    result.products?.skipped === true ||
    result.orders?.skipped === true
  const time = now.toLocaleTimeString('fa-IR', {
    hour: '2-digit',
    minute: '2-digit',
  })

  if (result.resyncRequested) {
    return {
      type: 'ok',
      msg: 'از افزونه خواسته شد همهٔ محصولات را دوباره بفرستد؛ تا چند دقیقهٔ دیگر کاتالوگ کامل می‌شود.',
    }
  }

  if (skipped) {
    return {
      type: 'ok',
      msg: 'همگام‌سازی خودکار روشن است؛ هر تغییری در سایت همان لحظه به ویجنت می‌رسد.',
    }
  }

  if (/(?:PRODUCT|ORDER|CUSTOMER)_LIMIT(?::\d+)?/.test(errorText)) {
    return {
      type: 'err',
      msg: 'افزونه وصل است، ولی ظرفیت پلن پر شده. برای ادامهٔ همگام‌سازی، پلن را بالاتر ببرید.',
    }
  }

  const updated: string[] = []
  if (productCount > 0) updated.push(String(productCount) + ' محصول')
  if (orderCount > 0) updated.push(String(orderCount) + ' سفارش')

  if (errorCount > 0) {
    const prefix = updated.length > 0
      ? updated.join(' و ') + ' به‌روز شد؛ '
      : ''
    return {
      type: 'err',
      msg: prefix + String(errorCount) + ' مورد خطا داشت · ساعت ' + time,
    }
  }

  if (updated.length === 0) {
    return {
      type: 'ok',
      msg: 'همه‌چیز به‌روز است · ساعت ' + time,
    }
  }

  return {
    type: 'ok',
    msg: updated.join(' و ') + ' به‌روز شد · ساعت ' + time,
  }
}
