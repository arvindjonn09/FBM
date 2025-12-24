import "./globals.css";
import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ServiceWorkerRegister } from "../components/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: "Debt & Cashflow Tracker",
  description: "Offline-first PWA for debt and cashflow tracking",
  manifest: "/manifest.webmanifest",
  themeColor: "#0f172a"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen text-slate-100">
        <ServiceWorkerRegister />
        <header className="sticky top-0 z-20 bg-slate-900/60 backdrop-blur border-b border-white/10">
          <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2 font-semibold text-lg">
              <span className="text-emerald-400">●</span>
              <span>Calendar MBA</span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <Link href="/">Dashboard</Link>
              <Link href="/overview">Totals</Link>
              <Link href="/ato">ATO</Link>
              <Link href="/debts">Debts</Link>
              <Link href="/analytics">Analytics</Link>
              <Link href="/settings">Settings</Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
