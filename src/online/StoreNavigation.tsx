import React from "react";
import { categoryHref } from "./storefrontPaths";
import type { ShopProduct } from "./catalogue";
import type { ShopView } from "./customer";

export function StoreNavigation({ categories, onBrowse, pathname }: {
  pathname: string;
  categories: { label: string; category: string }[];
  products: ShopProduct[];
  direct?: boolean;
  onBrowse: (category?: string, query?: string) => void;
  onNavigate: (view: ShopView, product?: string) => void;
}) {
  return <nav aria-label="Product navigation" className="store-desktop-nav local-direct-nav">
    {categories.slice(0, 6).map(c => <a key={c.label} href={categoryHref(pathname, c.category)} onClick={event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
      event.preventDefault(); onBrowse(c.category, "");
    }}>{c.label}</a>)}
  </nav>;
}
