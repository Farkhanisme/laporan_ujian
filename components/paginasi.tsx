import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Paginasi client-side. Semua baris sudah terambil utuh oleh API, jadi cukup
 * memecah tampilan tanpa menambah permintaan jaringan.
 */
export function Paginasi({
  halaman,
  jumlahHalaman,
  total,
  perHalaman,
  onGanti,
  label = "baris",
}: {
  halaman: number;
  jumlahHalaman: number;
  total: number;
  perHalaman: number;
  onGanti: (halaman: number) => void;
  label?: string;
}) {
  if (jumlahHalaman <= 1) {
    return (
      <p className="tabular text-xs text-muted-foreground">
        {total} {label}
      </p>
    );
  }

  const dari = (halaman - 1) * perHalaman + 1;
  const sampai = Math.min(halaman * perHalaman, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="tabular text-xs text-muted-foreground">
        Menampilkan {dari}–{sampai} dari {total} {label}
      </p>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={halaman <= 1}
          onClick={() => onGanti(halaman - 1)}
        >
          <ChevronLeft className="size-4" />
          Sebelumnya
        </Button>
        <span className="tabular text-xs text-muted-foreground">
          {halaman} / {jumlahHalaman}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={halaman >= jumlahHalaman}
          onClick={() => onGanti(halaman + 1)}
        >
          Berikutnya
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}