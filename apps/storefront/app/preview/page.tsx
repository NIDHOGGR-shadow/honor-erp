import { notFound } from "next/navigation";
import StorefrontPreview from "../../../../src/online/StorefrontPreview";
import { isStorefrontReviewEnabled } from "../../lib/review";

export const metadata = { title: "HONOR · Storefront review", robots: { index: false, follow: false } };
export default async function PreviewPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!isStorefrontReviewEnabled()) notFound();
  const search = await searchParams;
  const initialSearch = new URLSearchParams(Object.entries(search).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string",
  )).toString();
  return <StorefrontPreview initialSearch={initialSearch} />;
}
