import type { Metadata } from "next";
import { Playfair_Display } from "next/font/google";

import "./globals.css";

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-playfair-display",
});

export const metadata: Metadata = {
  title: "SST Platform",
  description: "Development environment for a server-side tracking platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={playfairDisplay.variable} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
