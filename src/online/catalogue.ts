import type { Balance, Catalogue, Product } from "./api";

export type ShopProduct = Catalogue["products"][number];

export function readShopFilters(search: string) {
  const params = new URLSearchParams(search);
  return {
    query: params.get("q") || "",
    category: params.get("category") || "All",
    sort: ["featured", "name", "price-asc", "price-desc"].includes(params.get("sort") || "") ? params.get("sort")! : "featured",
    shelf: ["featured", "trending", "popular", "budget"].includes(params.get("shelf") || "") ? params.get("shelf")! : "featured",
    inStock: params.get("stock") === "1",
  };
}

export function catalogueSelection(products: ShopProduct[], filters: ReturnType<typeof readShopFilters>, recommendations?: Catalogue["recommendations"]) {
  const { query, category, sort, shelf, inStock } = filters;
  const ids = shelf === "trending" ? recommendations?.trending_product_ids : shelf === "popular" ? recommendations?.popular_product_ids : shelf === "budget" ? recommendations?.budget_product_ids : undefined;
  const featuredIds = [...new Set([...(recommendations?.trending_product_ids || []), ...(recommendations?.popular_product_ids || [])])];
  const ranks = new Map((ids || featuredIds).map((id, index) => [id, index]));
  return products.filter(p => (category === "All" || p.category === category) &&
    (!inStock || p.available > 0) && productSearchText(p).includes(query.trim().toLowerCase()) &&
    (shelf === "featured" || (p.available > 0 && (ids ? ranks.has(p.id) : shelf === "budget"))))
    .sort((a, b) => {
      if (sort === "price-asc" || (shelf === "budget" && sort === "featured")) return a.price_minor - b.price_minor || a.name.localeCompare(b.name);
      if (sort === "price-desc") return b.price_minor - a.price_minor || a.name.localeCompare(b.name);
      if (sort === "name") return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
      if (ids) return (ranks.get(a.id) ?? Infinity) - (ranks.get(b.id) ?? Infinity) || a.name.localeCompare(b.name);
      if (a.available > 0 && b.available > 0 && (ranks.has(a.id) || ranks.has(b.id))) return (ranks.get(a.id) ?? Infinity) - (ranks.get(b.id) ?? Infinity);
      return Number(b.available > 0) - Number(a.available > 0) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
    });
}

export function variantLabel(product: Pick<Product, "colour" | "memory" | "market" | "sku">, includeSku = true) {
  return [product.colour, product.memory, product.market].filter(Boolean).join(" · ") || (includeSku ? product.sku : "");
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
