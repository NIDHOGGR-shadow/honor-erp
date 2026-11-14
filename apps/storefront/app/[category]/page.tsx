import { categoryPage } from "../../lib/categoryPage";
export const dynamic = "force-dynamic";
export default async function Page({ params, searchParams }: {
  params: Promise<{ category: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { category } = await params;
  return categoryPage(category, process.env.HONOR_STORE_SLUG || "honor", await searchParams);
}
