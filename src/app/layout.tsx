import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "HWSigner",
  description: "Unified Solana hardware wallet SDK with an interactive playground.",
  applicationName: "HWSigner",
  openGraph: {
    title: "HWSigner",
    description: "Unified Solana hardware wallet SDK with an interactive playground.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "HWSigner",
    description: "Unified Solana hardware wallet SDK with an interactive playground.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetBrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}

