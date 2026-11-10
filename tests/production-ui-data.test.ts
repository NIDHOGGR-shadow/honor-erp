import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// Production guardrails: no synthetic sales or reference catalogue rendered as
// real business records. This test inspects the composition points, not fixtures.
const storefront = readFileSync("src/online/Storefront.tsx", "utf8");
const storefrontDesign = readFileSync("src/online/StorefrontDesign.tsx", "utf8");
const review = readFileSync("apps/storefront/lib/review.ts", "utf8");

test("empty real shop does not display an example HONOR inventory", () => {
  assert.doesNotMatch(storefront, /<ReferenceCollection\b/);
  assert.match(storefront, /featured\.some\(\(p\) => p\.available > 0\)/);
  assert.match(storefront, /No products available right now/);
});

test("customer-facing UI does not treat an unset selling price as zero-cost stock", () => {
  assert.match(storefront, /cart\[p\.id\] > p\.available \|\| p\.price_minor <= 0/);
  assert.match(storefront, /disabled=\{selected\.available <= 0 \|\| selected\.price_minor <= 0\}/);
  assert.match(storefront, /Price to be added/);
  assert.match(storefrontDesign, /p\.price_minor > 0 \? money/);
});

test("staff access remains separate from the public storefront", () => {
  assert.doesNotMatch(storefront, /Staff sign-in/);
  assert.doesNotMatch(storefrontDesign, /<a href=\{staffUrl\}>Staff sign-in/);
  assert.match(review, /environment\.VERCEL_ENV !== "production"/);
});
