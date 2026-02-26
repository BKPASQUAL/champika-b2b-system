import type { Metadata } from "next";
// 1. Import standard Google Fonts instead of Geist
import { Inter, Roboto_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

// 2. Configure Inter as the sans-serif font, using the same variable name
const geistSans = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// 3. Configure Roboto Mono as the monospace font, using the same variable name
const geistMono = Roboto_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Finora Farm",
  description: "Finora Farm B2B Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
