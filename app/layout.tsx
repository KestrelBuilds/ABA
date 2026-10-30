import type { Metadata } from "next";
import "./globals.css";
import localFont from "next/font/local";
const displayFont = localFont({
  src: "../public/fonts/VinaSans-Regular.ttf",
  variable: "--font-display",
  weight: "400",
  display: "swap",
});
const labelFont = localFont({
  src: "../public/fonts/FiraCode-Variable.ttf",
  variable: "--font-mono",
  weight: "300 700",
  display: "swap",
  preload: false,
});
export const metadata: Metadata = {
  title: "ABA Studio — Loyalty is key.",
  description: "Your personalised creative journey with Alex Bell Arts.",
  icons: {
    icon: [
      {
        url: "/brand/favicon-light.png?v=4x",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/brand/favicon-dark.png?v=4x",
        media: "(prefers-color-scheme: dark)",
      },
    ],
  },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en-GB"
      className={`${displayFont.variable} ${labelFont.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
