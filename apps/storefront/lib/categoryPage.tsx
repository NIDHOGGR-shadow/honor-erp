import { notFound } from "next/navigation";
import Storefront from "../../../src/online/Storefront";
import { storeCategories } from "../../../src/online/storefrontPaths";
import { storefrontProps } from "./catalogue";

export async function categoryPage(category: string, slug: string, search: Record<string, string | string[] | undefined>, basePath = "") {
  const label = storeCategories.find(c => c.toLowerCase() === category);
  if (!label) notFound();
  const params = new URLSearchParams(Object.entries(search).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  params.set("category", label);
  const props = await storefrontProps(slug);
  return <Storefront basePath={basePath} {...props} initialSearch={params.toString()} />;
}
