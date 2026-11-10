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

test("a disconnected shop reports unavailable inventory without a public staff link", () => {
  const html = renderToStaticMarkup(React.createElement(Storefront, { slug: "", configured: false }));
  assert.match(html, /The shop is temporarily unavailable/);
  assert.match(html, /cannot load current products or stock/);
  assert.doesNotMatch(html, /href="\/workspace"/);
  assert.doesNotMatch(html, /Opening soon|View demo|View pilot|Loading the collection|Search products/);
});

test("account access does not depend on a merchant catalogue being configured", () => {
  const html = renderToStaticMarkup(React.createElement(Storefront, {
    slug: "", configured: false, accountConfigured: true, initialSearch: "view=login",
  }));
  assert.match(html, /Email address/);
  assert.doesNotMatch(html, /fieldset disabled|Account services are temporarily unavailable/);
});

test("unconnected account forms remain editable with an honest connection notice", () => {
  const html = renderToStaticMarkup(React.createElement(Storefront, {
    slug: "", configured: false, initialSearch: "view=signup",
  }));
  assert.match(html, /Account services are temporarily unavailable/);
  assert.doesNotMatch(html, /<fieldset disabled/);
});

test("collection page does not show an endless loader when no shop is configured", () => {
  const html = renderToStaticMarkup(React.createElement(Storefront, {
    slug: "", configured: false, initialSearch: "view=locations",
  }));
  assert.match(html, /Collection details unavailable/);
  assert.doesNotMatch(html, /Loading collection details/);
});

test("product options keep regional versions separate and show collection stock", () => {
  const base = { name: "Test phone", model_name: "Test model", market: "Nigeria", category: "Phones", description: "", image_url: "", price_minor: 10000, available: 2 };
  const html = renderToStaticMarkup(React.createElement(Storefront, {
    slug: "shop", initialSearch: "view=product&product=black", initial: {
      company: { name: "Test shop", slug: "shop", currency: "NGN" },
      products: [
        { ...base, id: "black", sku: "BLACK", colour: "Black", memory: "8 / 256 GB", location_availability: [{ location_id: "main", available: 2 }] },
        { ...base, id: "white", sku: "WHITE", colour: "White", memory: "12 / 512 GB", available: 0 },
        { ...base, id: "china", sku: "CHINA", market: "China", colour: "Red", memory: "16 / 512 GB" },
      ], checkout_enabled: true, simulation: false, fulfilment: "COLLECTION",
      locations: [{ id: "main", name: "Main collection point", address: "Store address" }],
    },
  }));
  assert.match(html, /Colour and memory/);
  assert.match(html, /value="white"/);
  assert.match(html, /Out of stock/);
  assert.doesNotMatch(html, /value="china"/);
  assert.match(html, /Main collection point/);
  assert.match(html, /2 available/);
});

test("storefront renders saved content as text without displaying development notes", () => {
  const html = renderToStaticMarkup(React.createElement(Storefront, { slug: "shop", initial: {
    company: { name: "Shop", slug: "shop", currency: "NGN", storefront_content: { heading: "Shop by category", introduction: "<script>unsafe()</script>" } },
    products: [], checkout_enabled: false, simulation: false, fulfilment: "COLLECTION",
  }}));
  assert.match(html, /Shop by category/);
  assert.match(html, /&lt;script&gt;unsafe\(\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>unsafe|prototype|Local development environment/);
});
