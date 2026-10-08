"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { TableSkeleton } from "@/components/skeleton";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  Pencil,
  Search,
  UserRoundX,
  X,
} from "lucide-react";

const PER_HALAMAN = 25;

type KolomSort = "nama" | "kelas" | "nis" | "nisn";
type ArahSort = "naik" | "turun";

interface Siswa {
  id: number;
  nama: string;
  kelas: string;
  nis: string | null;
  nisn: string | null;
}

export function SiswaTable() {
  const [siswa, setSiswa] = useState<Siswa[]>([]);
  const [kelas, setKelas] = useState<string>("semua");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [halaman, setHalaman] = useState(1);
  const [sort, setSort] = useState<{ kolom: KolomSort; arah: ArahSort }>({
    kolom: "nama",
    arah: "naik",
  });

  const muat = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (kelas !== "semua") params.set("kelas", kelas);
      if (q.trim()) params.set("q", q.trim());

      const res = await fetch(`/api/siswa?${params.toString()}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setSiswa(json.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal memuat data.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [kelas, q]);

  useEffect(() => {
    const timer = setTimeout(muat, q ? 250 : 0);
    return () => clearTimeout(timer);
  }, [muat, q]);

  const belumTerisi = useMemo(
    () => siswa.filter((s) => !s.nis || !s.nisn).length,
    [siswa]
  );

  // Server sudah mengurutkan dengan urutan yang benar; pengurutan tambahan di
  // sini hanya mengubah urutan tampilan, bukan isi.
  const terurut = useMemo(() => {
    const arah = sort.arah === "naik" ? 1 : -1;
    const nilai = (s: Siswa): string => s[sort.kolom] ?? "";

    return [...siswa].sort((a, b) => {
      const va = nilai(a);
      const vb = nilai(b);
      // Kolom kosong selalu ditaruh terakhir, apa pun arahnya.
      if (!va && vb) return 1;
      if (va && !vb) return -1;
      return va.localeCompare(vb, undefined, { sensitivity: "base", numeric: true }) * arah;
    });
  }, [siswa, sort]);

  const barisTampil = useMemo(() => {
    const mulai = (halaman - 1) * PER_HALAMAN;
    return terurut.slice(mulai, mulai + PER_HALAMAN);
  }, [terurut, halaman]);

  const jumlahHalaman = Math.max(1, Math.ceil(terurut.length / PER_HALAMAN));

  // Filter atau pencarian berubah → kembali ke halaman pertama, supaya tidak
  // terjebak di halaman yang sekarang kosong.
  function gantiKelas(v: string) {
    setKelas(v);
    setHalaman(1);
  }

  function gantiCari(v: string) {
    setQ(v);
    setHalaman(1);
  }

  /** Klik thrice: naik → turun → kembali ke bawaan (nama, naik). */
  function urutkan(kolom: KolomSort) {
    setSort((s) => {
      if (s.kolom !== kolom) return { kolom, arah: "naik" };
      if (s.arah === "naik") return { kolom, arah: "turun" };
      return { kolom: "nama", arah: "naik" };
    });
    setHalaman(1);
  }

  function ikonSort(kolom: KolomSort) {
    if (sort.kolom !== kolom) return <ArrowUpDown className="size-3" aria-hidden />;
    return sort.arah === "naik" ? (
      <ArrowUp className="size-3" aria-hidden />
    ) : (
      <ArrowDown className="size-3" aria-hidden />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <KelasTabs value={kelas} onChange={gantiKelas} allowSemua />

        <div className="relative min-w-52 flex-1 sm:max-w-xs">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={q}
            onChange={(e) => gantiCari(e.target.value)}
            placeholder="Cari nama siswa..."
            aria-label="Cari nama siswa"
            className="h-9 pr-8 pl-8"
          />
          {q ? (
            <button
              type="button"
              onClick={() => gantiCari("")}
              aria-label="Bersihkan pencarian"
              className="absolute top-1/2 right-1.5 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>

        <p className="tabular ml-auto text-sm text-muted-foreground">
          {loading ? "Memuat..." : `${terurut.length} siswa`}
        </p>
      </div>

      {belumTerisi > 0 ? (
        <Alert>
          <UserRoundX className="size-4 text-amber-600 dark:text-amber-400" />
          <AlertDescription>
            {belumTerisi} siswa belum punya NIS/NISN lengkap. Buka halaman Edit siswa untuk
            melengkapinya.
          </AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="max-h-[min(72vh,52rem)] overflow-auto rounded-xl border bg-card shadow-card">
        <Table
          containerClassName="overflow-visible"
          className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-card [&_th]:shadow-[0_1px_0_0_var(--border)]"
        >
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12">No</TableHead>
              <TableHead>
                <SortButton label="Nama" kolom="nama" urutkan={urutkan} ikon={ikonSort} />
              </TableHead>
              <TableHead className="w-24">
                <SortButton label="Kelas" kolom="kelas" urutkan={urutkan} ikon={ikonSort} />
              </TableHead>
              <TableHead className="w-40">
                <SortButton label="NIS" kolom="nis" urutkan={urutkan} ikon={ikonSort} />
              </TableHead>
              <TableHead className="w-44">
                <SortButton label="NISN" kolom="nisn" urutkan={urutkan} ikon={ikonSort} />
              </TableHead>
              <TableHead className="w-32 text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="p-0">
                  <TableSkeleton baris={8} kolom={5} />
                </TableCell>
              </TableRow>
            ) : terurut.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="p-0">
                  <EmptyState
                    icon={UserRoundX}
                    title="Tidak ada siswa yang cocok"
                    description="Coba kata kunci lain atau pilih kelas yang berbeda."
                  />
                </TableCell>
              </TableRow>
            ) : (
              barisTampil.map((s, i) => (
                <TableRow key={s.id} className="h-10">
                  <TableCell className="tabular text-muted-foreground">
                    {(halaman - 1) * PER_HALAMAN + i + 1}
                  </TableCell>
                  <TableCell className="max-w-72 truncate font-medium">{s.nama}</TableCell>
                  <TableCell>
                    <span className="tabular rounded-md bg-muted px-1.5 py-0.5 text-xs">
                      {s.kelas}
                    </span>
                  </TableCell>
                  <TableCell className="tabular text-muted-foreground">{s.nis || "—"}</TableCell>
                  <TableCell className="tabular text-muted-foreground">{s.nisn || "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {/* Elemen tautan asli, bukan Base UI Button: membuka tab
                          baru dengan ctrl+klik tetap bekerja seperti seharusnya. */}
                      <a
                        href={`/api/export/raport/${s.id}`}
                        title={`Unduh raport ${s.nama}`}
                        className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                      >
                        <Download className="size-4" />
                        <span className="sr-only">Unduh raport {s.nama}</span>
                      </a>
                      <Link
                        href={`/siswa/${s.id}`}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        <Pencil className="size-4" />
                        Edit
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {!loading && terurut.length > 0 ? (
        <Paginasi
          halaman={halaman}
          jumlahHalaman={jumlahHalaman}
          total={terurut.length}
          perHalaman={PER_HALAMAN}
          onGanti={setHalaman}
          label="siswa"
        />
      ) : null}
    </div>
  );
}

function SortButton({
  label,
  kolom,
  urutkan,
  ikon,
}: {
  label: string;
  kolom: KolomSort;
  urutkan: (k: KolomSort) => void;
  ikon: (k: KolomSort) => React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => urutkan(kolom)}
      className="-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 font-medium transition-colors hover:bg-muted hover:text-foreground"
    >
      {label}
      {ikon(kolom)}
    </button>
  );
}