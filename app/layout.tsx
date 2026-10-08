import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/app-sidebar";
import { MobileTopBar } from "@/components/mobile-top-bar";
import { ThemeProvider } from "@/components/theme-provider";
import { NAMA_MADRASAH, SEMESTER, TAHUN_AJARAN } from "@/lib/config";
import "./globals.css";

// Satu keluarga untuk seluruh UI. Variable dipakai lewat `--font-jakarta`
// yang dipetakan ke `--font-sans` di globals.css, jadi tabel dan form ikut
// memakai font yang sama tanpa harus menimpa kelas di tiap komponen.
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: `Raport ASTS — ${NAMA_MADRASAH}`,
  description: `Aplikasi raport dan dongkrak nilai ASTS ${NAMA_MADRASAH}`,
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfdfc" },
    { media: "(prefers-color-scheme: dark)", color: "#1a2220" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // `suppressHydrationWarning` wajib: next-themes menulis kelas `.dark` ke
    // <html> sebelum React hydrate, sehingga atribut server dan klien berbeda.
    <html lang="id" suppressHydrationWarning className={jakarta.variable + " h-full antialiased"}>
      <body className="min-h-full">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider>
            <div className="flex min-h-full flex-col">
              <MobileTopBar />

              {/* Sidebar hanya di layar besar; di bawah itu digantikan drawer. */}
              <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r lg:block">
                <AppSidebar />
              </aside>

              <div className="flex flex-1 flex-col lg:pl-60">
                <main className="mx-auto w-full max-w-[100rem] flex-1 px-4 py-5 sm:px-6 sm:py-7">
                  {children}
                </main>

                <footer className="border-t px-4 py-4 text-center text-xs text-muted-foreground sm:px-6">
                  {NAMA_MADRASAH} · {TAHUN_AJARAN} · Semester {SEMESTER}
                </footer>
              </div>
            </div>
          </TooltipProvider>

          <Toaster position="top-right" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}