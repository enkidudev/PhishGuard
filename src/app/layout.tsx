import type { Metadata } from "next";

import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "PhishGuard · Phishing Simulation & Awareness Platform",
  description:
    "Authorized phishing simulation and security awareness platform: run controlled campaigns, measure resilience, and train teams. Simulation only · no real emails, no credentials collected.",
  keywords: [
    "phishing simulation",
    "security awareness",
    "PhishGuard",
    "cybersecurity",
    "training",
  ],
  authors: [{ name: "PhishGuard Team" }],
  icons: {
    icon: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className="antialiased bg-background text-foreground"
      >
        {children}
        <Toaster position="bottom-right" theme="dark" richColors closeButton />
      </body>
    </html>
  );
}
