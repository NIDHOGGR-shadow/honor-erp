// Cloudflare Pages advanced mode. The inventory API stays on its PostgreSQL-capable host.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) {
      let response = await env.ASSETS.fetch(request);
      if (
        response.status === 404 &&
        ["GET", "HEAD"].includes(request.method) &&
        !url.pathname.split("/").pop().includes(".")
      ) {
        url.pathname = "/index.html";
        response = await env.ASSETS.fetch(new Request(url, request));
      }
      return response;
    }
    const unavailable = () =>
      Response.json(
        { detail: "Honor is unavailable right now. Please try again later." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    if (!env.HONOR_API_ORIGIN) return unavailable();
    let origin;
    try {
      origin = new URL(env.HONOR_API_ORIGIN);
      if (
        origin.protocol !== "https:" ||
        origin.username ||
        origin.password ||
        origin.pathname !== "/" ||
        origin.search ||
        origin.hash ||
        origin.origin === url.origin
      )
        return unavailable();
    } catch {
      return unavailable();
    }
    const target = new URL(url.pathname + url.search, origin);
    const upstream = new Request(target, request);
    for (const header of [
      "host",
      "forwarded",
      "x-forwarded-host",
      "x-forwarded-proto",
      "x-forwarded-for",
      "authorization",
    ])
      upstream.headers.delete(header);
    try {
      const response = await fetch(upstream, {
        redirect: "manual",
        signal: AbortSignal.timeout(20000),
      });
      const result = new Response(response.body, response);
      result.headers.set("Cache-Control", "no-store");
      result.headers.set("X-Content-Type-Options", "nosniff");
      return result;
    } catch {
      return unavailable();
    }
  },
};
