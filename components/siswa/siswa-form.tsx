"use client";

import { useEffect, useState } from "react";
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
import { Loader2, Save } from "lucide-react";

const KELAS = ["7A", "7B", "8A", "8B", "9"];

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
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Formulir Siswa</CardTitle>
        <CardDescription>
          NIS dan NISN opsional. Kosongkan bila belum diketahui — disimpan sebagai kosong.
        </CardDescription>
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
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="kelas">Kelas</Label>
            <Select value={kelas} onValueChange={(v) => setKelas(v ?? "")}>
              <SelectTrigger id="kelas">
                <SelectValue placeholder="Pilih kelas" />
              </SelectTrigger>
              <SelectContent>
                {KELAS.map((k) => (
                  <SelectItem key={k} value={k}>
                    Kelas {k}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Kelas hanya bisa diganti dalam tingkat yang sama (7A ↔ 7B, 8A ↔ 8B).
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
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={saving || !nama || !kelas}>
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Simpan
            </Button>
            <Link
              href="/siswa"
              className={buttonVariants({ variant: "outline", size: "default" })}
            >
              Batal
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}