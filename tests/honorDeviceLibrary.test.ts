import { test } from "node:test";
import assert from "node:assert/strict";
import { honorDeviceCategories, honorDeviceReferences, honorNigeriaListedModels } from "../src/online/honorDeviceLibrary";
import { priceForProductDraft, optionalMoneyMinor } from "../src/online/catalogue";

test("HONOR model library has unique, non-empty entries with manufacturer source pages", () => {
  assert.ok(honorDeviceReferences.length >= 100);
  assert.equal(new Set(honorDeviceReferences.map(item => item.id)).size, honorDeviceReferences.length);
  assert.equal(new Set(honorDeviceReferences.map(item => item.name)).size, honorDeviceReferences.length);
  for (const item of honorDeviceReferences) {
    assert.ok(item.name.startsWith("HONOR ") || item.name.startsWith("PORSCHE DESIGN | HONOR "));
    assert.ok(honorDeviceCategories.some(category => category === item.category));
    assert.match(item.officialCatalogUrl, /^https:\/\/www\.honor\.com\//);
    if (item.imageUrl) assert.match(item.imageUrl, /^https:\/\/(?:www\.honor\.com|www-file\.honor\.com|img02\.honorfile\.com)\//);
    assert.equal(Object.hasOwn(item, "price"), false);
    assert.equal(Object.hasOwn(item, "quantity"), false);
    assert.equal(Object.hasOwn(item, "available"), false);
    assert.equal(Object.hasOwn(item, "published"), false);
  }
});

test("unpriced products are drafts only, and published products need a positive price", () => {
  assert.equal(priceForProductDraft(null, false), 0);
  assert.equal(priceForProductDraft("", false), 0);
  assert.equal(priceForProductDraft("10000", true), 1000000);
  assert.equal(optionalMoneyMinor(""), 0);
  assert.throws(() => priceForProductDraft(null, true), /selling price/i);
  assert.throws(() => priceForProductDraft("0", true), /selling price/i);
  assert.throws(() => priceForProductDraft("abc", false), /price/i);
});

test("Nigeria catalogue research priority never implies actual retailer inventory", () => {
  const names = new Set(honorDeviceReferences.map(item => item.name));
  assert.ok(honorNigeriaListedModels.size >= 7);
  for (const name of honorNigeriaListedModels) assert.ok(names.has(name), name);
  for (const item of honorDeviceReferences) {
    assert.equal(Object.hasOwn(item, "branch"), false);
    assert.equal(Object.hasOwn(item, "location"), false);
    assert.equal(Object.hasOwn(item, "nigeria_stock"), false);
  }
});

test("manufacturer image candidates are unique and all paired to a named model", () => {
  const ready = honorDeviceReferences.filter(item => item.imageUrl);
  assert.ok(ready.length >= 26);
  assert.equal(new Set(ready.map(item => item.imageUrl)).size, ready.length);
});
