import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import { Analytics } from "@vercel/analytics/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Hardcode the production custom domain so that OG images, canonical URLs,
  // and social previews always resolve to skyglow.app instead of
  // the underlying Vercel deployment URL (VERCEL_URL).
  // This is the main fix for social preview issues.
  metadataBase: new URL(
    process.env.VERCEL_ENV === "production"
      ? "https://skyglow.app"
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000"
  ),
  title: {
    default: "SkyGlow | Real-time Aurora & Space Weather",
    template: "%s | SkyGlow",
  },
  description: "Premium real-time aurora visibility and space weather dashboard for the United States, with particularly strong coverage for the Great Lakes region and northern states. Live NOAA SWPC data.",
  icons: {
    icon: "/icon.svg",
  },
  openGraph: {
    siteName: "SkyGlow",
    title: "SkyGlow | Real-time Aurora & Space Weather",
    description: "Premium real-time aurora visibility and space weather dashboard for the United States, with particularly strong coverage for the Great Lakes region and northern states. Live NOAA SWPC data.",
    // opengraph-image.tsx in this directory generates the OG image dynamically with live Kp data.
  },
  twitter: {
    card: "summary_large_image",
    title: "SkyGlow | Real-time Aurora & Space Weather",
    description: "Premium real-time aurora visibility and space weather dashboard for the United States, with particularly strong coverage for the Great Lakes region and northern states. Live NOAA SWPC data.",
  },
  keywords: ["aurora", "space weather", "northern lights", "Great Lakes", "NOAA", "Kp index", "fireball", "meteor shower"],
  authors: [{ name: "SkyGlow" }],
  alternates: {
    canonical: "/",
  },
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
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:rounded focus:bg-[#0d1425] focus:px-4 focus:py-2 focus:text-sm focus:text-[#94a3b8] focus:outline focus:outline-[#1e2937]"
        >
          Skip to main content
        </a>
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
