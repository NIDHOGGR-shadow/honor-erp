import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../deploy/cloudflare/worker.mjs";

test("Cloudflare serves workspace routes with security headers without treating API errors as HTML", async () => {
  const paths: string[] = [];
  const env = {
    ASSETS: {
      async fetch(request: Request) {
        const path = new URL(request.url).pathname;
        paths.push(path);
        return path === "/index.html"
          ? new Response("<html>Honor</html>", { headers: { "Content-Type": "text/html" } })
          : new Response("Not found", { status: 404 });
      },
    },
  };
  const page = await worker.fetch(new Request("https://honor.test/workspace"), env);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Honor/);
  assert.deepEqual(paths, ["/workspace", "/index.html"]);
  assert.equal(page.headers.get("X-Frame-Options"), "DENY");
  assert.equal(page.headers.get("Referrer-Policy"), "no-referrer");

  paths.length = 0;
  const missing = await worker.fetch(new Request("https://honor.test/missing.js"), env);
  assert.equal(missing.status, 404);
  assert.deepEqual(paths, ["/missing.js"]);

  paths.length = 0;
  const api = await worker.fetch(new Request("https://honor.test/api/v1/me"), env);
  assert.equal(api.status, 503);
  assert.deepEqual(paths, []);
  assert.equal(api.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(api.headers.get("Cache-Control"), "no-store");
});

test("Cloudflare never forwards credentials to an unconfigured or insecure origin", async () => {
  for (const origin of [
    undefined,
    "http://api.example.test",
    "https://api.example.test/private",
    "https://user:password@api.example.test",
    "https://staff.example.test",
  ]) {
    const response = await worker.fetch(
      new Request("https://staff.example.test/api/v1/me"),
      { HONOR_API_ORIGIN: origin },
    );
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  }
});

test("Cloudflare proxies API cookies without caching or following credential-bearing redirects", async () => {
  const original = globalThis.fetch;
  let seen: Request | undefined;
  let redirect: string | undefined;
  globalThis.fetch = async (request, options) => {
    seen = request as Request;
    redirect = options?.redirect;
    return new Response('{"id":"customer"}', {
      headers: {
        "Set-Cookie": "honor_session=test; HttpOnly; Secure; Path=/",
        "Content-Type": "application/json",
      },
    });
  };
  try {
    const response = await worker.fetch(
      new Request("https://staff.example.test/api/v1/customer/me", {
        headers: {
          Cookie: "honor_session=test",
          Authorization: "discard",
          Origin: "https://staff.example.test",
        },
      }),
      { HONOR_API_ORIGIN: "https://api.example.test" },
    );
    assert.equal(seen?.url, "https://api.example.test/api/v1/customer/me");
    assert.equal(seen?.headers.get("Cookie"), "honor_session=test");
    assert.equal(seen?.headers.get("Authorization"), null);
    assert.equal(seen?.headers.get("Origin"), "https://staff.example.test");
    assert.equal(redirect, "manual");
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.match(response.headers.get("Set-Cookie") || "", /HttpOnly/);
  } finally {
    globalThis.fetch = original;
  }
});
