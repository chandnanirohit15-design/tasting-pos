/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { dev }) => {
    // Avoid corrupted dev filesystem cache causing 500s on _next/static chunks.
    if (dev) config.cache = false;
    return config;
  },
};

export default nextConfig;
