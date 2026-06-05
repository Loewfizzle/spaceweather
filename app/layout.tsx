import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000"
  ),
  title: "AuroraWatch | Real-time Aurora & Space Weather",
  description: "Premium real-time aurora visibility and space weather dashboard for the United States, with focused coverage for Michigan and the Great Lakes. Live NOAA SWPC data.",
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "AuroraWatch | Real-time Aurora & Space Weather",
    description: "Premium real-time aurora visibility and space weather dashboard for the United States, with focused coverage for Michigan and the Great Lakes. Live NOAA SWPC data.",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "AuroraWatch - Real-time Aurora & Space Weather Dashboard",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AuroraWatch | Real-time Aurora & Space Weather",
    description: "Premium real-time aurora visibility and space weather dashboard for the United States, with focused coverage for Michigan and the Great Lakes. Live NOAA SWPC data.",
    images: ["/og-image.jpg"],
  },
  keywords: ["aurora", "space weather", "Michigan", "Great Lakes", "NOAA", "Kp index", "fireball", "meteor shower"],
  authors: [{ name: "AuroraWatch" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="min-h-full flex flex-col bg-[#05070f] text-[#f1f5f9]">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
