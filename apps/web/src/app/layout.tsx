import type { Metadata } from "next";
import "./globals.css";
import { QueryProvider } from "@/providers/query-provider";

export const metadata: Metadata = {
  title: "FreelancerHisab - Financial OS for Pakistani Freelancers",
  description: "Track income, manage expenses, generate invoices with PKR conversion, and monitor financial metrics.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full">
      <body className="font-sans h-full bg-slate-950 text-slate-50 antialiased">
        <QueryProvider>
          {children}
        </QueryProvider>
      </body>
    </html>
  );
}
