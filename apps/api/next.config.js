/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["@vesna/shared"],
};

module.exports = nextConfig;
