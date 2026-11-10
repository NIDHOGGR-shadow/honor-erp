import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HonorOperationsReports } from "../src/online/HonorOperationsReports";
import { HonorOnlineStoreSettings } from "../src/online/HonorOnlineStoreSettings";

test("zero real records give zero values without fabricated report metrics", () => {
  const html = renderToStaticMarkup(React.createElement(HonorOperationsReports, {
    products: [], balances: [], orders: [], locations: [], location: "ALL",
    currency: "NGN", onProducts: () => {}, onOrders: () => {}
  }));
  assert.match(html, /No customer orders in these records yet/);
  assert.match(html, /No products are below their reorder levels/);
  assert.match(html, /not an accounting statement/);
  assert.doesNotMatch(html, /Example #|test product|₦3,452,265/);
});

test("paid orders use only payment-confirmed records and preserve actual amounts", () => {
  const html = renderToStaticMarkup(React.createElement(HonorOperationsReports, {
    products: [], balances: [], locations: [], location: "ALL",
    currency: "NGN", onProducts: () => {}, onOrders: () => {},
    orders: [
      { id: "paid-1", customer_name: "Test buyer", total_minor: 120050, currency: "NGN", status: "PAID",
        payment_status: "PAID", created_at: "2026-11-10T10:00:00Z", expires_at: "", lines: [] },
      { id: "pending-1", customer_name: "Test buyer", total_minor: 900000, currency: "NGN", status: "RESERVED",
        payment_status: "UNPAID", created_at: "2026-11-10T11:00:00Z", expires_at: "", lines: [] },
    ]
  }));
  assert.match(html, /₦1,200\.5/);
  assert.match(html, /paid-1/);
  assert.match(html, /pending-1/);
  assert.match(html, /not verified bank settlement/);
});

test("store editor reflects only saved company data, not demonstration campaigns", () => {
  const html = renderToStaticMarkup(React.createElement(HonorOnlineStoreSettings, {
    company: { id: "test", slug: "honor", name: "HONOR", role: "ADMIN", currency: "NGN", timezone: "Africa/Lagos",
      storefront_content: { heading: "Actual owner heading", introduction: "Actual owner introduction" }},
    products: [], busy: false, onProducts: () => {}, onSubmit: () => {}
  }));
  assert.match(html, /Actual owner heading/);
  assert.match(html, /Actual owner introduction/);
  assert.match(html, /not yet connected to the live backend/);
  assert.doesNotMatch(html, /Add test inventory|Sample campaign/);
});
