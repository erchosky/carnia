/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@carnia/contracts"],
  typedRoutes: false,
};

export default nextConfig;
