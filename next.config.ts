import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Prevent clickjacking
          { key: "X-Frame-Options", value: "DENY" },
          // Prevent MIME-type sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Limit referrer information on cross-origin requests
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Disable access to sensitive browser APIs not needed by this app
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // Enforce HTTPS for 2 years (only effective on the deployed HTTPS domain)
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          // Content Security Policy
          // script/style: unsafe-inline required by Next.js App Router hydration + Tailwind inline styles.
          // img: cartocdn for Leaflet tiles; sdo.gsfc.nasa.gov for live SDO solar images; data: for canvas blobs.
          // connect: all NOAA/NASA API calls are server-side (route handlers), so self is sufficient client-side.
          // No unsafe-eval — Leaflet canvas overlay does not need it.
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https://*.basemaps.cartocdn.com https://sdo.gsfc.nasa.gov",
              "connect-src 'self' https://services.swpc.noaa.gov",
              "font-src 'self'",
              "worker-src 'none'",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
