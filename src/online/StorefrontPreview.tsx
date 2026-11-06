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
    { id: "sample-v5", sku: "SAMPLE-V5", name: "HONOR Magic V5", model_name: "HONOR Magic V5", category: "Phones", memory: "16 GB / 512 GB", colour: "Gold", market: "Nigeria", description: "", image_url: referenceProducts[0].image, price_minor: 149000000, available: 4 },
    { id: "sample-400", sku: "SAMPLE-400", name: "HONOR 400 Pro", model_name: "HONOR 400 Pro", category: "Phones", memory: "12 GB / 256 GB", colour: "Black", market: "Nigeria", description: "", image_url: referenceProducts[1].image, price_minor: 69000000, available: 6 },
    { id: "sample-400-512", sku: "SAMPLE-400-512", name: "HONOR 400 Pro", model_name: "HONOR 400 Pro", category: "Phones", memory: "12 GB / 512 GB", colour: "Black", market: "Nigeria", description: "", image_url: referenceProducts[1].image, price_minor: 76000000, available: 2 },
    { id: "sample-laptop", sku: "SAMPLE-LAPTOP", name: "HONOR MagicBook 16 2026", category: "Laptops", description: "", image_url: referenceProducts[2].image, price_minor: 120000000, available: 3 },
    { id: "sample-tablet", sku: "SAMPLE-TABLET", name: "HONOR Pad 10", category: "Tablets", description: "", image_url: referenceProducts[3].image, price_minor: 25000000, available: 5 },
    { id: "sample-sold-out", sku: "SAMPLE-SOLD-OUT", name: "HONOR 400 Pro", model_name: "HONOR 400 Pro", category: "Phones", memory: "12 GB / 128 GB", colour: "Black", market: "Nigeria", description: "", image_url: referenceProducts[1].image, price_minor: 65000000, available: 0 },
  ],
  recommendations: { popular_product_ids: ["sample-400", "sample-v5"], trending_product_ids: ["sample-400"], budget_product_ids: ["sample-400", "sample-tablet", "sample-laptop"], window_days: 7 },
  locations: [],
  checkout_enabled: false, simulation: true, fulfilment: "COLLECTION", payment_methods: [],
};

export default function StorefrontPreview({ initialSearch = "" }: { initialSearch?: string }) {
  return <Storefront slug="design-preview" initial={previewCatalogue} initialSearch={initialSearch} accountConfigured={false} preview staffUrl="/workspace" />;
}
