import { productSearchText, type ShopProduct } from "./catalogue";

export type RecentSearch = { query: string; expiresAt: number };
export const SEARCH_HISTORY_TTL = 366 * 24 * 60 * 60 * 1000;
const normalise = (query: string) => query.trim().replace(/\s+/g, " ").slice(0, 80);

export function readSearchHistory(raw: string | null, now = Date.now()): RecentSearch[] {
  if (!raw || raw.length > 10000) return [];
  try {
    const value = JSON.parse(raw);
    if (value?.version !== 1 || !Array.isArray(value.items)) return [];
    const seen = new Set<string>();
    return value.items.filter((item: unknown): item is RecentSearch => {
      if (!item || typeof item !== "object") return false;
      const entry = item as RecentSearch;
      if (typeof entry.query !== "string" || !normalise(entry.query) ||
          !Number.isFinite(entry.expiresAt) || entry.expiresAt <= now ||
          entry.expiresAt > now + SEARCH_HISTORY_TTL) return false;
      const key = normalise(entry.query).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key); return true;
    }).slice(0, 3).map((item: RecentSearch) => ({ query: normalise(item.query), expiresAt: item.expiresAt }));
  } catch { return []; }
}

export function rememberSearch(history: RecentSearch[], query: string, now = Date.now()): RecentSearch[] {
  const term = normalise(query);
  const existing = readSearchHistory(JSON.stringify({ version: 1, items: history }), now);
  if (!term) return existing;
  return [{ query: term, expiresAt: now + SEARCH_HISTORY_TTL },
    ...existing.filter(item => item.query.toLowerCase() !== term.toLowerCase())].slice(0, 3);
}

export function suggestedProducts(products: ShopProduct[], query: string): ShopProduct[] {
  const term = normalise(query).toLowerCase();
  return term ? products.filter(product => productSearchText(product).includes(term)).slice(0, 5) : [];
}
