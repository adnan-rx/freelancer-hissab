import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/providers/toast-provider";
import { QueryProvider } from "@/providers/query-provider";

const sans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

// Financial figures render in mono so digits align column to column.
const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "FreelancerHisab — Financial OS for Pakistani Freelancers",
    template: "%s · FreelancerHisab",
  },
  description:
    "Track income, manage expenses, generate invoices with PKR conversion, and monitor financial metrics.",
  openGraph: {
    title: "FreelancerHisab — Financial OS for Pakistani Freelancers",
    description:
      "Track income, manage expenses, generate invoices with PKR conversion, and monitor financial metrics.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#01411c",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body
        className={`${sans.variable} ${mono.variable} font-sans h-full bg-background text-foreground antialiased`}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-md"
        >
          Skip to content
        </a>
        <ToastProvider>
          <QueryProvider>{children}</QueryProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
