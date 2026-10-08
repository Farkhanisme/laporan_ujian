"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, navAktif } from "@/lib/nav";
import { NAMA_MADRASAH, SEMESTER, TAHUN_AJARAN } from "@/lib/config";
import { cn } from "@/lib/utils";

export function BrandMark({ ringkas = false }: { ringkas?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden
        className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand text-sm font-bold text-brand-foreground shadow-sm"
      >
        RA
      </span>
      {!ringkas ? (
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold leading-tight">Raport ASTS</span>
          <span className="block truncate text-xs text-muted-foreground">{NAMA_MADRASAH}</span>
        </span>
      ) : null}
    </div>
  );
}

export function AppSidebar({ onNavigasi }: { onNavigasi?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col gap-4 bg-sidebar p-4">
      <Link
        href="/nilai"
        onClick={onNavigasi}
        className="rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <BrandMark />
      </Link>

      <nav aria-label="Menu utama" className="flex-1">
        <ul className="flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => {
            const aktif = navAktif(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigasi}
                  aria-current={aktif ? "page" : undefined}
                  className={cn(
                    "relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                    // Batang aksen kiri menandai menu aktif tanpa asal memblokir
                    // area klik item.
                    "before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:transition-colors",
                    aktif
                      ? "bg-sidebar-accent text-sidebar-accent-foreground before:bg-sidebar-primary"
                      : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground before:bg-transparent"
                  )}
                >
                  <item.icon className="size-4 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <p className="border-t border-sidebar-border pt-3 text-xs text-muted-foreground">
        {TAHUN_AJARAN} · Semester {SEMESTER}
      </p>
    </div>
  );
}