/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  reactCompiler: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lucira.uat.ornaverse.in',
      },
    ],
  },
};

export default nextConfig;
