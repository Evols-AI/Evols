/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  output: 'standalone',
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? '',
  },
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'https', hostname: '**' },
    ],
  },
  async redirects() {
    if (process.env.NEXT_PUBLIC_IS_HOSTED === 'true') return [];
    return [{ source: '/', destination: '/login', permanent: false }];
  },
}

module.exports = nextConfig
