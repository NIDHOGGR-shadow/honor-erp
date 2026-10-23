import { test } from "node:test";
import assert from "node:assert/strict";
import { changeStock, validateDevices } from "../src/utils/stockRules";
import type { StockLevel, StockUnit } from "../src/types";
const levels: StockLevel[] = [
  {
    id: "a",
    variantId: "phone",
    locationId: "shop",
    onHand: 3,
    reserved: 0,
    reorderLevel: 1,
  },
  {
    id: "b",
    variantId: "phone",
    locationId: "warehouse",
    onHand: 7,
    reserved: 0,
    reorderLevel: 2,
  },
];
test("two IMEIs of the same variant reduce stock by two, and reversal restores both", () => {
  const lines = [
    { variantId: "phone", quantity: 1 },
    { variantId: "phone", quantity: 1 },
  ];
  const sold = changeStock(levels, "shop", lines, -1);
  assert.equal(sold[0].onHand, 1);
  assert.equal(sold[1].onHand, 7);
  assert.equal(levels[0].onHand, 3);
  assert.deepEqual(changeStock(sold, "shop", lines, 1), levels);
});
test("overselling and moving reserved units fail without modifying the original stock", () => {
  assert.throws(
    () =>
      changeStock(levels, "shop", [{ variantId: "phone", quantity: 4 }], -1),
    /Insufficient/,
  );
  assert.throws(
    () =>
      changeStock(
        [{ ...levels[0], reserved: 2 }],
        "shop",
        [{ variantId: "phone", quantity: 2 }],
        -1,
      ),
    /Insufficient/,
  );
  assert.equal(levels[0].onHand, 3);
});
test("fractional, negative and missing stock lines are rejected", () => {
  for (const quantity of [0, -1, 1.5, NaN, Infinity])
    assert.throws(() =>
      changeStock(levels, "shop", [{ variantId: "phone", quantity }], -1),
    );
  assert.throws(
    () =>
      changeStock(levels, "shop", [{ variantId: "missing", quantity: 1 }], -1),
    /no stock/,
  );
});
test("receiving at a new location creates one balance for duplicate variant lines", () => {
  const next = changeStock(
    [],
    "shop",
    [
      { variantId: "charger", quantity: 3 },
      { variantId: "charger", quantity: 4 },
    ],
    1,
  );
  assert.equal(next.length, 1);
  assert.equal(next[0].onHand, 7);
});
test("duplicate, sold or wrong-location devices cannot be checked out", () => {
  const units = [
    {
      id: "u",
      variantId: "phone",
      locationId: "shop",
      status: "IN_STOCK",
    } as StockUnit,
  ];
  const line = { variantId: "phone", stockUnitId: "u", quantity: 1 };
  validateDevices(units, "shop", [line]);
  assert.throws(() => validateDevices(units, "shop", [line, line]), /twice/);
  assert.throws(
    () => validateDevices(units, "warehouse", [line]),
    /unavailable/,
  );
  assert.throws(
    () => validateDevices([{ ...units[0], status: "SOLD" }], "shop", [line]),
    /unavailable/,
  );
});
