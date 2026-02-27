import type { Metadata, Viewport } from "next";
import PWAInitializer from "@/components/PWAInitializer";
import NativePushInitializer from "@/components/NativePushInitializer";
import "./globals.css";

export const metadata: Metadata = {
  title: "Equilibrium - Smart Group Expenses",
  description: "Split expenses, settle debts, stay balanced. Built for Indian friend groups.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Equilibrium",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: "Equilibrium",
    title: "Equilibrium - Smart Group Expenses",
    description: "Split expenses, settle debts, stay balanced",
  },
  twitter: {
    card: "summary",
    title: "Equilibrium - Smart Group Expenses",
    description: "Split expenses, settle debts, stay balanced",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#F07F3C",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className="antialiased"
      >
        <PWAInitializer />
        <NativePushInitializer />
        {children}
      </body>
    </html>
  );
}
