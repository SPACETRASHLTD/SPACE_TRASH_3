import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Booking Bot",
  description: "Artist availability & gig dispatch for talent booking agencies.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
