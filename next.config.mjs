import { withSentryConfig } from '@sentry/nextjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Security headers. Deliberately no X-Frame-Options / frame-ancestors here:
  // the tool must remain embeddable in the Moodle iframe. HSTS omits
  // includeSubDomains/preload to avoid affecting sibling subdomains; add them
  // only if this host is dedicated to the tool.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Trim referrer leakage to third parties without breaking same-origin
          // navigation inside the Moodle iframe.
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // The tool needs none of these device APIs; deny them explicitly.
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
        ],
      },
    ]
  },
}

// Sentry wraps the build to upload source maps, so stack traces are readable
// rather than minified. Source maps are uploaded to Sentry and hidden from the
// public build output, so they are not served to browsers.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Quieter CI logs; the upload still fails loudly if it fails.
  silent: !process.env.CI,

  // Do not serve source maps to the browser.
  hideSourceMaps: true,

  // Without an auth token (local dev, forks) the build must still succeed.
  dryRun: !process.env.SENTRY_AUTH_TOKEN,

  // Routes Sentry's own requests through the app's origin so ad blockers do
  // not silently drop error reports.
  tunnelRoute: '/monitoring',

  disableLogger: true,
})