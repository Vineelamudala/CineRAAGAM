/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Self-contained server bundle for the Docker image (Phase 7).
  output: 'standalone',
  async headers() {
    // A full Content-Security-Policy is added once the Supabase origin is known (Phase 1).
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
