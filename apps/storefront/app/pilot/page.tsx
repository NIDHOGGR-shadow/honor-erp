import type { Metadata } from "next";
import PilotHome from "../../../../src/presentation/PilotHome";

export const metadata: Metadata = {
  title: "Honor · Presentation pilot",
  description: "A focused first look at Honor's inventory workspace, staff access and customer shop.",
  robots: { index: false, follow: false },
};

export default function PilotPage() { return <PilotHome />; }
