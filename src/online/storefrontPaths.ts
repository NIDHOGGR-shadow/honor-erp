export const storeCategories = ["Phones", "Laptops", "Tablets", "Wearables", "Audio", "Accessories"] as const;
export function storeBasePath(pathname: string) {
  return pathname.match(/^\/shop\/[^/]+(?=\/|$)/)?.[0] || "";
}
export function categoryLabel(value: string) {
  if (/^(earwears?|earbuds?|audio)$/i.test(value)) return "Audio";
  return storeCategories.find(c => c.toLowerCase() === value.toLowerCase()) || value;
}
export function categoryHref(pathname: string, category: string) {
  const base = storeBasePath(pathname);
  const label = categoryLabel(category);
  const segment = storeCategories.includes(label as typeof storeCategories[number]) ? label.toLowerCase() : "";
  return `${base}/${segment}${category === "All" ? "" : "?category=" + encodeURIComponent(category)}`;
}
export function pathCategory(pathname: string) {
  const segment = pathname.split("/").filter(Boolean).at(-1) || "";
  return storeCategories.find(c => c.toLowerCase() === segment);
}
