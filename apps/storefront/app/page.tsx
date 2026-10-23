import Storefront from "../../../src/online/Storefront";
import type { Catalogue } from "../../../src/online/api";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = await searchParams;
  const initialSearch = new URLSearchParams(
    Object.entries(search).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  ).toString();
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
  return (
    <Storefront
      slug={slug || ""}
      initial={initial}
      initialSearch={initialSearch}
      configured={Boolean(slug && origin)}
      staffUrl={process.env.HONOR_WORKSPACE_URL || "/workspace"}
    />
  );
}
