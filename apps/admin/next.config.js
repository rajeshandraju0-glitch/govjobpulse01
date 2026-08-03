/** @type {import('next').NextConfig} */
const nextConfig = {
  // Internal ops tool, not part of the public site — never indexed.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

module.exports = nextConfig;
