import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import App from "../src/App";
import { INITIAL_STAFF } from "../src/data/mockData";
function render(hash: string, role = "OWNER") {
  const values = new Map<string, string>();
  if (role !== "OWNER")
    values.set(
      "honor_inventory_v2_staff",
      JSON.stringify(INITIAL_STAFF.filter((s) => s.role === role)),
    );
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) || null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { location: { hash } },
  });
  return renderToStaticMarkup(React.createElement(App));
}
test("inventory overview renders the stock work queue and operations", () => {
  const html = render("#/dashboard");
  assert.match(html, /Inventory overview/);
  assert.match(html, /Stock health/);
  assert.match(html, /Available stock/);
  assert.doesNotMatch(html, /NaN/);
});
test("company administrator can open the access editor", () => {
  const html = render("#/staff");
  assert.match(html, /Staff directory/);
  assert.match(html, /Company administrator/);
  assert.match(html, /No invitation email is sent here/);
});
test("direct URL access to company administration is blocked for sales staff", () => {
  const html = render("#/staff", "SALES");
  assert.match(html, /This area is restricted/);
  assert.doesNotMatch(html, /Staff directory/);
});
test("POS and settings modules render using the same typed demo records", () => {
  assert.match(render("#/pos"), /Point of Sale/);
  assert.match(render("#/settings"), /Company Registered Name/);
});
