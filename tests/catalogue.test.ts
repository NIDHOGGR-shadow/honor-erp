import { test } from "node:test";
import assert from "node:assert/strict";
import { availableStockValue, priceMinor, productSearchText, productVariants, variantLabel } from "../src/online/catalogue";
import type { Catalogue, Product } from "../src/online/api";

const product = (id: string, fields = {}): Catalogue["products"][number] => ({
  id, sku: id, name: "Phone " + id, model_name: "Phone 400", colour: "Black", memory: "8 / 256 GB",
  market: "Nigeria", category: "Phones", description: "", image_url: "", price_minor: 12345,
  available: 2, ...fields,
});

test("variant choices retain actual SKUs and exclude another regional model", () => {
  const selected = product("black");
  const white = product("white", { colour: "White", available: 0 });
  const china = product("china", { market: "China" });
  assert.deepEqual(productVariants([selected, white, china], selected).map(x => x.id), ["black", "white"]);
  assert.deepEqual(productVariants([selected, white], { ...selected, model_name: "" }).map(x => x.id), ["black"]);
});

test("prices convert exact decimal input to minor units and reject ambiguous prices", () => {
  assert.equal(priceMinor("1000.01"), 100001);
  assert.equal(priceMinor("0.29"), 29);
  assert.equal(priceMinor(" 20000000 "), 2_000_000_000);
  for (const value of ["", "NaN", "-1", "1e4", "1,000", "1.001", "20000000.01"])
    assert.throws(() => priceMinor(value));
});

test("review variant labels omit internal sample codes without changing real SKU fallbacks", () => {
  const laptop = product("SAMPLE-LAPTOP", { colour: "", memory: "", market: "" });
  assert.equal(variantLabel(laptop, false), "");
  assert.equal(variantLabel(laptop), "SAMPLE-LAPTOP");
  assert.equal(variantLabel(product("SAMPLE-PHONE"), false), "Black · 8 / 256 GB · Nigeria");
});

test("available stock value excludes reservations and follows changed selling prices", () => {
  const p = { ...product("phone"), tracking: "QUANTITY", reorder_point: 5, published: true } as Product;
  const balances = [{ product_id: "phone", location_id: "main", on_hand: 10, reserved: 2, available: 8 }];
  assert.equal(availableStockValue([p], balances), 98760);
  assert.equal(availableStockValue([{ ...p, price_minor: 20000 }], balances), 160000);
});

test("catalogue search includes model, colour, memory and regional version", () => {
  const searchable = productSearchText(product("SKU"));
  for (const term of ["phone 400", "black", "256 gb", "nigeria", "sku"]) assert.ok(searchable.includes(term));
});

