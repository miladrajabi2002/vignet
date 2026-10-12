import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { NextIntlClientProvider } from 'next-intl'
import { describe, expect, it } from 'vitest'
import {
  WOO_PLUGIN_DOWNLOAD_HREF,
  WooPluginSetup,
  normalizeStoreUrlInput,
  wooCreateErrorMessage,
} from '@/components/integrations/woo-plugin-setup'

describe('WooCommerce site address input', () => {
  it('adds https:// when the owner types a bare domain', () => {
    expect(normalizeStoreUrlInput('  example.com ')).toBe('https://example.com')
    expect(normalizeStoreUrlInput('//example.com/shop')).toBe('https://example.com/shop')
  })

  it('keeps an explicit scheme and leaves an empty value empty', () => {
    expect(normalizeStoreUrlInput('http://example.com')).toBe('http://example.com')
    expect(normalizeStoreUrlInput('HTTPS://Example.com')).toBe('HTTPS://Example.com')
    expect(normalizeStoreUrlInput('   ')).toBe('')
  })
})

describe('WooCommerce connection create errors', () => {
  it('names the plan block instead of a generic failure', () => {
    expect(wooCreateErrorMessage('PLAN_BLOCKED', true)).toBe('پلن شما اجازه اتصال سایت را نمی‌دهد.')
    expect(wooCreateErrorMessage('UNSAFE_STORE_URL', false)).toBe('This site address cannot be accepted for security reasons.')
  })

  it('falls back to a retryable message for unknown codes', () => {
    expect(wooCreateErrorMessage(undefined, false)).toBe('The connection could not be created. Try again.')
  })
})

describe('WooCommerce plugin install guide', () => {
  const render = (storeUrl: string, locale: 'fa' | 'en' = 'fa') =>
    renderToStaticMarkup(
      createElement(NextIntlClientProvider, {
        locale,
        messages: {},
        children: createElement(WooPluginSetup, { storeUrl }),
      }),
    )

  it('always carries the plugin download button', () => {
    const html = render('https://shop.example.com')
    expect(html).toContain(`href="${WOO_PLUGIN_DOWNLOAD_HREF}"`)
    expect(html).toContain('دانلود افزونه')
  })

  it('deep-links into the wp-admin of the connected site', () => {
    const html = render('https://shop.example.com/blog/', 'en')
    expect(html).toContain('href="https://shop.example.com/blog/wp-admin/plugin-install.php?tab=upload"')
    expect(html).toContain('href="https://shop.example.com/blog/wp-admin/admin.php?page=vigent-woo"')
  })

  it('never turns a non-http address into a link', () => {
    const html = render('javascript:alert(1)')
    expect(html).not.toContain('javascript:')
    expect(html).toContain(`href="${WOO_PLUGIN_DOWNLOAD_HREF}"`)
  })
})
