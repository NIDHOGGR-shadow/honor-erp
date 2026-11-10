"use client";
import React, { useState } from "react";
import { money, type Product } from "./api";
import type { HonorDeviceReference } from "./honorDeviceLibrary";
import { Field } from "./ui";

type FormProps = {
  product?: Product;
  suggestion?: HonorDeviceReference;
  currency: string;
  busy: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

export function ProductForm({ product: p, suggestion, currency, busy, onSubmit }: FormProps) {
  const [image, setImage] = useState(p?.image_url || suggestion?.imageUrl || "");
  const [imageError, setImageError] = useState(false);
  return <form className="space-y-5" onSubmit={onSubmit}>
    <Field label="Product name"><input required name="name" minLength={2} maxLength={160} defaultValue={p?.name || suggestion?.name} className="online-input" /></Field>
    <div className="grid grid-cols-2 gap-4">
      <Field label="SKU"><input required name="sku" maxLength={80} defaultValue={p?.sku} className="online-input" /></Field>
      <Field label="Category"><input required name="category" maxLength={80} defaultValue={p?.category || suggestion?.category || "General"} className="online-input" /></Field>
    </div>
    <Field label="Model / variant group (optional)"><input name="model_name" maxLength={160} defaultValue={p?.model_name || suggestion?.name} className="online-input" /></Field>
    <div className="grid grid-cols-2 gap-4">
      <Field label="Colour (optional)"><input name="colour" maxLength={80} defaultValue={p?.colour} className="online-input" /></Field>
      <Field label="RAM / storage (optional)"><input name="memory" maxLength={80} defaultValue={p?.memory} className="online-input" /></Field>
    </div>
    <Field label="Market / regional version (optional)"><input name="market" maxLength={80} defaultValue={p?.market} className="online-input" /></Field>
    <Field label="Tracking"><select name="tracking" defaultValue={p?.tracking || "QUANTITY"} className="online-input"><option value="QUANTITY">Quantity</option><option value="SERIAL">Individual serial / IMEI</option></select></Field>
    <div className="grid grid-cols-2 gap-4">
      <Field label={"Selling price (" + currency + ")"}><input name="price" type="number" min="0" step="0.01" max="20000000" defaultValue={p?.price_minor ? p.price_minor / 100 : ""} placeholder="Leave blank for draft" className="online-input" /></Field>
      <Field label={"Unit cost (" + currency + ")"}><input name="cost" type="number" min="0" step="0.01" max="20000000" defaultValue={p?.cost_minor ? p.cost_minor / 100 : ""} placeholder="Set when known" className="online-input" /></Field>
    </div>
    <Field label="Reorder point"><input required name="reorder" type="number" min="0" max="1000000" step="1" defaultValue={p?.reorder_point ?? 5} className="online-input" /></Field>
    <Field label="Specifications and description"><textarea name="description" rows={4} maxLength={3000} defaultValue={p?.description} className="online-input" /></Field>
    <Field label="Product image - HTTPS address (optional)"><input name="image" type="url" maxLength={2000} value={image} onChange={event => { setImage(event.target.value); setImageError(false); }} className="online-input" /></Field>
    {image.startsWith("https://") && !imageError && <img src={image} alt="Product image preview" onError={() => setImageError(true)} referrerPolicy="no-referrer" className="h-40 w-full rounded-xl bg-zinc-50 object-contain" />}
    {imageError && <p role="status" className="text-xs text-amber-700">The image could not be loaded. Check the address before publishing.</p>}
    <Field label="Official product / specification source (optional)"><input name="source_url" type="url" maxLength={2000} defaultValue={p?.source_url || suggestion?.officialProductUrl} className="online-input" /></Field>
    <p className="text-xs leading-6 text-zinc-500">Leave the selling price blank and keep this as a draft until the owner confirms the price and quantity. Choosing a device does not add stock.</p>
    <label className="flex items-center gap-2 text-xs text-zinc-600"><input name="published" type="checkbox" defaultChecked={p?.published} />Show this product in the customer store</label>
    <button disabled={busy} className="honor-button w-full">{busy ? "Saving…" : "Save product"}</button>
  </form>;
}

export function PriceForm({ product, currency, busy, onSubmit }: FormProps & { product: Product }) {
  return <form className="space-y-5" onSubmit={onSubmit}>
    <p className="text-sm font-medium">{product.name}</p>
    <p className="text-xs text-zinc-500">Current selling price: {money(product.price_minor, currency)}</p>
    <Field label={"New selling price (" + currency + ")"}><input required autoFocus name="price" type="number" min="0" max="20000000" step="0.01" defaultValue={product.price_minor / 100} className="online-input" /></Field>
    <Field label="Reason for the change"><textarea required name="reason" minLength={5} maxLength={300} rows={2} className="online-input" /></Field>
    <button disabled={busy} className="honor-button w-full">{busy ? "Saving…" : "Update price"}</button>
  </form>;
}
