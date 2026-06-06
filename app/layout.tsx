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
  // and social previews always resolve to space.loewfizzle.com instead of
  // the underlying Vercel deployment URL (VERCEL_URL).
  // This is the main fix for social preview issues.
  metadataBase: new URL(
    process.env.VERCEL_ENV === "production"
      ? "https://space.loewfizzle.com"
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000"
  ),
  title: {
    default: "AuroraWatch | Real-time Aurora & Space Weather",
    template: "%s | AuroraWatch",
  },
  description: "Premium real-time aurora visibility and space weather dashboard for the United States, with particularly strong coverage for the Great Lakes region and northern states. Live NOAA SWPC data.",
  icons: {
    icon: "/icon.svg",
  },
  openGraph: {
    siteName: "AuroraWatch",
    title: "AuroraWatch | Real-time Aurora & Space Weather",
    description: "Premium real-time aurora visibility and space weather dashboard for the United States, with particularly strong coverage for the Great Lakes region and northern states. Live NOAA SWPC data.",
    // opengraph-image.tsx in this directory generates the OG image dynamically with live Kp data.
  },
  twitter: {
    card: "summary_large_image",
    title: "AuroraWatch | Real-time Aurora & Space Weather",
    description: "Premium real-time aurora visibility and space weather dashboard for the United States, with particularly strong coverage for the Great Lakes region and northern states. Live NOAA SWPC data.",
  },
  keywords: ["aurora", "space weather", "Michigan", "Great Lakes", "NOAA", "Kp index", "fireball", "meteor shower"],
  authors: [{ name: "AuroraWatch" }],
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
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
