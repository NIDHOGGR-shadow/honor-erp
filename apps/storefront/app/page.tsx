import Storefront from "../../../src/online/Storefront";
import type { Catalogue } from "../../../src/online/api";
export const dynamic = "force-dynamic";
export default async function Page() {
  const slug = process.env.HONOR_STORE_SLUG;
  const origin = process.env.HONOR_API_ORIGIN?.replace(/\/$/, "");
  let initial: Catalogue | undefined;
  if (origin && slug) {
    try {
      const response = await fetch(
        origin + "/api/v1/storefront/" + encodeURIComponent(slug),
        { cache: "no-store" },
      );
      if (response.ok) initial = await response.json();
    } catch {
      /* The public UI offers a retry if the store is temporarily unavailable. */
    }
  }
  if (!slug)
    return (
      <main style={{ padding: "4rem", fontFamily: "system-ui" }}>
        <h1>Honor store</h1>
        <p>This store is not available right now. Please try again soon.</p>
      </main>
    );
  return (
    <Storefront
      slug={slug}
      initial={initial}
      staffUrl={process.env.HONOR_WORKSPACE_URL || "/workspace"}
    />
  );
}
