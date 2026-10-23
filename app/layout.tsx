import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { Backdrop } from "@/components/ui/Backdrop";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });

export const metadata: Metadata = {
  title: "Life OS",
  description: "Kalender, Notizen und Tagesbriefing – privat.",
  applicationName: "Life OS",
  appleWebApp: { capable: true, title: "Life OS", statusBarStyle: "black-translucent" },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#030817",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={geist.variable}>
      <body className="font-sans">
        <Backdrop />
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
