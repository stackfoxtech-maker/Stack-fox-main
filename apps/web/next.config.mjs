/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@stackfox/ui"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.r2.cloudflarestorage.com" },
      { protocol: "https", hostname: "*.cloudflare.com" },
    ],
  },
};

export default nextConfig;
