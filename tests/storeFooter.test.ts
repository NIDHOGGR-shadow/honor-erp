import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StoreFooter } from "../src/online/StorefrontDesign";

test("footer routes shopping, account recovery, collection and staff entry inside the shop", () => {
  const html = renderToStaticMarkup(React.createElement(StoreFooter, { currency: "NGN", staffUrl: "/workspace", href: view => `?view=${view}`, onNavigate() {}, onBrowse() {} }));
  for (const view of ["cart", "account", "login", "signup", "recover", "locations"]) assert.ok(html.includes(`?view=${view}`));
  assert.match(html, /href="\/workspace"/);
  assert.match(html, /href="#shop-content"/);
  assert.match(html, /Nigeria · NGN/);
  assert.doesNotMatch(html, /https:\/\/|Free delivery|warranty|refund|SAMPLE-/);
});

test("footer hides registration links once the customer is signed in", () => {
  const html = renderToStaticMarkup(React.createElement(StoreFooter, { signedIn: true, staffUrl: "/workspace", href: view => `?view=${view}`, onNavigate() {}, onBrowse() {} }));
  assert.match(html, /Your orders/);
  assert.doesNotMatch(html, /view=signup|view=login|view=recover/);
});
