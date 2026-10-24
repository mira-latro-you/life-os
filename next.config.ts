import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Seiten rendern nur Client-Komponenten aus dem Store → besuchte Seiten
    // dürfen im Router-Cache bleiben, Tab-Wechsel sind dann sofort da.
    staleTimes: { dynamic: 300, static: 600 },
  },
  async headers() {
    return [
      {
        // Service Worker nie cachen, sonst bleiben Updates hängen
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
  async redirects() {
    // alte Routen aus v1/v2
    return [
      { source: "/future", destination: "/bereiche", permanent: false },
      { source: "/notizen", destination: "/bereiche", permanent: false },
    ];
  },
};

export default nextConfig;
