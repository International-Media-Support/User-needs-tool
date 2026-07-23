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
        ],
      },
    ]
  },
}

export default nextConfig