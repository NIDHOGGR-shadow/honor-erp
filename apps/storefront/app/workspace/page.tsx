import type { Metadata } from "next";
import Workspace from "../../../../src/online/Workspace";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Honor · Staff workspace",
  description: "Staff access to your company's inventory workspace.",
  robots: { index: false, follow: false },
};

export default async function WorkspacePage({
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
  return (
    <Workspace
      configured={Boolean(process.env.HONOR_API_ORIGIN)}
      initialSearch={initialSearch}
      shopUrl="/"
    />
  );
}
