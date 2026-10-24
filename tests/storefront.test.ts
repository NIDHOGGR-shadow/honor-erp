import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Storefront from "../src/online/Storefront";

test("public catalogue renders product and price in initial server HTML", () => {
  const html = renderToStaticMarkup(
    React.createElement(Storefront, {
      slug: "test-shop",
      initial: {
        company: { name: "Test shop", slug: "test-shop", currency: "GBP" },
        products: [
          {
            id: "product",
            sku: "CABLE",
            name: "Braided cable",
            description: "A checked catalogue description",
            category: "Accessories",
            price_minor: 1000,
            image_url: "",
            available: 2,
          },
        ],
        checkout_enabled: true,
        simulation: false,
        fulfilment: "COLLECTION",
      },
    }),
  );
  assert.match(html, /Braided cable/);
  assert.match(html, /£10/);
  assert.match(html, /A checked catalogue description/);
  assert.match(html, /Available for collection/);
  assert.doesNotMatch(html, /Opening the collection/);
});

test("an unconfigured shop has an honest launch page and a working staff entry", () => {
  const html = renderToStaticMarkup(React.createElement(Storefront, { slug: "", configured: false }));
  assert.match(html, /Our online shop is getting ready/);
  assert.match(html, /Opening soon/);
  assert.match(html, /href="\/workspace"/);
  assert.doesNotMatch(html, /This shop is not available yet|Loading the collection|Search products/);
});

test("account access does not depend on a merchant catalogue being configured", () => {
  const html = renderToStaticMarkup(React.createElement(Storefront, {
    slug: "", configured: false, accountConfigured: true, initialSearch: "view=login",
  }));
  assert.match(html, /Email address/);
  assert.doesNotMatch(html, /fieldset disabled|Account access is being connected/);
});

test("unconnected account forms remain editable with an honest connection notice", () => {
  const html = renderToStaticMarkup(React.createElement(Storefront, {
    slug: "", configured: false, initialSearch: "view=signup",
  }));
  assert.match(html, /Account access is being connected/);
  assert.doesNotMatch(html, /<fieldset disabled/);
});

test("collection page does not show an endless loader when no shop is configured", () => {
  const html = renderToStaticMarkup(React.createElement(Storefront, {
    slug: "", configured: false, initialSearch: "view=locations",
  }));
  assert.match(html, /Collection details are coming soon/);
  assert.doesNotMatch(html, /Loading collection details/);
});
