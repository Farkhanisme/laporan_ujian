import { PREDIKAT_CLASSES, predikat, predikatLabel, type BatasPredikat } from "@/lib/predikat";
import { cn } from "@/lib/utils";

/**
 * Badge predikat dari nilai akhir. Warna diambil dari lib/predikat supaya
 * tabel, ringkasan, dan pratinjau memakai pemetaan yang sama.
 *
 * `batas` wajib: kalau batas predikat diubah di halaman Pengaturan, badge di
 * mana pun harus ikut berubah, jadi tidak boleh ada nilai bawaan yang diam-diam
 * dipakai kalau pemanggil lupa mengoper.
 */
export function PredikatBadge({
  nilai,
  batas,
  className,
  tampilLabel = false,
}: {
  nilai: number;
  batas: BatasPredikat;
  className?: string;
  tampilLabel?: boolean;
}) {
  const p = predikat(nilai, batas);
  const label = predikatLabel(p, batas);

  return (
    <span
      title={label}
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full px-2 text-xs font-semibold ring-1 ring-inset",
        PREDIKAT_CLASSES[p],
        className
      )}
    >
      {p}
      {tampilLabel ? (
        <span className="font-normal opacity-80">{label.replace(/^[A-D] /, "")}</span>
      ) : null}
    </span>
  );
}