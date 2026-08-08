/** @type {import('next').NextConfig} */
const nextConfig = {
  // Internal ops tool, not part of the public site — never indexed.
  // Section 10 "secure headers" applies here too, arguably more so —
  // this app now holds real session cookies (Phase 14's JWT auth).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
