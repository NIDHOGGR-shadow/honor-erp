import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import App from "../src/App";
import * as sample from "./fixtures/mockData";
const { INITIAL_STAFF } = sample;
const initialData = {
  locations: sample.INITIAL_LOCATIONS, staff: sample.INITIAL_STAFF,
  products: sample.INITIAL_PRODUCTS, variants: sample.INITIAL_VARIANTS,
  stockUnits: sample.INITIAL_STOCK_UNITS, stockLevels: sample.INITIAL_STOCK_LEVELS,
  movements: sample.INITIAL_MOVEMENTS, sales: sample.INITIAL_SALES,
  purchases: sample.INITIAL_PURCHASES, transfers: sample.INITIAL_TRANSFERS,
  customers: sample.INITIAL_CUSTOMERS, suppliers: sample.INITIAL_SUPPLIERS,
  notifications: sample.INITIAL_NOTIFICATIONS, auditLogs: sample.INITIAL_AUDIT_LOGS,
};
function render(hash: string, role = "OWNER", useSamples = true) {
  const values = new Map<string, string>();
  values.set("honor_inventory_v2_products", JSON.stringify(sample.INITIAL_PRODUCTS));
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
  return renderToStaticMarkup(React.createElement(App, useSamples ? { initialData } : {}));
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


test("public preview starts empty and ignores previously published sample records", () => {
  for (const route of ["dashboard", "inventory", "add-stock", "stock-movements", "transfers", "purchases", "pos", "sales", "customers", "suppliers", "reports", "staff", "settings"]) {
    const html = render("#/" + route, "OWNER", false);
    assert.match(html, /Browser preview/);
    assert.doesNotMatch(html, /iPhone|MacBook|Galaxy S24|Demo administrator|Demo customer|Demo supplier|NaN/);
  }
  const overview = render("#/dashboard", "OWNER", false);
  assert.match(overview, /Available stock/);
  assert.match(overview, /No products yet/);
  assert.doesNotMatch(overview, /Stock is looking healthy/);
  assert.match(overview, /Not signed in/);
});
