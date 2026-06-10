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
    default: "SkyGlow — Live Space Weather, Aurora Forecast & Solar Activity",
    template: "%s | SkyGlow",
  },
  description: "Live space weather dashboard — aurora forecast, Kp index, solar wind, solar flares, CMEs, coronal holes, fireball tracker, and meteor showers. Powered by NOAA SWPC.",
  icons: {
    icon: "/icon-1024.png.png",
    apple: "/icon-1024.png.png",
  },
  openGraph: {
    siteName: "SkyGlow",
    title: "SkyGlow — Live Space Weather, Aurora Forecast & Solar Activity",
    description: "Live space weather dashboard — aurora forecast, Kp index, solar wind, solar flares, CMEs, coronal holes, fireball tracker, and meteor showers. Powered by NOAA SWPC.",
    // opengraph-image.tsx in this directory generates the OG image dynamically with live Kp data.
  },
  twitter: {
    card: "summary_large_image",
    title: "SkyGlow — Live Space Weather, Aurora Forecast & Solar Activity",
    description: "Live space weather dashboard — aurora forecast, Kp index, solar wind, solar flares, CMEs, coronal holes, fireball tracker, and meteor showers. Powered by NOAA SWPC.",
  },
  keywords: ["aurora forecast tonight", "northern lights forecast", "northern lights tonight", "Kp index", "aurora borealis forecast", "space weather", "NOAA SWPC", "solar wind", "geomagnetic storm", "solar flare", "CME", "coronal hole", "fireball", "meteor shower"],
  authors: [{ name: "SkyGlow" }],
  verification: {
    google: "lcJfeGYAQoCV6vxmY4vSEZMLE1c9HwhECZdFQNEkwuQ",
  },
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
