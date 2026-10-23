import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Honor · Shop the collection",
  description: "Explore the collection, pay online and collect from the store.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
