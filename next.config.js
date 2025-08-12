/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  env: {
    NOAA_API_BASE_URL: process.env.NOAA_API_BASE_URL || 'https://coastwatch.pfeg.noaa.gov/erddap',
  },
  images: {
    domains: ['tile.openstreetmap.org'],
  },
}

module.exports = nextConfig
