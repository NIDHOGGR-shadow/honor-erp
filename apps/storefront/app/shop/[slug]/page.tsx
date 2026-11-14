import Storefront from "../../../../../src/online/Storefront";
import { storefrontProps } from "../../../lib/catalogue";

export const dynamic = "force-dynamic";

export default async function ShopPage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug }, search] = await Promise.all([params, searchParams]);
  const initialSearch = new URLSearchParams(
    Object.entries(search).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  ).toString();
  return <Storefront basePath={`/shop/${encodeURIComponent(slug)}`} {...await storefrontProps(slug)} initialSearch={initialSearch} />;
}
