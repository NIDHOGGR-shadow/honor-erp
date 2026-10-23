const apiOrigin = process.env.HONOR_API_ORIGIN?.replace(/\/$/, "");
if (apiOrigin) {
  const url = new URL(apiOrigin);
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash ||
      (process.env.NODE_ENV === "production" && url.protocol !== "https:") ||
      !["http:", "https:"].includes(url.protocol)) {
    throw new Error("HONOR_API_ORIGIN must be an HTTPS origin without credentials, paths or query parameters in production.");
  }
}
export default {
  experimental: { cpus: 1 },
  async rewrites() {
    return apiOrigin
      ? [{ source: "/api/:path*", destination: `${apiOrigin}/api/:path*` }]
      : [];
  },
};
