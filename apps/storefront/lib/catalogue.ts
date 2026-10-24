import type { Catalogue } from "../../../src/online/api";

export async function storefrontProps(slug: string) {
  const origin = process.env.HONOR_API_ORIGIN?.replace(/\/$/, "");
  let initial: Catalogue | undefined;
  if (origin && slug) {
    try {
      const response = await fetch(
        `${origin}/api/v1/storefront/${encodeURIComponent(slug)}`,
        { cache: "no-store", signal: AbortSignal.timeout(5000) },
      );
      if (response.ok) initial = await response.json();
    } catch {
      // Render's free service may be waking up. Render the page and let the
      // client retry rather than holding the entire storefront response open.
    }
  }
  return {
    slug,
    initial,
    configured: Boolean(slug && origin),
    accountConfigured: Boolean(origin),
    staffUrl: process.env.HONOR_WORKSPACE_URL || "/workspace",
  };
}
