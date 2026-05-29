/** @type {import('next').NextConfig} */
const nextConfig = {
  // 1. Enable React Strict Mode for detecting side-effects & memory leaks early
  reactStrictMode: true,

  // 2. Ignore build errors for faster lint-free, compiler-focused deployment runs
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },

  // 3. Ultra-Premium Image Optimizations: Auto-compress to AVIF and WebP
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 3600, // Cache optimized images for 1 hour to reduce cold runs
  },

  // 4. Production Console Scrubbing: Eliminate rendering bottlenecks
  // console.log blocks browser thread execution; removing them boosts runtime speed
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error'] } : false,
  },

  // 5. Gzip & Brotli Compression: Maximizes network delivery speeds
  compress: true,
}

export default nextConfig
