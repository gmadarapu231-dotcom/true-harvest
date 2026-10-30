/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@electric-sql/pglite', 'pg'],
  experimental: { serverActions: { bodySizeLimit: '4mb' } },
};
export default nextConfig;
