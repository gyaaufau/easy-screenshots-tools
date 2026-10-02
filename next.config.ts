import type { NextConfig } from 'next';

const config: NextConfig = {
  distDir: process.env.NEXT_BUILD_DIR || '.next',
  async redirects() {
    return [{ source: '/store-screenshot-generator.html', destination: '/', permanent: true }];
  },
};

export default config;
