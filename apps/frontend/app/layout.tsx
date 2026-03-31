import type { Metadata } from "next";

import "./globals.css";

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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
