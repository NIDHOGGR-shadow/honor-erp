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
