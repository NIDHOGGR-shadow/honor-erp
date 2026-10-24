import Storefront from "../../../src/online/Storefront";
import { storefrontProps } from "../lib/catalogue";
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
  const props = await storefrontProps(process.env.HONOR_STORE_SLUG || "honor");
  return (
    <Storefront
      {...props}
      initialSearch={initialSearch}
    />
  );
}
