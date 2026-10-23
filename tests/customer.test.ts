import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Storefront from "../src/online/Storefront";
import {
  customerApi,
  readCart,
  readRoute,
  orderLabel,
} from "../src/online/customer";
import { money } from "../src/online/api";

test("customer deep links render the requested screen and do not seed products", () => {
  for (const [view, text] of [
    ["cart", "Your cart is empty"],
    ["login", "Welcome back"],
    ["signup", "Create your account"],
    ["account", "Your orders"],
  ]) {
    const html = renderToStaticMarkup(
      React.createElement(Storefront, {
        slug: "test-shop",
        configured: false,
        initialSearch: `view=${view}`,
      }),
    );
    assert.ok(html.includes(text));
    assert.doesNotMatch(
      html,
      /Precision Machined|London|Honor Systems Ltd|£|€123/,
    );
  }
  assert.deepEqual(readRoute("?order=private-reference"), {
    view: "account",
    product: "",
  });
  assert.deepEqual(readRoute("?view=product&product=sku-id"), {
    view: "product",
    product: "sku-id",
  });
  assert.equal(orderLabel("PAID"), "Payment confirmed");
});

test("cart restores only bounded integer quantities and formats the actual currency", () => {
  assert.deepEqual(
    readCart('{"good":2,"negative":-1,"fraction":1.5,"string":"2","huge":101}'),
    { good: 2 },
  );
  assert.deepEqual(readCart("[]"), {});
  assert.deepEqual(readCart("invalid"), {});
  assert.match(money(12345, "NGN"), /₦|NGN/);
  assert.doesNotMatch(money(12345, "NGN"), /€/);
});

test("checkout uses Honor fields and reuses the idempotency key after a lost response", async () => {
  const originalFetch = globalThis.fetch;
  const originalStorage = Object.getOwnPropertyDescriptor(
    globalThis,
    "sessionStorage",
  );
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => values.get(k) || null,
      setItem: (k: string, v: string) => values.set(k, v),
      removeItem: (k: string) => values.delete(k),
    },
  });
  const calls: { body: any; headers: any; credentials: string }[] = [];
  globalThis.fetch = async (_url, options) => {
    calls.push({
      body: JSON.parse(String(options?.body)),
      headers: options?.headers,
      credentials: options?.credentials || "",
    });
    if (calls.length === 1) throw new Error("Response lost");
    return Response.json({ id: "order", status: "RESERVED" }, { status: 201 });
  };
  try {
    const api = customerApi("/api/v1", "shop");
    const reserve = () =>
      api.reserve("A customer", "customer@example.test", "a".repeat(64), [
        { product_id: "sku", quantity: 2 },
      ]);
    await assert.rejects(reserve, /unavailable/);
    await reserve();
    assert.equal(
      calls[0].headers["Idempotency-Key"],
      calls[1].headers["Idempotency-Key"],
    );
    assert.equal(calls[0].credentials, "include");
    assert.deepEqual(Object.keys(calls[0].body).sort(), [
      "client_token",
      "customer_name",
      "email",
      "lines",
    ]);
    assert.deepEqual(calls[0].body.lines, [{ product_id: "sku", quantity: 2 }]);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalStorage)
      Object.defineProperty(globalThis, "sessionStorage", originalStorage);
    else delete (globalThis as any).sessionStorage;
  }
});
