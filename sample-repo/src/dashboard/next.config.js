/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  env: {
    ORBITAL_API_URL: process.env.ORBITAL_API_URL,
  },
};

module.exports = nextConfig;
