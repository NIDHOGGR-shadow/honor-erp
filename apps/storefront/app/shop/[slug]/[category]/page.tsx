import { categoryPage } from "../../../../lib/categoryPage";
export const dynamic = "force-dynamic";
export default async function Page({ params, searchParams }: {
  params: Promise<{ slug: string; category: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug, category } = await params;
  return categoryPage(category, slug, await searchParams, `/shop/${encodeURIComponent(slug)}`);
}
