const apiOrigin = process.env.HONOR_API_ORIGIN?.replace(/\/$/, "");
export default {
  experimental: { cpus: 1 },
  async rewrites() {
    return apiOrigin
      ? [{ source: "/api/:path*", destination: `${apiOrigin}/api/:path*` }]
      : [];
  },
};
