import type { Metadata } from "next";
import PresentationWorkspace from "./PresentationWorkspace";

export const metadata: Metadata = {
  title: "Honor · Inventory walkthrough",
  description: "An empty browser-only inventory demonstration. No shared business data or real payments.",
  robots: { index: false, follow: false },
};

export default function DemoPage() { return <PresentationWorkspace />; }
