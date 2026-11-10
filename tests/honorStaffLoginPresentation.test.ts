import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("HONOR staff sign-in uses a single login panel, not the rejected promo split", () => {
  const workspace = source("../src/online/Workspace.tsx");
  const css = source("../src/online/honor-unified-layout.css");

  assert.match(workspace, /className="honor-staff-signin online-app"/);
  assert.match(workspace, /className="honor-staff-entry" aria-label="HONOR staff sign-in"/);
  assert.match(workspace, /SECURE TEAM ACCESS/);
  assert.match(workspace, /"Staff sign-in"/);
  assert.doesNotMatch(workspace, /honor-signin-intro|One place for the work behind the store/);
  assert.doesNotMatch(css, /honor-signin-intro|grid-template-columns:minmax\(290px/);
  assert.match(css, /max-width:462px/);
});

test("staff sign-in keeps its existing secure actions and is used by the deployed route", () => {
  const workspace = source("../src/online/Workspace.tsx");
  const page = source("../apps/storefront/app/workspace/page.tsx");
  const layout = source("../apps/storefront/app/globals.css");
  const sharedCss = source("../src/index.css");

  assert.match(workspace, /await api\.send\("\/auth\/login", values\)/);
  assert.match(workspace, /\/auth\/recovery-password/);
  assert.match(workspace, /\/auth\/activate-invitation/);
  assert.match(workspace, /Staff accounts are invitation-only/);
  assert.match(page, /import Workspace from "\.\.\/\.\.\/\.\.\/\.\.\/src\/online\/Workspace"/);
  assert.match(layout, /src\/index\.css/);
  assert.match(sharedCss, /honor-unified-layout\.css/);
});
