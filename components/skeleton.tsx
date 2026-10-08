import { cn } from "@/lib/utils";

/** Placeholder saat memuat. Dipakai tabel dan kartu, bukan spinner telanjang. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-md bg-muted", className)}
    />
  );
}

/** N baris kosong untuk menahan tinggi tabel agar tidak melompat saat memuat. */
export function TableSkeleton({
  baris = 8,
  kolom = 5,
}: {
  baris?: number;
  kolom?: number;
}) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: baris }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          {Array.from({ length: kolom }, (_, j) => (
            <Skeleton
              key={j}
              className={cn("h-4", j === 0 ? "w-40" : j === kolom - 1 ? "ml-auto w-16" : "w-20")}
            />
          ))}
        </div>
      ))}
    </div>
  );
}