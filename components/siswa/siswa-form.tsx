"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TableSkeleton } from "@/components/skeleton";
import { KELAS } from "@/lib/kelas";
import { bisaPindahKelas } from "@/lib/urutan";
import { ArrowLeft, Info, Loader2, Save } from "lucide-react";

interface Siswa {
  id: number;
  nama: string;
  kelas: string;
  nis: string | null;
  nisn: string | null;
}

export function SiswaForm({ siswaId }: { siswaId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nama, setNama] = useState("");
  const [kelas, setKelas] = useState("");
  const [nis, setNis] = useState("");
  const [nisn, setNisn] = useState("");

  useEffect(() => {
    let batal = false;

    async function muat() {
      try {
        const res = await fetch(`/api/siswa/${siswaId}`);
        const json = await res.json();
        if (!json.ok) throw new Error(json.error);
        if (batal) return;
        const s: Siswa = json.data;
        setNama(s.nama);
        setKelas(s.kelas);
        setNis(s.nis ?? "");
        setNisn(s.nisn ?? "");
      } catch (err) {
        if (!batal) {
          setError(err instanceof Error ? err.message : "Gagal memuat data.");
        }
      } finally {
        if (!batal) setLoading(false);
      }
    }

    muat();
    return () => {
      batal = true;
    };
  }, [siswaId]);

  // Kelas hanya boleh berpindah dalam tingkat yang sama (7A ↔ 7B). Menampilkan
  // hanya pilihan yang sah supaya guru tidak memilih yang pasti ditolak server.
  const pilihanKelas = useMemo(() => {
    if (!kelas) return KELAS;
    return KELAS.filter((k) => k === kelas || bisaPindahKelas(kelas, k));
  }, [kelas]);

  const tingkat = kelas ? kelas.charAt(0) : "";

  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/siswa/${siswaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nama, kelas, nis, nisn }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);

      toast.success("Data siswa disimpan.");
      router.push("/siswa");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card className="max-w-2xl">
        <CardContent className="p-0">
          <TableSkeleton baris={4} kolom={1} />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
      <Card>
        <CardHeader>
          <CardTitle>Data siswa</CardTitle>
          <CardDescription>Nama wajib diisi. NIS dan NISN boleh dikosongkan.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={simpan} className="space-y-4">
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="nama">Nama</Label>
              <Input
                id="nama"
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                required
                autoFocus
                autoComplete="off"
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="kelas">Kelas</Label>
              <Select value={kelas} onValueChange={(v) => setKelas(v ?? "")}>
                <SelectTrigger id="kelas" className="h-9 w-full">
                  <SelectValue placeholder="Pilih kelas" />
                </SelectTrigger>
                <SelectContent>
                  {pilihanKelas.map((k) => (
                    <SelectItem key={k} value={k}>
                      Kelas {k}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Hanya kelas tingkat {tingkat || "yang sama"} yang bisa dipilih. Nilai terikat pada
                mapel tingkat ini, jadi pindah ke tingkat lain tidak didukung.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="nis">NIS</Label>
                <Input
                  id="nis"
                  value={nis}
                  onChange={(e) => setNis(e.target.value)}
                  inputMode="numeric"
                  placeholder="Kosongkan bila belum ada"
                  className="tabular h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nisn">NISN</Label>
                <Input
                  id="nisn"
                  value={nisn}
                  onChange={(e) => setNisn(e.target.value)}
                  inputMode="numeric"
                  placeholder="Kosongkan bila belum ada"
                  className="tabular h-9"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 border-t pt-4">
              <Button type="submit" disabled={saving || !nama.trim() || !kelas}>
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Simpan
              </Button>
              <Link href="/siswa" className={buttonVariants({ variant: "outline" })}>
                Batal
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Panel info: siswa melihat ringkasan isian di samping form. */}
      <Card size="sm" className="bg-muted/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5 text-sm">
            <Info className="size-4 text-muted-foreground" aria-hidden />
            Ringkasan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
            <dt className="text-muted-foreground">Nama</dt>
            <dd className="min-w-0 truncate font-medium">{nama || "—"}</dd>
            <dt className="text-muted-foreground">Kelas</dt>
            <dd className="tabular font-medium">{kelas || "—"}</dd>
            <dt className="text-muted-foreground">NIS</dt>
            <dd className="tabular text-muted-foreground">{nis || "belum diisi"}</dd>
            <dt className="text-muted-foreground">NISN</dt>
            <dd className="tabular text-muted-foreground">{nisn || "belum diisi"}</dd>
          </dl>

          <Link
            href="/siswa"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3" />
            Kembali ke daftar siswa
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}