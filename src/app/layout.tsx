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
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"),
  ),
  title: {
    default: "HWSigner",
    template: "%s | HWSigner",
  },
  description: "Adapter-based SDK prototype for Solana hardware wallets across browser and React Native runtimes.",
  applicationName: "HWSigner",
  keywords: [
    "Solana",
    "hardware wallet",
    "React Native",
    "Ledger",
    "WalletConnect",
    "Keystone",
    "Tangem",
    "SDK",
  ],
  authors: [{ name: "HWSigner contributors" }],
  creator: "HWSigner",
  publisher: "HWSigner",
  category: "developer tools",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    title: "HWSigner",
    description: "Adapter-based SDK prototype for Solana hardware wallets across browser and React Native runtimes.",
    url: "/",
    siteName: "HWSigner",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/og-image.svg",
        width: 1200,
        height: 630,
        alt: "HWSigner - Unified Solana hardware wallet SDK",
        type: "image/svg+xml",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "HWSigner",
    description: "Adapter-based SDK prototype for Solana hardware wallets across browser and React Native runtimes.",
    images: ["/og-image.svg"],
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
