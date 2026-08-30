/** @type {import('next').NextConfig} */
const apiOrigin = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  transpilePackages: ["@powp/shared"],
  async rewrites() {
    // Hono's local demo server has no browser CORS middleware. Proxy through
    // Next so the client, including EventSource, stays same-origin.
    return [{ source: "/backend/:path*", destination: `${apiOrigin}/:path*` }];
  },
};

export default nextConfig;
