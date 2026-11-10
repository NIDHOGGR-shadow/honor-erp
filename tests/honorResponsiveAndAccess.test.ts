import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Storefront from "../src/online/Storefront";
import PasswordSetup from "../src/online/PasswordSetup";
import { client } from "../src/online/api";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("customer login and registration show a clear password visibility toggle", () => {
  for (const mode of ["login", "signup"]) {
    const html = renderToStaticMarkup(React.createElement(Storefront, {
      slug: "honor", configured: false, initialSearch: "view=" + mode,
    }));
    assert.match(html, /aria-label="Show password"/);
    assert.match(html, />Show<\/span>/);
    assert.match(html, /type="password"/);
    assert.match(html, /honor-password-toggle/);
  }
});

test("first-login password setup allows revealing each private field without changing auth API", () => {
  const html = renderToStaticMarkup(React.createElement(PasswordSetup, {
    api: client("/api/v1"),
    complete: async () => {},
    signOut: async () => {},
  }));
  for (const label of ["temporary password", "new private password", "confirm new password"]) {
    assert.match(html, new RegExp('aria-label="Show ' + label + '"'));
  }
  assert.match(html, /type="password"/);
  assert.match(read("../src/online/PasswordSetup.tsx"), /api.send\("\/auth\/password"/);
});

test("mobile staff menu uses a light integrated drawer, never the legacy green modal", () => {
  const ws = read("../src/online/Workspace.tsx");
  const css = read("../src/online/honor-unified-layout.css");
  assert.match(ws, /honor-mobile-navigation-drawer/);
  assert.match(ws, /role="dialog" aria-modal="true"/);
  assert.match(ws, /aria-label="Close menu"/);
  assert.match(ws, /document.body.style.overflow = "hidden"/);
  assert.doesNotMatch(ws, /<Modal title="Navigation"/);
  assert.match(css, /honor-mobile-navigation-tab\[aria-current="page"\]/);
  assert.match(css, /background:#fff/);
  assert.match(css, /grid-template-columns:minmax\(95px,1fr\) auto minmax\(125px,1fr\)/);
});

test("public storefront separates missing setup from a missing product catalogue", () => {
  const src = read("../src/online/Storefront.tsx");
  assert.match(src, /catalogueFailure === "not-configured"/);
  assert.match(src, /catalogueFailure === "not-found"/);
  assert.match(src, /Try loading products again/);
  assert.match(src, /connectionRetries.current >= 2/);
  assert.doesNotMatch(src, /<ReferenceCollection\b/);
});
