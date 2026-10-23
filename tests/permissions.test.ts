import { test } from "node:test";
import assert from "node:assert/strict";
import { canAccessModule } from "../src/utils/formatters";
test("company administration is limited to the company administrator", () => {
  for (const module of ["staff", "settings"]) {
    assert.equal(canAccessModule("OWNER", module), true);
    for (const role of ["MANAGER", "INVENTORY", "SALES"] as const)
      assert.equal(canAccessModule(role, module), false);
  }
});
test("inventory operators receive and transfer stock while sales staff cannot", () => {
  for (const module of ["add-stock", "transfers", "purchases"]) {
    assert.equal(canAccessModule("INVENTORY", module), true);
    assert.equal(canAccessModule("SALES", module), false);
  }
  assert.equal(canAccessModule("INVENTORY", "pos"), false);
});
test("unknown modules deny access by default", () =>
  assert.equal(canAccessModule("OWNER", "unknown"), false));
