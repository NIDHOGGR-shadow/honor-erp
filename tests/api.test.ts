import { test } from "node:test";
import assert from "node:assert/strict";
import { ApiError, client } from "../src/online/api";

test("a successful HTML response cannot complete sign-in or a stock command", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response("<html>Sign in to hosting</html>", {
    headers: { "Content-Type": "text/html" },
  });
  try {
    await assert.rejects(client().send("/auth/login", {}), (e: unknown) =>
      e instanceof ApiError && e.status === 502);
  } finally { globalThis.fetch = original; }
});

test("malformed success JSON is a failed request, not an empty result", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response('{"id":', {
    headers: { "Content-Type": "application/json" },
  });
  try {
    await assert.rejects(client().request("/me"), (e: unknown) =>
      e instanceof ApiError && e.status === 502);
  } finally { globalThis.fetch = original; }
});

test("API errors preserve their status without exposing an HTML response", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response("<html>internal proxy details</html>", {
    status: 503, headers: { "Content-Type": "text/html" },
  });
  try {
    await assert.rejects(client().request("/me"), (e: unknown) =>
      e instanceof ApiError && e.status === 503 && !e.message.includes("internal proxy"));
  } finally { globalThis.fetch = original; }
});

test("JSON requests retain session cookies, company scope and provider error details", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "/api/v1/me");
    assert.equal(options?.credentials, "include");
    assert.equal(new Headers(options?.headers).get("X-Company-Id"), "company-a");
    return Response.json({ detail: "Email or password is incorrect" }, { status: 401 });
  };
  try {
    await assert.rejects(client("/api/v1/", "company-a").request("/me"), (e: unknown) =>
      e instanceof ApiError && e.status === 401 && e.message === "Email or password is incorrect");
  } finally { globalThis.fetch = original; }
});
