"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { TableSkeleton } from "@/components/skeleton";
import { BookOpenText, Info, Loader2, Pencil, Plus, Search, X } from "lucide-react";

interface MapelGrup {
  nama: string;
  kode: string;
  tingkat: number[];
  jumlahNilai: number;
}

const TOTAL_TINGKAT = 3;

export function MapelView() {
  const [data, setData] = useState<MapelGrup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const [nama, setNama] = useState("");
  const [kode, setKode] = useState("");
  const [menyimpan, setMenyimpan] = useState(false);

  const muat = useCallback(async () => {
    try {
      const res = await fetch("/api/mapel");
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setData(json.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat mapel.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await muat();
    })();
  }, [muat]);

  const tersaring = useMemo(() => {
    const cari = q.trim().toLowerCase();
    if (!cari) return data;
    return data.filter(
      (m) => m.nama.toLowerCase().includes(cari) || m.kode.toLowerCase().includes(cari)
    );
  }, [data, q]);

  async function tambah(e: React.FormEvent) {
    e.preventDefault();
    setMenyimpan(true);
    try {
      const res = await fetch("/api/mapel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nama, kode }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);

      toast.success(
        `${json.data.nama} ditambahkan: ${json.data.mapelDitambah} baris mapel, ${json.data.nilaiDitambah} nilai (semua 0).`
      );
      setNama("");
      setKode("");
      await muat();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menambah mapel.");
    } finally {
      setMenyimpan(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-start">
      <Card>
        <CardHeader>
          <CardTitle>Tambah mata pelajaran</CardTitle>
          <CardDescription>
            Berlaku untuk tingkat 7, 8, dan 9. Nilai awal diisi 0 untuk setiap siswa, lalu bisa
            Anda ubah dari halaman Nilai.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={tambah} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="mapel-nama">Nama mata pelajaran</Label>
              <Input
                id="mapel-nama"
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                placeholder="Contoh: Tata Boga"
                required
                maxLength={60}
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="mapel-kode">Kode (opsional)</Label>
              <Input
                id="mapel-kode"
                value={kode}
                onChange={(e) => setKode(e.target.value)}
                placeholder="Dikosongkan bila tidak ada"
                className="h-9"
              />
              <p className="text-xs text-muted-foreground">
                Bila dikosongkan, kode dibuat otomatis dari nama mapel.
              </p>
            </div>

            <Button type="submit" disabled={menyimpan || !nama.trim()} className="w-full">
              {menyimpan ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              Tambah mata pelajaran
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-52 flex-1 sm:max-w-xs">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari mapel..."
              aria-label="Cari mata pelajaran"
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

          <p className="tabular ml-auto text-sm text-muted-foreground">
            {loading ? "Memuat..." : `${tersaring.length} mapel`}
          </p>
        </div>

        <div className="overflow-x-auto rounded-xl border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12">No</TableHead>
                <TableHead>Nama Mata Pelajaran</TableHead>
                <TableHead className="w-32">Kode</TableHead>
                <TableHead className="w-32">Tingkat</TableHead>
                <TableHead className="w-28 text-center">Jumlah Nilai</TableHead>
                <TableHead className="w-32 text-right">Isi Nilai</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="p-0">
                    <TableSkeleton baris={6} kolom={5} />
                  </TableCell>
                </TableRow>
              ) : tersaring.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="p-0">
                    <EmptyState
                      icon={BookOpenText}
                      title={q ? "Mapel tidak ditemukan" : "Belum ada mata pelajaran"}
                      description={
                        q
                          ? "Coba kata kunci lain."
                          : "Tambahkan mata pelajaran lewat formulir di samping."
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                tersaring.map((m, i) => (
                  <TableRow key={m.nama} className="h-10">
                    <TableCell className="tabular text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="max-w-72 truncate font-medium">{m.nama}</TableCell>
                    <TableCell className="tabular text-muted-foreground">{m.kode}</TableCell>
                    <TableCell>
                      <span className="tabular rounded-md bg-muted px-1.5 py-0.5 text-xs">
                        {m.tingkat.length === TOTAL_TINGKAT
                          ? "7, 8, 9"
                          : m.tingkat.join(", ")}
                      </span>
                    </TableCell>
                    <TableCell className="tabular text-center">{m.jumlahNilai}</TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/nilai?mapel=${encodeURIComponent(m.nama)}`}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        <Pencil className="size-4" />
                        Isi nilai
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Menambah mapel membuat 3 baris mapel (satu per tingkat) dan 128 baris nilai baru dengan
          nilai 0. Nilai 0 ikut masuk rentang dongkrak selama aturan aktif.
        </p>
      </div>
    </div>
  );
}