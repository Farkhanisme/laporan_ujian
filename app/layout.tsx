import type { Metadata } from "next";
import Link from "next/link";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NavLinks } from "@/components/nav-links";
import { NAMA_MADRASAH, TAHUN_AJARAN, SEMESTER } from "@/lib/config";
import "./globals.css";

export const metadata: Metadata = {
  title: `Raport ASTS — ${NAMA_MADRASAH}`,
  description: `Aplikasi raport dan dongkrak nilai ASTS ${NAMA_MADRASAH}`,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <header className="border-b bg-card">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <h1 className="text-base font-semibold leading-tight">
                Raport ASTS — {NAMA_MADRASAH}
              </h1>
              <p className="text-xs text-muted-foreground">
                {TAHUN_AJARAN} · {SEMESTER}
              </p>
            </div>
            <NavLinks />
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>

        <footer className="border-t py-4 text-center text-xs text-muted-foreground">
          {NAMA_MADRASAH} · {TAHUN_AJARAN} · Semester {SEMESTER}
        </footer>

        <Toaster position="top-right" richColors />
        <TooltipProvider>
          <Link href="/nilai" className="sr-only">
            Lompat ke halaman nilai
          </Link>
        </TooltipProvider>
      </body>
    </html>
  );
}