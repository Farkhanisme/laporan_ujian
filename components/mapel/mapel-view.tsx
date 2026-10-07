"use client";

import { useCallback, useEffect, useState } from "react";
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
import { Loader2, Plus, Pencil } from "lucide-react";

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
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle>Tambah mata pelajaran</CardTitle>
          <CardDescription>
            Diterapkan ke semua tingkat (7, 8, 9). Nilai awal diisi 0 untuk setiap
            siswa, lalu bisa Anda ubah dari halaman Nilai.
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
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="mapel-kode">Kode (opsional)</Label>
              <Input
                id="mapel-kode"
                value={kode}
                onChange={(e) => setKode(e.target.value)}
                placeholder="Dikosongkan bila tidak ada"
              />
              <p className="text-xs text-muted-foreground">
                Bila dikosongkan, kode dibuat otomatis dari nama mapel.
              </p>
            </div>

            <Button type="submit" disabled={menyimpan || !nama.trim()}>
              {menyimpan ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              Tambah
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3 lg:col-span-2">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
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
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    Belum ada mata pelajaran.
                  </TableCell>
                </TableRow>
              ) : (
                data.map((m, i) => (
                  <TableRow key={m.nama}>
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-medium">{m.nama}</TableCell>
                    <TableCell className="text-muted-foreground">{m.kode}</TableCell>
                    <TableCell>
                      {m.tingkat.length === TOTAL_TINGKAT
                        ? "7, 8, 9"
                        : m.tingkat.join(", ")}
                    </TableCell>
                    <TableCell className="text-center">{m.jumlahNilai}</TableCell>
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

        <p className="text-xs text-muted-foreground">
          Menambah mapel membuat 3 baris mapel (satu per tingkat) dan 128 baris nilai
          baru dengan nilai 0. Nilai 0 ikut masuk rentang dongkrak selama aturan aktif.
        </p>
      </div>
    </div>
  );
}