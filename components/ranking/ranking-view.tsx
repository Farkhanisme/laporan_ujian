"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EmptyState } from "@/components/empty-state";
import { KelasTabs } from "@/components/kelas-tabs";
import { StatCard } from "@/components/stat-card";
import { TableSkeleton } from "@/components/skeleton";
import { hitungRanking, rataKelas, type BarisNilai } from "@/lib/ranking";
import {
  ChevronDown,
  ChevronUp,
  Download,
  Loader2,
  Minus,
  Trophy,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

interface Baris {
  peringkat: number;
  nama: string;
  rata: number;
}

/**
 * Peringkat 1-3 diberi warna piala; seri diikat dengan warna yang sama supaya
 * mata langsung menangkap "keduanya peringkat 2" tanpa membaca angka.
 */
function gayaPeringkat(peringkat: number): string {
  if (peringkat === 1) return "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300";
  if (peringkat === 2) return "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300";
  if (peringkat === 3) return "bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300";
  return "bg-muted text-muted-foreground";
}

export function RankingView({ kelasAwal }: { kelasAwal?: string }) {
  const [kelas, setKelas] = useState(kelasAwal ?? "7A");
  const [raw, setRaw] = useState<BarisNilai[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  // Fetch di dalam effect (bukan lewat useCallback) supaya setState hanya
  // terjadi setelah `await`, tidak ada cascading render. Pola yang sama dipakai
  // nilai-view.tsx.
  useEffect(() => {
    let batal = false;

    (async () => {
      try {
        const res = await fetch(`/api/ranking?kelas=${encodeURIComponent(kelas)}`);
        const json = await res.json();
        if (batal) return;
        if (!json.ok) throw new Error(json.error);
        setRaw(json.data);
        setError(null);
      } catch (err) {
        if (batal) return;
        setError(err instanceof Error ? err.message : "Gagal memuat ranking.");
        setRaw([]);
      } finally {
        if (!batal) setLoading(false);
      }
    })();

    return () => {
      batal = true;
    };
  }, [kelas]);

  function gantiKelas(v: string) {
    // Keadaan memuat di sini, di luar effect: dipanggil dari event handler,
    // jadi React tidak melihat setState sinkron di dalam body effect.
    setLoading(true);
    setKelas(v);
  }

  // Peringkat dihitung di klien dengan fungsi yang sama seperti di ekspor
  // Excel, jadi layar dan berkas tidak mungkin berbeda.
  const ranking = useMemo(() => hitungRanking(raw), [raw]);

  const baris = useMemo<Baris[]>(
    () => ranking.map((b) => ({ peringkat: b.peringkat, nama: b.nama, rata: b.rata })),
    [ranking]
  );

  // `baris` sudah terurut:rating turun, jadi YANG pertama tertinggi dan yang
  // terakhir terendah.
  const statistik = useMemo(() => {
    if (ranking.length === 0) {
      return { tertinggi: 0, terendah: 0, rata: 0 };
    }
    return {
      tertinggi: ranking[0].rata,
      terendah: ranking[ranking.length - 1].rata,
      rata: rataKelas(ranking),
    };
  }, [ranking]);

  async function unduh() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/export/ranking?kelas=${encodeURIComponent(kelas)}`);
      if (!res.ok) throw new Error("Gagal membuat berkas ranking.");

      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `ranking_nilai_kelas_${kelas}_ASTS_GANJIL_2026-2027.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Lepaskan object URL setelah unduhan dimulai, kalau tidak halaman
      // menahan blob di memori sampai tab ditutup.
      URL.revokeObjectURL(a.href);
      toast.success(`Ranking kelas ${kelas} berhasil diunduh.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengunduh ranking.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <KelasTabs value={kelas} onChange={gantiKelas} />

        <Button
          variant="outline"
          className="ml-auto"
          onClick={unduh}
          disabled={downloading || loading || baris.length === 0}
        >
          {downloading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          Unduh Ranking
        </Button>
      </div>

      {error ? (
        <Alert variant="destructive">
          <Minus className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {!loading && baris.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Siswa di ranking"
            value={String(baris.length)}
            icon={Trophy}
            tone="brand"
          />
          <StatCard
            label="Rata-rata kelas"
            value={String(statistik.rata)}
            icon={Trophy}
          />
          <StatCard
            label="Tertinggi"
            value={String(statistik.tertinggi)}
            icon={TrendingUp}
            tone="brand"
            hint={baris[0].nama}
          />
          <StatCard
            label="Terendah"
            value={String(statistik.terendah)}
            icon={TrendingDown}
            hint={baris[baris.length - 1].nama}
          />
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border bg-card shadow-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-20 text-center">Peringkat</TableHead>
              <TableHead>Nama Siswa</TableHead>
              <TableHead className="w-32 text-center">Rata-rata</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={3} className="p-0">
                  <TableSkeleton baris={10} kolom={3} />
                </TableCell>
              </TableRow>
            ) : baris.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={3} className="p-0">
                  <EmptyState
                    icon={Trophy}
                    title="Belum ada ranking"
                    description={`Tidak ada nilai untuk kelas ${kelas}.`}
                  />
                </TableCell>
              </TableRow>
            ) : (
              baris.map((b) => {
                const juara = b.peringkat <= 3;

                return (
                  <TableRow key={b.nama} className="h-10">
                    <TableCell className="text-center">
                      <span
                        className={`tabular inline-flex h-6 min-w-7 items-center justify-center rounded-full px-2 text-xs font-semibold ring-1 ring-inset ${
                          juara ? `ring-black/5 ${gayaPeringkat(b.peringkat)}` : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {juara ? (
                          <ChevronUp className="mr-0.5 size-3" aria-hidden />
                        ) : (
                          <ChevronDown className="mr-0.5 size-3" aria-hidden />
                        )}
                        {b.peringkat}
                      </span>
                    </TableCell>

                    <TableCell className="max-w-96 truncate font-medium">
                      {b.nama}
                    </TableCell>

                    <TableCell className="tabular text-center text-base">
                      {b.rata.toFixed(1)}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {!loading && baris.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          Rata-rata dari seluruh mata pelajaran. Nilai sama mendapat peringkat sama;
          ranking memakai nilai akhir (setelah aturan dongkrak). Total {baris.length} siswa.
        </p>
      ) : null}
    </div>
  );
}