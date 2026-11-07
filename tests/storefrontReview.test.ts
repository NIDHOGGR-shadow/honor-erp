import { test } from "node:test";
import assert from "node:assert/strict";
import { isStorefrontReviewEnabled } from "../apps/storefront/lib/review";

test("production deployments cannot expose illustrative catalogue data", () => {
  assert.equal(isStorefrontReviewEnabled({ VERCEL_ENV: "production", NODE_ENV: "production" }), false);
  assert.equal(isStorefrontReviewEnabled({ VERCEL_ENV: "production", NODE_ENV: "development" }), false);
  assert.equal(isStorefrontReviewEnabled({ NODE_ENV: "production" }), false);
  assert.equal(isStorefrontReviewEnabled({}), false);
});

test("review data remains available to preview deployments and local development", () => {
  assert.equal(isStorefrontReviewEnabled({ VERCEL_ENV: "preview", NODE_ENV: "production" }), true);
  assert.equal(isStorefrontReviewEnabled({ NODE_ENV: "development" }), true);
});
