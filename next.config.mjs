import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep production builds reliable on the small-memory hosts used for
  // deployment. This only limits build-time workers; runtime concurrency is
  // unaffected.
  experimental: {
    cpus: 1,
  },
  images: {
    remotePatterns: [
      // Supabase Storage signed URLs (product images, avatars)
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
}

export default withNextIntl(nextConfig)
