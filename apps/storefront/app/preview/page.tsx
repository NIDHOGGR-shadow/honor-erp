import StorefrontPreview from "../../../../src/online/StorefrontPreview";

export const metadata = { title: "HONOR · Design preview", robots: { index: false, follow: false } };
export default async function PreviewPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = await searchParams;
  const initialSearch = new URLSearchParams(Object.entries(search).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string",
  )).toString();
  return <StorefrontPreview initialSearch={initialSearch} />;
}
