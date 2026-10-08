"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { nilaiValid, type NilaiRow } from "@/components/nilai/nilai-tipe";
import { cn } from "@/lib/utils";
import { ClipboardList, Loader2, Save, Search, X } from "lucide-react";

/** API menerima satu siswa per permintaan, jadi simpan dipecah per siswa. */
const KELOMPOK = 8;

/**
 * Isi cepat: satu mapel × seluruh siswa di kelas. Guru punya daftar skor dari
 * kertas untuk satu mata pelajaran, jadi satu kolom angka per siswa adalah
 * bentuk yang paling dekat dengan pekerjaannya. Enter/↓ turun ke siswa
 * berikutnya di kolom yang sama.
 */
export function IsiCepat({
  mapel,
  rows,
  draft,
  onUbah,
  onBuang,
  onSimpan,
}: {
  mapel: string;
  rows: NilaiRow[];
  draft: Record<number, string>;
  onUbah: (nilaiId: number, nilai: string) => void;
  /** Buang satu sel (Esc) atau seluruh draft (Batal). */
  onBuang: (nilaiId?: number) => void;
  /** Diberi daftar siswaId yang benar-benar tersimpan, supaya draft yang gagal tetap ada. */
  onSimpan: (berhasil: number[]) => void;
}) {
  const [menyimpan, setMenyimpan] = useState(false);
  const [q, setQ] = useState("");

  // Satu baris per siswa: dari "semua mapel" ke satu mapel, setiap siswa
  // punya banyak baris. Untuk isi cepat hanya yang pertama yang dipakai.
  const siswa = useMemo(() => {
    const seen = new Map<number, NilaiRow>();
    for (const r of rows) if (!seen.has(r.siswaId)) seen.set(r.siswaId, r);
    return [...seen.values()];
  }, [rows]);

  const tersaring = useMemo(() => {
    const cari = q.trim().toLowerCase();
    if (!cari) return siswa;
    return siswa.filter((s) => s.siswa.toLowerCase().includes(cari));
  }, [siswa, q]);

  const berubah = (r: NilaiRow) =>
    draft[r.nilaiId] !== undefined && draft[r.nilaiId] !== String(r.nilai_asli);

  const nilai = (r: NilaiRow) => draft[r.nilaiId] ?? String(r.nilai_asli);

  /** Enter/↓ ke baris berikutnya, ↑ ke baris sebelumnya, Esc membatalkan sel. */
  function onKey(e: React.KeyboardEvent<HTMLInputElement>, row: NilaiRow) {
    if (e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault();
      geser(e.currentTarget, 1);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      geser(e.currentTarget, -1);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      // Kembalikan sel ini ke nilai tersimpan, lalu lanjut ke bawah.
      onBuang(row.nilaiId);
      geser(e.currentTarget, 1);
    }
  }

  /** Fokus input di baris berikutnya atau sebelumnya. */
  function geser(dari: HTMLInputElement, arah: 1 | -1) {
    const baris = dari.closest("tr");
    const saudar = baris?.[arah === 1 ? "nextElementSibling" : "previousElementSibling"];
    const target = saudar?.querySelector<HTMLInputElement>("[data-sel-nilai]");
    if (!target) return;

    target.focus();
    // Pilih isi supaya mengetik langsung menimpa angka lama.
    target.select?.();
  }

  /** Kirim semua draft, dikelompokkan per siswa sesuai batas API. */
  async function simpanSemua() {
    const perSiswa = new Map<number, Array<{ id: number; nilai_asli: number }>>();
    let invalid = 0;

    for (const r of siswa) {
      if (!berubah(r)) continue;
      const v = draft[r.nilaiId];
      if (!nilaiValid(v)) {
        invalid += 1;
        continue;
      }
      const list = perSiswa.get(r.siswaId) ?? [];
      list.push({ id: r.nilaiId, nilai_asli: Number(v) });
      perSiswa.set(r.siswaId, list);
    }

    if (invalid > 0) {
      toast.error(`${invalid} isian bukan bilangan bulat 0–100 dan belum disimpan.`);
      return;
    }
    if (perSiswa.size === 0) {
      toast.info("Tidak ada perubahan.");
      return;
    }

    const pasangan = [...perSiswa.entries()];
    setMenyimpan(true);

    let tersimpan = 0;
    const berhasil: number[] = [];
    const gagal: string[] = [];

    try {
      // Beberapa siswa bisa diubah sekaligus, tapi server hanya menerima satu
      // siswa per permintaan; jalankan bertahap agar tidak membanjiri Turso.
      for (let i = 0; i < pasangan.length; i += KELOMPOK) {
        const batch = pasangan.slice(i, i + KELOMPOK);

        const hasil = await Promise.all(
          batch.map(async ([siswaId, items]) => {
            try {
              const res = await fetch("/api/nilai", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ items }),
              });
              const json = await res.json();
              if (!json.ok) throw new Error(json.error);
              return { ok: true as const, siswaId, jumlah: json.data.jumlah };
            } catch (err) {
              return {
                ok: false as const,
                siswaId,
                pesan: err instanceof Error ? err.message : "Gagal menyimpan.",
              };
            }
          })
        );

        hasil.forEach((h) => {
          if (h.ok) {
            tersimpan += h.jumlah;
            berhasil.push(h.siswaId);
          } else {
            const nama = siswa.find((s) => s.siswaId === h.siswaId)?.siswa;
            gagal.push(`${nama ?? `Siswa #${h.siswaId}`}: ${h.pesan}`);
          }
        });
      }

      if (tersimpan > 0) {
        toast.success(`${tersimpan} nilai disimpan untuk ${berhasil.length} siswa.`);
      }
      if (gagal.length > 0) {
        toast.error(`${gagal.length} siswa gagal disimpan: ${gagal.slice(0, 3).join("; ")}`, {
          duration: 8000,
        });
      }

      // Hanya draft yang benar-benar tersimpan yang dibuang; sisanya tetap
      // di layar supaya bisa langsung dicoba lagi.
      onSimpan(berhasil);
    } finally {
      setMenyimpan(false);
    }
  }

  // Ctrl/Cmd+S untuk menyimpan semua, sama seperti mode satu siswa. Handler
  // dipasang ulang tiap render supaya selalu memakai draft terkini.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!menyimpan) void simpanSemua();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const jumlahBerubah = siswa.filter(berubah).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-52 flex-1 sm:max-w-xs">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari siswa..."
            aria-label="Cari siswa"
            className="h-9 pr-8 pl-8"
          />
          {q ? (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label="Bersihkan pencarian"
              className="absolute top-1/2 right-1.5 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>

        <p className="tabular text-sm text-muted-foreground">
          {jumlahBerubah > 0 ? `${jumlahBerubah} siswa diubah` : `${siswa.length} siswa`}
        </p>
      </div>

      <div className="max-h-[min(72vh,52rem)] overflow-auto rounded-xl border bg-card shadow-card">
        <Table
          containerClassName="overflow-visible"
          className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-card [&_th]:shadow-[0_1px_0_0_var(--border)]"
        >
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12">No</TableHead>
              <TableHead className="sticky left-0 z-10 bg-card">Siswa</TableHead>
              <TableHead className="w-32 text-center">{mapel}</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {tersaring.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={3} className="p-0">
                  <EmptyState
                    icon={ClipboardList}
                    title="Tidak ada siswa"
                    description="Coba kata kunci lain atau pilih kelas berbeda."
                  />
                </TableCell>
              </TableRow>
            ) : (
              tersaring.map((row, i) => {
                const dirty = berubah(row);
                const valid = !dirty || nilaiValid(draft[row.nilaiId]);

                return (
                  <TableRow key={row.siswaId} className="h-10">
                    <TableCell className="tabular text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="sticky left-0 z-10 max-w-64 truncate bg-card font-medium">
                      {row.siswa}
                    </TableCell>
                    <TableCell className="text-center">
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={100}
                        step={1}
                        value={nilai(row)}
                        onChange={(e) => onUbah(row.nilaiId, e.target.value)}
                        onKeyDown={(e) => onKey(e, row)}
                        data-sel-nilai=""
                        aria-label={`Nilai ${mapel} ${row.siswa}`}
                        aria-invalid={!valid}
                        className={cn(
                          "tabular mx-auto h-8 w-20 text-center",
                          dirty &&
                            (valid
                              ? "border-amber-500 bg-amber-50 dark:bg-amber-500/10"
                              : "border-destructive bg-destructive/10")
                        )}
                      />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {jumlahBerubah > 0 ? (
        <div className="sticky bottom-0 z-20 -mx-4 border-t bg-card/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="tabular text-sm">
              <span className="font-semibold text-amber-600 dark:text-amber-400">
                {jumlahBerubah}
              </span>{" "}
              siswa belum disimpan
            </span>

            <div className="ml-auto flex items-center gap-2">
              <Button variant="ghost" onClick={() => onBuang()} disabled={menyimpan}>
                Batal
              </Button>
              <Button onClick={() => void simpanSemua()} disabled={menyimpan}>
                {menyimpan ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Simpan semua
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}