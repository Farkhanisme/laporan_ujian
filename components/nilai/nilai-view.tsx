"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Paginasi } from "@/components/paginasi";
import { PredikatBadge } from "@/components/predikat-badge";
import { StatCard } from "@/components/stat-card";
import { TableSkeleton } from "@/components/skeleton";
import { IsiCepat } from "@/components/nilai/isi-cepat";
import { nilaiValid, type NilaiRow } from "@/components/nilai/nilai-tipe";
import { urutanMapel } from "@/lib/urutan";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ArrowRight,
  Calculator,
  ClipboardList,
  Download,
  Loader2,
  Minus,
  Save,
  Table2,
  TrendingUp,
  TriangleAlert,
  Zap,
} from "lucide-react";

const SEMUA_MAPEL = "semua";
const PER_HALAMAN = 50;

type Tampilan = "daftar" | "isi-cepat";

export function NilaiView({ mapelAwal }: { mapelAwal?: string }) {
  const [kelas, setKelas] = useState("7A");
  const [siswaId, setSiswaId] = useState<string>("semua");
  const [mapel, setMapel] = useState<string>(mapelAwal ?? SEMUA_MAPEL);
  const [rows, setRows] = useState<NilaiRow[]>([]);
  const [siswaList, setSiswaList] = useState<Array<{ id: number; nama: string }>>([]);
  const [daftarMapel, setDaftarMapel] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadingRingkasan, setDownloadingRingkasan] = useState(false);
  const [halaman, setHalaman] = useState(1);
  const [tampilan, setTampilan] = useState<Tampilan>("daftar");

  // Satu ref per input nilai supaya Enter/↑/↓ bisa memindahkan fokus tanpa
  // perlu mencari elemen lewat DOM.
  const inputRef = useRef<Map<number, HTMLElement>>(new Map());

  // Daftar siswa di kelas terpilih (untuk dropdown).
  useEffect(() => {
    let batal = false;

    (async () => {
      try {
        const res = await fetch(`/api/siswa?kelas=${kelas}`);
        const json = await res.json();
        if (batal) return;
        setSiswaList(json.ok ? json.data : []);
      } catch {
        if (!batal) setSiswaList([]);
      }
    })();

    return () => {
      batal = true;
    };
  }, [kelas]);

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

  // Menyusun parameter query dari filter yang aktif.
  const buildParams = useCallback(() => {
    const params = new URLSearchParams({ kelas });
    if (siswaId !== "semua") params.set("siswaId", siswaId);
    if (mapel !== SEMUA_MAPEL) params.set("mapel", mapel);
    return params;
  }, [kelas, siswaId, mapel]);

  // Memuat nilai. Seluruh setState terjadi setelah `await`, jadi tidak ada
  // cascading render dari dalam effect.
  useEffect(() => {
    let batal = false;

    (async () => {
      try {
        const res = await fetch(`/api/nilai?${buildParams().toString()}`);
        const json = await res.json();
        if (batal) return;

        if (!json.ok) throw new Error(json.error);
        setRows(json.data);
        setError(null);
      } catch (err) {
        if (batal) return;
        setError(err instanceof Error ? err.message : "Gagal memuat nilai.");
        setRows([]);
      } finally {
        if (!batal) setLoading(false);
      }
    })();

    return () => {
      batal = true;
    };
  }, [buildParams]);

  // Dipanggil setelah simpan (bukan dari dalam effect).
  const muatUlang = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/nilai?${buildParams().toString()}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setRows(json.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat nilai.");
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  // Ganti kelas → kembali ke mode semua siswa dan buang draft.
  function gantiKelas(v: string) {
    setKelas(v);
    setSiswaId("semua");
    setDraft({});
    setHalaman(1);
  }

  function pilihSiswa(v: string) {
    setSiswaId(v);
    setDraft({});
    setHalaman(1);
  }

  // Ganti mapel → buang draft yang belum disimpan.
  function pilihMapel(v: string) {
    setMapel(v ?? SEMUA_MAPEL);
    setDraft({});
    setHalaman(1);
  }

  /** Tulis satu nilai ke draft; isian kosong berarti kembalikan ke server. */
  function ubahNilai(nilaiId: number, nilai: string) {
    setDraft((d) => {
      const next = { ...d };
      if (nilai.trim() === "") delete next[nilaiId];
      else next[nilaiId] = nilai;
      return next;
    });
  }

  /** Buang satu sel, atau seluruh draft bila tanpa argumen. */
  function buangDraft(nilaiId?: number) {
    if (nilaiId === undefined) {
      setDraft({});
      return;
    }
    setDraft((d) => {
      if (!(nilaiId in d)) return d;
      const next = { ...d };
      delete next[nilaiId];
      return next;
    });
  }

  const modeSiswaTunggal = siswaId !== "semua";

  // Isi cepat butuh tepat satu mapel: tanpa itu tidak ada satu kolom angka
  // yang bisa diisi berurutan seperti daftar skor.
  const bisaIsiCepat = mapel !== SEMUA_MAPEL;

  // Mengganti kelas/siswa/mapel selalu menutup mode isi cepat supaya tidak
  // tertinggal menunjuk data yang sudah tidak tampil.
  const tampilIsiCepat = !modeSiswaTunggal && bisaIsiCepat && tampilan === "isi-cepat";

  const siswaSaatIni = useMemo(
    () => siswaList.find((s) => String(s.id) === siswaId)?.nama,
    [siswaList, siswaId]
  );

  const jumlahDiubah = Object.keys(draft).length;

  const statistik = useMemo(() => {
    let total = 0;
    let jumlahNilai = 0;
    let jumlahDongkrak = 0;
    let jumlahNol = 0;

    for (const r of rows) {
      total += r.nilai_akhir;
      jumlahNilai += 1;
      if (r.nilai_dongkrak !== null) jumlahDongkrak += 1;
      if (r.nilai_akhir === 0) jumlahNol += 1;
    }

    return {
      jumlah: jumlahNilai,
      rata: jumlahNilai === 0 ? 0 : Math.round((total / jumlahNilai) * 10) / 10,
      dongkrak: jumlahDongkrak,
      nol: jumlahNol,
    };
  }, [rows]);

  // Baris yang sedang tampil di halaman ini. Mode satu siswa tidak perlu
  // paginasi: maksimal satu baris per mapel.
  const barisTampil = useMemo(() => {
    if (modeSiswaTunggal) return rows;
    const mulai = (halaman - 1) * PER_HALAMAN;
    return rows.slice(mulai, mulai + PER_HALAMAN);
  }, [rows, halaman, modeSiswaTunggal]);

  const jumlahHalaman = Math.max(1, Math.ceil(rows.length / PER_HALAMAN));

  function nilaiDraft(row: NilaiRow): string {
    return draft[row.nilaiId] ?? String(row.nilai_asli);
  }

  const sudahBerubah = (row: NilaiRow) =>
    draft[row.nilaiId] !== undefined && draft[row.nilaiId] !== String(row.nilai_asli);

  /** Pindah fokus ke input nilai pada indeks relatif (dalam mode edit). */
  function geserFokus(dari: number, arah: 1 | -1) {
    const urutan = rows.map((r) => r.nilaiId);
    const target = urutan[dari + arah];
    if (target === undefined) return;

    const el = inputRef.current.get(target);
    if (!el) return;
    el.focus();
    // Pilih isi supaya mengetik langsung menimpa angka lama.
    (el as HTMLInputElement).select?.();
  }

  function onKeyInput(e: React.KeyboardEvent<HTMLInputElement>, index: number, row: NilaiRow) {
    if (e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault();
      geserFokus(index, 1);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      geserFokus(index, -1);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      // Buang perubahan sel ini saja; draft lain tetap aman.
      buangDraft(row.nilaiId);
      geserFokus(index, 1);
    }
  }

  const simpan = useCallback(async () => {
    const items = Object.entries(draft).map(([id, value]) => ({
      id: Number(id),
      siswa_id: Number(siswaId),
      nilai_asli: Number(value),
    }));

    if (items.length === 0) {
      toast.info("Tidak ada perubahan.");
      return;
    }

    const tidakValid = items.find((i) => !nilaiValid(String(i.nilai_asli)));
    if (tidakValid) {
      toast.error("Nilai harus bilangan bulat 0–100.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/nilai", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);

      if (json.data.ditolak > 0) {
        toast.error(`${json.data.ditolak} baris tidak cocok dengan siswa ini dan tidak disimpan.`);
      }
      if (json.data.jumlah > 0) {
        toast.success(`${json.data.jumlah} nilai disimpan.`);
      }
      setDraft({});
      await muatUlang();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan nilai.");
    } finally {
      setSaving(false);
    }
  }, [draft, siswaId, muatUlang]);

  // Ctrl/Cmd+S menyimpan, selama ada draft dan belum sedang menyimpan.
  useEffect(() => {
    if (jumlahDiubah === 0) return;

    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!saving) void simpan();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [jumlahDiubah, saving, simpan]);

  async function unduhSemua() {
    setDownloading(true);
    try {
      const res = await fetch("/api/export/semua");
      if (!res.ok) throw new Error("Gagal membuat file.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "nilai_semua_siswa_ASTS_GANJIL_2026-2027.xlsx";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("File nilai berhasil diunduh.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengunduh.");
    } finally {
      setDownloading(false);
    }
  }

  async function unduhRingkasan() {
    setDownloadingRingkasan(true);
    try {
      const res = await fetch("/api/export/ringkasan");
      if (!res.ok) throw new Error("Gagal membuat file.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "ringkasan_nilai_ASTS_GANJIL_2026-2027.xlsx";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Ringkasan nilai berhasil diunduh.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengunduh.");
    } finally {
      setDownloadingRingkasan(false);
    }
  }

  const kolom = modeSiswaTunggal ? 5 : 6;

  return (
    <div className="space-y-4">
      {/* Filter utama: kelas berupa tab supaya tidak perlu membuka dropdown. */}
      <div className="flex flex-wrap items-center gap-3">
        <KelasTabs value={kelas} onChange={gantiKelas} />

        <div className="min-w-56 flex-1 sm:max-w-xs">
          <Select value={mapel} onValueChange={(v) => pilihMapel(v ?? SEMUA_MAPEL)}>
            <SelectTrigger className="h-9 w-full" aria-label="Mata pelajaran">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SEMUA_MAPEL}>Semua mata pelajaran</SelectItem>
              {daftarMapel.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-56 flex-1 sm:max-w-xs">
          <Select value={siswaId} onValueChange={(v) => pilihSiswa(v ?? "semua")}>
            <SelectTrigger className="h-9 w-full" aria-label="Siswa">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="semua">Semua siswa di kelas</SelectItem>
              {siswaList.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.nama}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {modeSiswaTunggal ? (
            <a
              href={`/api/export/raport/${siswaId}`}
              className={buttonVariants({ variant: "outline" })}
            >
              <Download className="size-4" />
              Unduh Raport
            </a>
          ) : (
            <div
              role="group"
              aria-label="Tampilan tabel"
              className="flex items-center gap-0.5 rounded-lg border bg-card p-0.5 shadow-card"
            >
              <button
                type="button"
                onClick={() => setTampilan("daftar")}
                aria-pressed={tampilan === "daftar"}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  tampilan === "daftar"
                    ? "bg-brand text-brand-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Table2 className="size-4" />
                Daftar
              </button>
              <button
                type="button"
                // Isi cepat butuh satu mapel terpilih; tombol nonaktif biasanya
                // membingungkan, jadi beri alasan di title.
                disabled={!bisaIsiCepat}
                title={
                  bisaIsiCepat
                    ? "Isi satu mapel untuk seluruh siswa di kelas"
                    : "Pilih satu mata pelajaran terlebih dahulu"
                }
                onClick={() => setTampilan("isi-cepat")}
                aria-pressed={tampilan === "isi-cepat"}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40",
                  tampilan === "isi-cepat"
                    ? "bg-brand text-brand-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Zap className="size-4" />
                Isi cepat
              </button>
            </div>
          )}

          <Button variant="outline" onClick={unduhRingkasan} disabled={downloadingRingkasan}>
            {downloadingRingkasan ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ClipboardList className="size-4" />
            )}
            Unduh Ringkasan
          </Button>

          <Button variant="outline" onClick={unduhSemua} disabled={downloading}>
            {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            Unduh Semua Nilai
          </Button>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <TriangleAlert className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {/* Ringkasan angka untuk hasil filter saat ini. */}
      {!loading && rows.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label={modeSiswaTunggal ? "Mata pelajaran" : "Nilai ditampilkan"}
            value={String(statistik.jumlah)}
            icon={ClipboardList}
          />
          <StatCard
            label="Rata-rata nilai akhir"
            value={String(statistik.rata)}
            icon={Calculator}
            tone="brand"
          />
          <StatCard
            label="Nilai ter-dongkrak"
            value={String(statistik.dongkrak)}
            icon={TrendingUp}
            tone={statistik.dongkrak > 0 ? "peringatan" : "netral"}
          />
          <StatCard
            label="Bernilai 0"
            value={String(statistik.nol)}
            icon={TriangleAlert}
            tone={statistik.nol > 0 ? "peringatan" : "netral"}
            hint={statistik.nol > 0 ? "Termasuk rentang dongkrak" : undefined}
          />
        </div>
      ) : null}

      {/* Mode edit punya konteks sendiri: kembali ke daftar dan nama siswa. */}
      {modeSiswaTunggal ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-3.5 py-2.5 shadow-card">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">
              Kelas {kelas} <ArrowRight className="mx-1 inline size-3" aria-hidden />
              <span className="font-medium text-foreground">{siswaSaatIni ?? "Siswa"}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Ubah nilai asli. Tekan <Kbd>Enter</Kbd> untuk ke mapel berikutnya,{" "}
              <Kbd>Esc</Kbd> untuk membatalkan satu sel.
            </p>
          </div>

          <Button variant="ghost" size="sm" onClick={() => pilihSiswa("semua")}>
            <ArrowLeft className="size-4" />
            Kembali ke daftar
          </Button>
        </div>
      ) : null}

      {tampilIsiCepat ? (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-brand-subtle/40 px-3.5 py-2.5">
            <Zap className="size-4 shrink-0 text-brand" aria-hidden />
            <p className="min-w-0 text-sm">
              Isi cepat untuk <span className="font-medium">{mapel}</span>. Tekan{" "}
              <Kbd>Enter</Kbd> untuk ke siswa berikutnya, <Kbd>↑</Kbd> untuk kembali,{" "}
              <Kbd>Esc</Kbd> untuk membatalkan satu sel.
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() => setTampilan("daftar")}
            >
              <Table2 className="size-4" />
              Kembali ke daftar
            </Button>
          </div>

          <IsiCepat
            mapel={mapel}
            rows={rows}
            draft={draft}
            onUbah={ubahNilai}
            onBuang={buangDraft}
            onSimpan={(berhasil) => {
              // Buang hanya draft siswa yang benar-benar tersimpan; yang gagal
              // tetap muncul supaya bisa diperbaiki tanpa mengetik ulang.
              if (berhasil.length > 0) {
                const tersimpan = new Set(berhasil);
                setDraft((d) => {
                  const next = { ...d };
                  for (const r of rows) {
                    if (tersimpan.has(r.siswaId)) delete next[r.nilaiId];
                  }
                  return next;
                });
              }
              void muatUlang();
            }}
          />
        </>
      ) : (
        <>
      {/* Wadah scroll sendiri dengan tinggi maksimum: header lengket ikut
          berfungsi karena `th` menempel pada area scroll ini, bukan halaman.
          `containerClassName` menonaktifkan wrapper scroll milik Table. */}
      <div className="max-h-[min(72vh,52rem)] overflow-auto rounded-xl border bg-card shadow-card">
        <Table
          containerClassName="overflow-visible"
          className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-card [&_th]:shadow-[0_1px_0_0_var(--border)]"
        >
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {!modeSiswaTunggal ? <TableHead className="w-56">Siswa</TableHead> : null}
              <TableHead>Nama Mapel</TableHead>
              <TableHead className="w-28 text-center">Nilai Asli</TableHead>
              <TableHead className="w-36 text-center">Nilai Dongkrak</TableHead>
              <TableHead className="w-28 text-center">Nilai Akhir</TableHead>
              {!modeSiswaTunggal ? <TableHead className="w-32 text-right">Aksi</TableHead> : null}
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={kolom} className="p-0">
                  <TableSkeleton baris={8} kolom={modeSiswaTunggal ? 4 : 5} />
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={kolom} className="p-0">
                  <EmptyState
                    icon={ClipboardList}
                    title="Belum ada nilai"
                    description={
                      modeSiswaTunggal
                        ? "Siswa ini belum punya baris nilai untuk mapel yang dipilih."
                        : "Tidak ada nilai untuk kelas dan mata pelajaran ini."
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              barisTampil.map((row, index) => {
                const berubah = sudahBerubah(row);
                const naik = row.nilai_akhir > row.nilai_asli;
                const turun = row.nilai_akhir < row.nilai_asli;

                return (
                  <TableRow key={row.nilaiId} className="h-9">
                    {!modeSiswaTunggal ? (
                      <TableCell className="max-w-56 truncate font-medium">{row.siswa}</TableCell>
                    ) : null}

                    <TableCell className="max-w-64 truncate">{row.mapel}</TableCell>

                    <TableCell className="text-center">
                      {modeSiswaTunggal ? (
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={100}
                          step={1}
                          value={nilaiDraft(row)}
                          onChange={(e) => ubahNilai(row.nilaiId, e.target.value)}
                          onKeyDown={(e) => onKeyInput(e, index, row)}
                          ref={(el) => {
                            if (el) inputRef.current.set(row.nilaiId, el);
                            else inputRef.current.delete(row.nilaiId);
                          }}
                          aria-label={`Nilai asli ${row.mapel}`}
                          className={`tabular mx-auto h-8 w-20 text-center ${
                            berubah ? "border-amber-500 bg-amber-50 dark:bg-amber-500/10" : ""
                          }`}
                        />
                      ) : (
                        <span className="tabular">{row.nilai_asli}</span>
                      )}
                    </TableCell>

                    <TableCell className="text-center">
                      {row.nilai_dongkrak !== null ? (
                        <span className="tabular inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-500/15 dark:text-amber-300">
                          {naik ? (
                            <ArrowRight className="size-3" aria-hidden />
                          ) : turun ? (
                            <Minus className="size-3" aria-hidden />
                          ) : null}
                          {row.nilai_asli} &rarr; {row.nilai_dongkrak}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">&mdash;</span>
                      )}
                    </TableCell>

                    <TableCell className="text-center">
                      <span className="tabular mr-2 font-medium">{row.nilai_akhir}</span>
                      <PredikatBadge nilai={row.nilai_akhir} />
                    </TableCell>

                    {!modeSiswaTunggal ? (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => pilihSiswa(String(row.siswaId))}
                        >
                          Edit nilai
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {!loading && rows.length > 0 ? (
        modeSiswaTunggal ? (
          <p className="text-xs text-muted-foreground">
            {rows.length} mapel ditampilkan
            {mapel !== SEMUA_MAPEL ? ` (filter: ${mapel})` : ""}. Nilai dongkrak dihitung
            otomatis dari aturan yang berlaku.
          </p>
        ) : (
          <Paginasi
            halaman={halaman}
            jumlahHalaman={jumlahHalaman}
            total={rows.length}
            perHalaman={PER_HALAMAN}
            onGanti={setHalaman}
            label="nilai"
          />
        )
      ) : null}
        </>
      )}

      {/* Dock simpan milik mode satu siswa. Mode isi cepat punya docknya
          sendiri di dalam komponennya. */}
      {jumlahDiubah > 0 && modeSiswaTunggal ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-4">
          <div className="pointer-events-auto flex flex-wrap items-center gap-3 rounded-xl border bg-card px-3 py-2 shadow-dock">
            <span className="tabular text-sm">
              <span className="font-semibold text-amber-600 dark:text-amber-400">
                {jumlahDiubah}
              </span>{" "}
              nilai belum disimpan
            </span>

            <Button variant="ghost" onClick={() => buangDraft()} disabled={saving}>
              Batal
            </Button>

            <Button onClick={() => void simpan()} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Simpan
              <Kbd className="ml-1">Ctrl S</Kbd>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={`rounded border bg-muted px-1 py-px font-sans text-[0.65rem] font-medium text-muted-foreground ${className ?? ""}`}
    >
      {children}
    </kbd>
  );
}