import { test } from "node:test";
import assert from "node:assert/strict";
import { storefrontProps } from "../apps/storefront/lib/catalogue";

function configure(t: { after: (fn: () => void) => void }, origin?: string) {
  const previous = process.env.HONOR_API_ORIGIN;
  if (origin) process.env.HONOR_API_ORIGIN = origin;
  else delete process.env.HONOR_API_ORIGIN;
  t.after(() => {
    if (previous === undefined) delete process.env.HONOR_API_ORIGIN;
    else process.env.HONOR_API_ORIGIN = previous;
  });
}

test("missing merchant setup leaves API-backed accounts available", async t => {
  configure(t, "https://api.example.test");
  t.mock.method(globalThis, "fetch", async () => { throw new Error("No catalogue request is expected"); });
  const props = await storefrontProps("");
  assert.equal(props.configured, false);
  assert.equal(props.accountConfigured, true);
});

test("company shop routes load their own slug and do not cache live inventory", async t => {
  configure(t, "https://api.example.test/");
  let called = "";
  t.mock.method(globalThis, "fetch", async (url: string, options: RequestInit) => {
    called = url;
    assert.equal(options.cache, "no-store");
    assert.ok(options.signal);
    return Response.json({ products: [] });
  });
  const props = await storefrontProps("company-store");
  assert.equal(called, "https://api.example.test/api/v1/storefront/company-store");
  assert.equal(props.configured, true);
  assert.deepEqual(props.initial, { products: [] });
});

test("a backend fetch failure does not prevent storefront navigation from rendering", async t => {
  configure(t, "https://api.example.test");
  t.mock.method(globalThis, "fetch", async () => { throw new Error("offline"); });
  const props = await storefrontProps("company-store");
  assert.equal(props.initial, undefined);
  assert.equal(props.configured, true);
});
