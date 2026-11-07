import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AddedToCart, StoreHero } from "../src/online/StorefrontDesign";
import { readSearchHistory, rememberSearch, SEARCH_HISTORY_TTL, suggestedProducts } from "../src/online/storefrontBrowsing";
import type { ShopProduct } from "../src/online/catalogue";

const now = 100000000;
const product = (id: string, extra = {}): ShopProduct => ({ id, sku: id, name: "HONOR phone", model_name: "HONOR phone", category: "Phones", memory: "256 GB", colour: "Black", market: "Nigeria", description: "", image_url: "", available: 2, price_minor: 69000000, ...extra });

test("recent searches retain three terms, deduplicate case and expire saved entries", () => {
  let history = rememberSearch([], "  Magic   V5  ", now);
  for (const term of ["Pad", "400 Pro", "magic v5"]) history = rememberSearch(history, term, now + 1);
  assert.deepEqual(history.map(item => item.query), ["magic v5", "400 Pro", "Pad"]);
  const saved = JSON.stringify({ version: 1, items: history });
  assert.deepEqual(readSearchHistory(saved, now + 2), history);
  assert.deepEqual(readSearchHistory(saved, now + SEARCH_HISTORY_TTL + 2), []);
  assert.deepEqual(rememberSearch(history, "   ", now + 1), history);
});

test("malformed history and storage injected types cannot break product search", () => {
  for (const raw of [null, "not json", "[]", '{"version":2,"items":[]}', JSON.stringify({ version: 1, items: [null, {}, { query: 5, expiresAt: now + 1 }, { query: "old", expiresAt: now - 1 }, { query: "future", expiresAt: now + SEARCH_HISTORY_TTL + 1 }] })]) assert.deepEqual(readSearchHistory(raw, now), []);
  assert.equal(rememberSearch([], "x".repeat(200), now)[0].query.length, 80);
});

test("suggestions resolve actual matching variants and bound the result list", () => {
  const products = Array.from({ length: 8 }, (_, i) => product(String(i)));
  products.push(product("tablet", { name: "HONOR Pad", memory: "128 GB", category: "Tablets" }));
  assert.equal(suggestedProducts(products, "256 gb").length, 5);
  assert.deepEqual(suggestedProducts(products, "HONOR Pad").map(p => p.id), ["tablet"]);
  assert.deepEqual(suggestedProducts(products, "missing"), []);
  assert.deepEqual(suggestedProducts(products, "  "), []);
});

test("cart confirmation shows the exact variant, quantity and local price without a reservation claim", () => {
  const html = renderToStaticMarkup(React.createElement(AddedToCart, { product: product("sku"), currency: "NGN", quantity: 2, onClose() {}, onViewCart() {} }));
  assert.match(html, /Added to your cart/);
  assert.match(html, /Black · 256 GB · Nigeria/);
  assert.match(html, /2 × ₦690,000/);
  assert.match(html, /does not hold stock/);
  assert.doesNotMatch(html, /honor\.com\/uk|SAMPLE-/);
});

test("hero excludes unavailable stock and exposes manual controls before automatic movement", () => {
  const html = renderToStaticMarkup(React.createElement(StoreHero, { products: [product("available"), product("other", { model_name: "Other", name: "Other" }), product("sold", { name: "Sold", available: 0 })], currency: "NGN", href: () => "?", onNavigate() {} }));
  assert.match(html, /Play slideshow/);
  assert.match(html, /Show Other/);
  assert.doesNotMatch(html, /Show Sold/);
  assert.doesNotMatch(html, /honor-magic-v5-id-gold/);
});
