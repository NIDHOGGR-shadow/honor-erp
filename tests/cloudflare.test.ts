import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../deploy/cloudflare/worker.mjs";

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
