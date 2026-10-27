import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "ABA Studio — Your creative business, considered.",
  description: "Alex Bell Arts project management demonstration.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB">
      <body>{children}</body>
    </html>
  );
}
