/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  serverExternalPackages: ['exifr', 'exiftool-vendored', 'heic-convert']
};

export default nextConfig;
