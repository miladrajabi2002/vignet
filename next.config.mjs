import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      // Supabase Storage signed URLs (product images, avatars)
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
}

export default withNextIntl(nextConfig)
