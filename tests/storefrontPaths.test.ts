import test from "node:test";
import assert from "node:assert/strict";
import { categoryHref, pathCategory, storeBasePath } from "../src/online/storefrontPaths";
import { parseFavourites } from "../src/online/StoreExperience";

test("category links retain tenant scope and encode catalogue category names", () => {
  assert.equal(categoryHref("/shop/ikeja/phones", "Earwears"), "/shop/ikeja/audio?category=Earwears");
  assert.equal(categoryHref("/phones", "Tablets"), "/tablets?category=Tablets");
  assert.equal(categoryHref("/shop/ikeja", "All"), "/shop/ikeja/");
  assert.equal(categoryHref("/", "Cables & chargers"), "/?category=Cables%20%26%20chargers");
  assert.equal(storeBasePath("/workspace"), "");
  assert.equal(pathCategory("/shop/ikeja/phones"), "Phones");
  assert.equal(pathCategory("/not-a-category"), undefined);
});
test("browser favourites tolerate malformed, duplicate and excessive storage", () => {
  assert.deepEqual(parseFavourites("broken"), []);
  assert.deepEqual(parseFavourites('{"id":"one"}'), []);
  assert.deepEqual(parseFavourites('["one","one",null,4,"","two"]'), ["one", "two"]);
  assert.equal(parseFavourites(JSON.stringify(Array.from({ length: 150 }, (_, i) => String(i)))).length, 100);
});
