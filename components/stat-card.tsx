import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Strip angka ringkas di atas tabel. Nilai diambil dari data yang sudah ada
 * di memori, jadi tidak menambah permintaan ke server.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "netral",
  hint,
  className,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: "netral" | "brand" | "peringatan";
  hint?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border bg-card px-3.5 py-3 shadow-card",
        className
      )}
    >
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-lg",
          tone === "brand" && "bg-brand-subtle text-brand",
          tone === "peringatan" && "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
          tone === "netral" && "bg-muted text-muted-foreground"
        )}
      >
        <Icon className="size-4" aria-hidden />
      </span>

      <span className="min-w-0">
        <span className="block text-xs text-muted-foreground">{label}</span>
        <span className="tabular block text-lg font-semibold leading-tight">{value}</span>
        {hint ? <span className="block truncate text-xs text-muted-foreground">{hint}</span> : null}
      </span>
    </div>
  );
}