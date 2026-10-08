"use client";

import { KELAS } from "@/lib/kelas";
import { cn } from "@/lib/utils";

/**
 * Pemilih kelas sebagai tab, bukan dropdown: guru pindah kelas puluhan kali
 * dalam satu sesi, dan tab membuat itu satu klik.
 */
export function KelasTabs({
  value,
  onChange,
  allowSemua = false,
  className,
}: {
  value: string;
  onChange: (kelas: string) => void;
  /** Tampilkan tab "Semua" di depan daftar kelas (default false). */
  allowSemua?: boolean;
  className?: string;
}) {
  const pilihan = allowSemua ? ["semua", ...KELAS] : KELAS;

  return (
    <div
      role="tablist"
      aria-label="Pilih kelas"
      className={cn(
        "flex flex-wrap items-center gap-0.5 rounded-xl border bg-card p-1 shadow-card",
        className
      )}
    >
      {pilihan.map((k) => {
        const aktif = value === k;
        return (
          <button
            key={k}
            role="tab"
            type="button"
            aria-selected={aktif}
            onClick={() => onChange(k)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              aktif
                ? "bg-brand text-brand-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {k === "semua" ? "Semua" : k}
          </button>
        );
      })}
    </div>
  );
}