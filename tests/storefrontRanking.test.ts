import { test } from "node:test";
import assert from "node:assert/strict";
import { catalogueSelection, readShopFilters, type ShopProduct } from "../src/online/catalogue";

const products: ShopProduct[] = [
  { id: "phone", sku: "PHONE", name: "Phone", category: "Phones", description: "", image_url: "", available: 2, price_minor: 500000 },
  { id: "cable", sku: "CABLE", name: "Cable", category: "Accessories", description: "", image_url: "", available: 3, price_minor: 1000 },
  { id: "sold", sku: "SOLD", name: "Cheap sold out", category: "Phones", description: "", image_url: "", available: 0, price_minor: 500 },
];
const recommendations = { trending_product_ids: ["phone", "sold"], popular_product_ids: ["phone"], budget_product_ids: ["phone", "cable"], window_days: 7 };

test("recommendation shelves exclude unavailable items even with stale recommendation IDs", () => {
  const result = catalogueSelection(products, readShopFilters("shelf=trending"), recommendations);
  assert.deepEqual(result.map(p => p.id), ["phone"]);
});
test("budget picks respect the category instead of substituting a cheap accessory", () => {
  assert.deepEqual(catalogueSelection(products, readShopFilters("shelf=budget&category=Phones"), recommendations).map(p => p.id), ["phone"]);
});
test("invalid filter URLs have deterministic defaults and empty sales do not invent trends", () => {
  assert.equal(readShopFilters("sort=unknown&shelf=unknown").sort, "featured");
  assert.equal(readShopFilters("sort=unknown&shelf=unknown").shelf, "featured");
  assert.deepEqual(catalogueSelection(products, readShopFilters("shelf=trending")), []);
  assert.equal(catalogueSelection(products, readShopFilters(""))[2].id, "sold");
});
