/** @type {import('next').NextConfig} */
const supabaseHost = (() => {
  try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname; }
  catch { return 'vcrzauuxvgpsbforiszz.supabase.co'; }
})();

const nextConfig = {
  reactStrictMode: true,
  images: {
    // Product photos live in Supabase Storage, not in this repo — 36 MB of
    // images in git is permanent, and the bucket is already CDN-backed.
    remotePatterns: [{ protocol: 'https', hostname: supabaseHost, pathname: '/storage/v1/object/public/**' }],
  },
  async headers() {
    return [
      {
        // The service worker must never be cached, or a bad one cannot be
        // replaced — it would pin a stale shop onto every dealer's phone.
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/manifest.webmanifest',
        headers: [
          { key: 'Content-Type', value: 'application/manifest+json' },
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
        ],
      },
    ];
  },
  async redirects() {
    return [
      // /v2 was retired: it existed as a fallback for OTP trouble, and a second
      // sign-in path is more liability than insurance.
      { source: '/v2/:path*', destination: '/', permanent: false },
    ];
  },
  async rewrites() {
    return [
      // NEVER a redirect. An installed icon pinned to scope /v4/ degrades to a
      // browser tab in a frozen theme the moment this redirects — that has
      // already happened once.
      { source: '/v4', destination: '/' },
      { source: '/v4/', destination: '/' },
      { source: '/v4/:path*', destination: '/:path*' },
    ];
  },
};

module.exports = nextConfig;
