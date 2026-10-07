"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button";
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
import { Loader2, Download, Pencil } from "lucide-react";

const KELAS = ["7A", "7B", "8A", "8B", "9"];

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

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={kelas} onValueChange={(v) => setKelas(v ?? "semua")}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Kelas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="semua">Semua kelas</SelectItem>
            {KELAS.map((k) => (
              <SelectItem key={k} value={k}>
                Kelas {k}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari nama siswa..."
          className="w-full max-w-xs"
        />

        <span className="text-sm text-muted-foreground">
          {loading ? "Memuat..." : `${siswa.length} siswa`}
        </span>
      </div>

      {belumTerisi > 0 ? (
        <Alert>
          <AlertDescription>
            NIS/NISN belum terisi: {belumTerisi} siswa
          </AlertDescription>
        </Alert>
      ) : null}

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
              <TableHead>Nama</TableHead>
              <TableHead className="w-20">Kelas</TableHead>
              <TableHead className="w-40">NIS</TableHead>
              <TableHead className="w-44">NISN</TableHead>
              <TableHead className="w-44 text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : siswa.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  Tidak ada siswa yang cocok.
                </TableCell>
              </TableRow>
            ) : (
              siswa.map((s, i) => (
                <TableRow key={s.id}>
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="font-medium">{s.nama}</TableCell>
                  <TableCell>{s.kelas}</TableCell>
                  <TableCell>{s.nis || "-"}</TableCell>
                  <TableCell>{s.nisn || "-"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {/* Elemen tautan asli, bukan Base UI Button: membuka tab
                          baru dengan ctrl+klik tetap bekerja seperti seharusnya. */}
                      <a
                        href={`/api/export/raport/${s.id}`}
                        className={buttonVariants({ variant: "ghost", size: "sm" })}
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
    </div>
  );
}