import React from "react";
import { type Company, type Product } from "./api";

type Props = {
  company: Company;
  products: Product[];
  busy: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onProducts: () => void;
};

export function HonorOnlineStoreSettings({ company, products, busy, onSubmit, onProducts }: Props) {
  const published = products.filter(p => p.published);
  const withoutImage = published.filter(p => !p.image_url);
  const unpriced = published.filter(p => p.price_minor <= 0);
  return <div className="honor-store-settings">
    <div className="honor-store-settings-header">
      <div><h2>Customer storefront</h2><p>What customers see at HONOR. Your products and stock still come from your actual store records.</p></div>
      <a className="online-secondary" href={`/shop/${encodeURIComponent(company.slug)}`} target="_blank" rel="noreferrer">Open online store ↗</a>
    </div>
    <section className="mb-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-xs leading-6 text-zinc-600" aria-label="Your store link">
      <p className="font-semibold text-zinc-800">Your store's direct link</p>
      <a href={`/shop/${encodeURIComponent(company.slug)}`} target="_blank" rel="noreferrer" className="mt-1 block break-all font-medium underline underline-offset-2">
        {"/shop/" + company.slug} ↗
      </a>
      <p className="mt-2">If the main website says the shop is unavailable but this direct link opens, the website's home shop address needs reconnecting. Ask the person managing the website to link it to this store.</p>
      {!products.length && <p className="mt-2">Your product list is currently empty. Add real devices as drafts, confirm pictures and prices, then publish only the products you actually sell.</p>}
    </section>
    <div className="honor-store-settings-metrics">
      <div><span>Registered products</span><strong>{products.length}</strong></div>
      <div><span>Published products</span><strong>{published.length}</strong></div>
      <div><span>Published without pictures</span><strong>{withoutImage.length}</strong></div>
      <div><span>Published without prices</span><strong>{unpriced.length}</strong></div>
    </div>
    <div className="honor-store-settings-columns">
      <section className="online-panel">
        <div className="honor-store-settings-section-title"><h3>Storefront wording</h3><p>Update the headings and introduction customers read. These settings are saved to your existing store.</p></div>
        <form key={company.id + JSON.stringify(company.storefront_content)} className="honor-store-settings-form" onSubmit={onSubmit}>
          <label>Shop heading
            <input required name="heading" minLength={2} maxLength={120} defaultValue={company.storefront_content?.heading || "Shop by category"} className="online-input"/>
          </label>
          <label>Shop introduction
            <textarea name="introduction" rows={4} maxLength={500} defaultValue={company.storefront_content?.introduction || ""} className="online-input"/>
          </label>
          <label>Collection page heading
            <input required name="collection_heading" minLength={2} maxLength={120} defaultValue={company.storefront_content?.collection_heading || "Collection locations"} className="online-input"/>
          </label>
          <button type="submit" disabled={busy} className="honor-button">Save storefront wording</button>
        </form>
      </section>
      <div>
        <section className="online-panel honor-store-settings-panel">
          <h3>Product photos and prices</h3>
          <p>Select a device in Products, check its picture, add its real price and save. Only staff-approved products are shown for sale.</p>
          <button type="button" className="online-secondary" onClick={onProducts}>Manage products</button>
        </section>
        <section className="online-panel honor-store-settings-panel">
          <h3>Promotion banners</h3>
          <div className="honor-store-settings-banner" aria-label="Planned desktop promotion artwork">Desktop image slot · 16:9</div>
          <div className="honor-store-settings-banner mobile" aria-label="Planned mobile promotion artwork">Mobile image slot · 4:5</div>
          <p>Image uploads and scheduled discounts are not yet connected to the live backend. The planned image spaces are shown here for layout reference only.</p>
        </section>
      </div>
    </div>
  </div>;
}
