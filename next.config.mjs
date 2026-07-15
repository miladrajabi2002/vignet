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
  // In Next.js 15+ `serverExternalPackages` is a top-level key (it was
  // previously under `experimental`). @ricky0123/vad-web pulls in
  // onnxruntime-web, which uses dynamic require() internally (ort.wasm.min.js)
  // that webpack cannot statically analyse. Marking both packages as server
  // externals stops webpack from trying to bundle them on the server.
  // On the client, vad-web is already loaded via next/dynamic + { ssr: false }
  // so it only lands in the browser bundle at runtime — exactly where the
  // WASM runtime belongs.
  serverExternalPackages: ['onnxruntime-web', '@ricky0123/vad-web'],
  images: {
    remotePatterns: [
      // Supabase Storage signed URLs (product images, avatars)
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
  webpack: (config, { isServer }) => {
    // onnxruntime-web (used by @ricky0123/vad-web for voice activity detection)
    // contains intentional dynamic require() calls in its WASM bootstrap
    // (ort.min.js, ort.wasm.min.js). These are by design — the WASM binary is
    // resolved at runtime in the browser via fetch(), not via require() — but
    // webpack 5 emits a "Critical dependency: require function is used in a
    // way in which dependencies cannot be statically extracted" warning that
    // cannot be resolved at build time. The warning is harmless (vad-web is
    // only loaded client-side via next/dynamic with { ssr: false }), so we
    // suppress it explicitly by matching the module path.
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      { module: /node_modules\/onnxruntime-web/ },
      { module: /node_modules\/@ricky0123\/vad-web/ },
    ]

    if (isServer) {
      // Belt-and-suspenders: mark both packages as external on the server
      // build so they are never bundled server-side.
      if (!config.externals) config.externals = []
      config.externals.push('onnxruntime-web', '@ricky0123/vad-web')
    }
    return config
  },
}

export default withNextIntl(nextConfig)
