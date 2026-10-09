"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { PredikatBadge } from "@/components/predikat-badge";
import { StatCard } from "@/components/stat-card";
import { TableSkeleton } from "@/components/skeleton";
import { hitungRanking, rataKelas, type BarisNilai } from "@/lib/ranking";
import { BATAS_AWAL, predikat, type BatasPredikat } from "@/lib/predikat";
import { urutanMapel } from "@/lib/urutan";
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

/** Nilai khusus: tampil seluruh mapel, dasar ranking adalah rata-rata. */
const SEMUA_MAPEL = "semua";

interface Baris {
  peringkat: number;
  nama: string;
  /** Angka yang ditampilkan: nilai mapel tunggal, atau rata-rata seluruh mapel. */
  angka: number;
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

export function RankingView({
  kelasAwal,
  mapelAwal,
}: {
  kelasAwal?: string;
  mapelAwal?: string;
}) {
  const [kelas, setKelas] = useState(kelasAwal ?? "7A");
  const [mapel, setMapel] = useState(mapelAwal ?? SEMUA_MAPEL);
  const [daftarMapel, setDaftarMapel] = useState<string[]>([]);
  const [raw, setRaw] = useState<BarisNilai[]>([]);
  const [batas, setBatas] = useState<BatasPredikat>(BATAS_AWAL);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  // Daftar mapel diambil dari database supaya mapel baru ikut muncul.
  useEffect(() => {
    let batal = false;

    (async () => {
      try {
        const res = await fetch("/api/mapel");
        const json = await res.json();
        if (batal) return;
        if (json.ok) {
          setDaftarMapel(
            [...json.data.map((m: { nama: string }) => m.nama)].sort(urutanMapel)
          );
        }
      } catch {
        if (!batal) setDaftarMapel([]);
      }
    })();

    return () => {
      batal = true;
    };
  }, []);

  // Fetch di dalam effect (bukan lewat useCallback) supaya setState hanya
  // terjadi setelah `await`, tidak ada cascading render. Pola yang sama dipakai
  // nilai-view.tsx.
  useEffect(() => {
    let batal = false;

    (async () => {
      try {
        const params = new URLSearchParams({ kelas });
        if (mapel !== SEMUA_MAPEL) params.set("mapel", mapel);

        const res = await fetch(`/api/ranking?${params.toString()}`);
        const json = await res.json();
        if (batal) return;
        if (!json.ok) throw new Error(json.error);
        setRaw(json.data);
        // Batas ikut terkirim supaya predikat di layar sama dengan yang dipakai
        // server. Tanpa ini, badge diam-diam memakai batas bawaan.
        if (json.batas) setBatas(json.batas);
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
  }, [kelas, mapel]);

  // Keadaan memuat dipindah ke event handler: kalau ditaruh di dalam effect,
  // React menandainya sebagai cascading render.
  function gantiKelas(v: string) {
    setLoading(true);
    setKelas(v);
  }

  function gantiMapel(v: string) {
    setLoading(true);
    setMapel(v);
  }

  // Peringkat dihitung di klien dengan fungsi yang sama seperti di ekspor
  // Excel, jadi layar dan berkas tidak mungkin berbeda.
  const ranking = useMemo(() => hitungRanking(raw), [raw]);

  const baris = useMemo<Baris[]>(
    () => ranking.map((b) => ({ peringkat: b.peringkat, nama: b.nama, angka: b.rata })),
    [ranking]
  );

  // `ranking` sudah terurut: angka turun, jadi YANG pertama tertinggi dan yang
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

  const perMapel = mapel !== SEMUA_MAPEL;
  // Judul kolom berubah supaya tidak menyebut "rata-rata" untuk satu nilai.
  const judulAngka = perMapel ? "Nilai" : "Rata-rata";
  const predikatKelas = predikat(statistik.rata, batas);

  async function unduh() {
    setDownloading(true);
    try {
      // Ekspor selalu mengikuti pilihan mapel: mode satu mapel menghasilkan satu
      // sheet per mapel, mode seluruh mapel menghasilkan satu sheet. Yang
      // dikirim ke server adalah perMapel=1, BUKAN mapel=IPA — nama mapel tidak
      // boleh menyaring data di server, karena berkas mode ini memang berisi
      // seluruh mapel.
      const params = new URLSearchParams({ kelas });
      if (perMapel) params.set("perMapel", "1");

      const res = await fetch(`/api/export/ranking?${params.toString()}`);
      if (!res.ok) throw new Error("Gagal membuat berkas ranking.");

      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = perMapel
        ? `ranking_nilai_kelas_${kelas}_per_mapel_ASTS_GANJIL_2026-2027.xlsx`
        : `ranking_nilai_kelas_${kelas}_ASTS_GANJIL_2026-2027.xlsx`;
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

        <div className="min-w-56 sm:min-w-64">
          <Select value={mapel} onValueChange={(v) => gantiMapel(v ?? SEMUA_MAPEL)}>
            <SelectTrigger className="h-9 w-full" aria-label="Mata pelajaran">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SEMUA_MAPEL}>Rata-rata semua mapel</SelectItem>
              {daftarMapel.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

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
            label={perMapel ? `Rata-rata ${mapel}` : "Rata-rata kelas"}
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
            label={perMapel ? "Predikat kelas" : "Predikat rata-rata kelas"}
            value={predikatKelas}
            icon={TrendingDown}
            hint={`dari rata-rata ${statistik.rata}`}
          />
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border bg-card shadow-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-20 text-center">Peringkat</TableHead>
              <TableHead>Nama Siswa</TableHead>
              <TableHead className="w-32 text-center">{judulAngka}</TableHead>
              <TableHead className="w-28 text-center">Predikat</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={4} className="p-0">
                  <TableSkeleton baris={10} kolom={4} />
                </TableCell>
              </TableRow>
            ) : baris.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={4} className="p-0">
                  <EmptyState
                    icon={Trophy}
                    title="Belum ada ranking"
                    description={
                      perMapel
                        ? `Tidak ada nilai ${mapel} untuk kelas ${kelas}.`
                        : `Tidak ada nilai untuk kelas ${kelas}.`
                    }
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
                      {perMapel ? b.angka : b.angka.toFixed(1)}
                    </TableCell>

                    <TableCell className="text-center">
                      <PredikatBadge nilai={b.angka} batas={batas} />
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
          {perMapel ? (
            <>
              Ranking nilai <span className="font-medium">{mapel}</span>. Nilai sama
              mendapat peringkat sama. Memakai nilai akhir, jadi aturan dongkrak ikut
              diperhitungkan. Total {baris.length} siswa.
            </>
          ) : (
            <>
              Rata-rata dari seluruh mata pelajaran. Nilai sama mendapat peringkat
              sama; ranking memakai nilai akhir (setelah aturan dongkrak). Total{" "}
              {baris.length} siswa.
            </>
          )}
        </p>
      ) : null}
    </div>
  );
}