import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const file = (relative: string) => new URL(relative, import.meta.url);

test("shop and staff routes have distinct source folders without changing public URLs", () => {
  for (const route of [
    "../apps/storefront/app/(shop)/page.tsx",
    "../apps/storefront/app/(shop)/[category]/page.tsx",
    "../apps/storefront/app/(shop)/shop/[slug]/page.tsx",
    "../apps/storefront/app/(shop)/shop/[slug]/[category]/page.tsx",
    "../apps/storefront/app/(staff)/workspace/page.tsx",
    "../apps/storefront/app/(staff)/admin/page.tsx",
  ]) assert.ok(existsSync(file(route)), route);
  assert.equal(existsSync(file("../apps/storefront/app/workspace/page.tsx")), false);
  assert.equal(existsSync(file("../apps/storefront/app/page.tsx")), false);
});

test("/admin is a redirect to existing protected workspace, not another sign-in system", () => {
  const source = readFileSync(file("../apps/storefront/app/(staff)/admin/page.tsx"), "utf8");
  assert.match(source, /redirect\("\/workspace"\)/);
  assert.doesNotMatch(source, /createUser|signUp|api\.send|supabase\.auth/);
});
