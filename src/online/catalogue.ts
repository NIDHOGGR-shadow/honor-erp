import type { Balance, Catalogue, Product } from "./api";

export type ShopProduct = Catalogue["products"][number];

export function variantLabel(product: Pick<Product, "colour" | "memory" | "market" | "sku">) {
  return [product.colour, product.memory, product.market].filter(Boolean).join(" · ") || product.sku;
}

export function productVariants(products: ShopProduct[], selected: ShopProduct) {
  const model = selected.model_name?.trim();
  if (!model) return [selected];
  return products.filter(product =>
    product.model_name?.trim() === model && product.category === selected.category &&
    (product.market || "") === (selected.market || ""),
  ).sort((a, b) => variantLabel(a).localeCompare(variantLabel(b)) || a.sku.localeCompare(b.sku));
}

export function productSearchText(product: Pick<Product, "name" | "sku" | "category" | "model_name" | "colour" | "memory" | "market">) {
  return [product.name, product.sku, product.category, product.model_name, product.colour, product.memory, product.market]
    .filter(Boolean).join(" ").toLowerCase();
}

export function priceMinor(value: FormDataEntryValue | null) {
  const input = String(value ?? "").trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(input))
    throw new Error("Enter a price with at most two decimal places.");
  const [whole, fraction = ""] = input.split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(amount) || amount > 2_000_000_000)
    throw new Error("Price must be between 0 and 20,000,000.");
  return amount;
}

export function availableStockValue(products: Product[], balances: Balance[]) {
  const prices = new Map(products.map(product => [product.id, product.price_minor]));
  return balances.reduce((total, balance) => total + balance.available * (prices.get(balance.product_id) || 0), 0);
}
