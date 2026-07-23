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

export default nextConfig