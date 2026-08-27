import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StackFox — IT Services Marketplace",
  description:
    "Enterprise IT services marketplace with 242 service units across Starter, Growth, and Premium tiers.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
