import { PREDIKAT_CLASSES, predikat, predikatLabel } from "@/lib/predikat";
import { cn } from "@/lib/utils";

/**
 * Badge predikat dari nilai akhir. Warna diambil dari lib/predikat supaya
 * tabel, ringkasan, dan pratinjau memakai pemetaan yang sama.
 */
export function PredikatBadge({
  nilai,
  className,
  tampilLabel = false,
}: {
  nilai: number;
  className?: string;
  tampilLabel?: boolean;
}) {
  const p = predikat(nilai);

  return (
    <span
      title={predikatLabel(p)}
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full px-2 text-xs font-semibold ring-1 ring-inset",
        PREDIKAT_CLASSES[p],
        className
      )}
    >
      {p}
      {tampilLabel ? (
        <span className="font-normal opacity-80">{predikatLabel(p).replace(/^[A-D] /, "")}</span>
      ) : null}
    </span>
  );
}