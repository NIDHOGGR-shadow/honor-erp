"use client";
import React from "react";
import Storefront from "./Storefront";
import { referenceProducts } from "./StorefrontDesign";
import type { Catalogue } from "./api";

// This isolated route has synthetic stock/prices, no account access and no payments.
// Nothing here is imported by the live store's data loader or backend.
const previewCatalogue: Catalogue = {
  company: { name: "HONOR Nigeria", slug: "design-preview", currency: "NGN" },
  products: [
    { id: "sample-v5", sku: "SAMPLE-V5", name: "HONOR Magic V5", model_name: "HONOR Magic V5", category: "Phones", memory: "16 GB / 512 GB", colour: "Gold", market: "Nigeria", description: "Sample catalogue entry. Price and stock are for demonstration only.", image_url: referenceProducts[0].image, price_minor: 149000000, available: 4 },
    { id: "sample-400", sku: "SAMPLE-400", name: "HONOR 400 Pro", model_name: "HONOR 400 Pro", category: "Phones", memory: "12 GB / 256 GB", colour: "Black", market: "Nigeria", description: "Sample catalogue entry. Explore the product, choose a variant and try the cart.", image_url: referenceProducts[1].image, price_minor: 69000000, available: 6, location_availability: [{ location_id: "sample-location", available: 6 }] },
    { id: "sample-400-512", sku: "SAMPLE-400-512", name: "HONOR 400 Pro", model_name: "HONOR 400 Pro", category: "Phones", memory: "12 GB / 512 GB", colour: "Black", market: "Nigeria", description: "Sample catalogue entry with a different memory option and price.", image_url: referenceProducts[1].image, price_minor: 76000000, available: 2 },
    { id: "sample-laptop", sku: "SAMPLE-LAPTOP", name: "HONOR MagicBook 16 2026", category: "Laptops", description: "Sample catalogue entry. Price and stock are for demonstration only.", image_url: referenceProducts[2].image, price_minor: 120000000, available: 3 },
    { id: "sample-tablet", sku: "SAMPLE-TABLET", name: "HONOR Pad 10", category: "Tablets", description: "Sample catalogue entry. Price and stock are for demonstration only.", image_url: referenceProducts[3].image, price_minor: 25000000, available: 5 },
    { id: "sample-sold-out", sku: "SAMPLE-SOLD-OUT", name: "HONOR 400 Pro", model_name: "HONOR 400 Pro", category: "Phones", memory: "12 GB / 128 GB", colour: "Black", market: "Nigeria", description: "Sample unavailable variant. This cannot be added to a cart.", image_url: referenceProducts[1].image, price_minor: 65000000, available: 0 },
  ],
  recommendations: { popular_product_ids: ["sample-400", "sample-v5"], trending_product_ids: ["sample-400"], budget_product_ids: ["sample-400", "sample-tablet", "sample-laptop"], window_days: 7 },
  locations: [{ id: "sample-location", name: "Preview collection point", address: "Sample location — not a real store address." }],
  checkout_enabled: false, simulation: true, fulfilment: "COLLECTION", payment_methods: [],
};

export default function StorefrontPreview({ initialSearch = "" }: { initialSearch?: string }) {
  return <Storefront slug="design-preview" initial={previewCatalogue} initialSearch={initialSearch} accountConfigured={false} preview staffUrl="/workspace" />;
}
