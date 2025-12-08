import nextra from 'nextra';

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  // Enable static export for production builds
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true // mandatory for static export
  },
  basePath: '/docs',
  assetPrefix: '/docs/'
};

const withNextra = nextra({
  // Nextra 4.x configuration
  defaultShowCopyCode: false, // Disable copy button for code blocks
  search: true // Enable search functionality
});

export default withNextra(nextConfig);
