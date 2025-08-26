/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true
  },
  env: {
    WORKER_URL: process.env.WORKER_URL || 'https://mcp-memory-server-production.kristoffer-remback.workers.dev',
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'https://mcp-memory-ui.pages.dev',
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  },
  experimental: {
    appDir: true,
  },
}

module.exports = nextConfig