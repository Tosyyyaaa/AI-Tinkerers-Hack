/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // Handle MediaPipe wasm files
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
    };
    return config;
  },
};

module.exports = nextConfig;
