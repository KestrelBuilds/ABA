import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "ABA Studio — Your creative business, considered.",
  description: "The project workspace for Alex Bell Arts.",
  icons: {
    icon: [
      {
        url: "/brand/favicon-light.png?v=4x",
        media: "(prefers-color-scheme: light)",
      },
      { url: "/brand/favicon-dark.png?v=4x", media: "(prefers-color-scheme: dark)" },
    ],
  },
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
