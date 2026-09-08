/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@sparticuz/chromium', 'playwright-core'],
    // Without this, Vercel's file tracer drops @sparticuz/chromium's binary assets from the
    // deployed function bundle, so chromium.executablePath() fails at runtime with
    // "input directory .../bin does not exist" even though the package itself is present.
    outputFileTracingIncludes: {
      '/api/**/*': ['./node_modules/@sparticuz/chromium/bin/**/*'],
    },
  },
};
export default nextConfig;
