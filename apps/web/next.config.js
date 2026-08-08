/** @type {import('next').NextConfig} */
const nextConfig = {
  // Section 10: "secure headers" — the Next.js equivalent of Helmet
  // (an Express middleware; this repo has no Express app per the
  // apps/api decision documented in CLAUDE.md's Phase 10 entry, so
  // these headers ARE the substitution, not a partial version of it).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Prevents this site from being embedded in an <iframe> on
          // another origin — mitigates clickjacking.
          { key: "X-Frame-Options", value: "DENY" },
          // Stops browsers from MIME-sniffing a response away from its
          // declared Content-Type — mitigates a class of XSS where a
          // file is served as one type but interpreted as another.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Limits how much of this site's URL leaks to external links
          // a visitor clicks — full URL to same-origin, only the origin
          // to cross-origin.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Legacy XSS filter header — largely superseded by CSP in
          // modern browsers, but harmless to set for older ones.
          { key: "X-XSS-Protection", value: "1; mode=block" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
