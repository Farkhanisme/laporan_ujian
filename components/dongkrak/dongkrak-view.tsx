"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Eye, Check, RotateCcw } from "lucide-react";

interface Aturan {
  nilai_awal: number;
  nilai_akhir: number;
  nilai_target: number;
  diterapkan_pada: string;
}

interface Preview {
  jumlahTerdampak: number;
  jumlahNol: number;
  jumlahDongkrakAktif: number;
  contoh: Array<{ siswa: string; mapel: string; nilai_asli: number; nilai_target: number }>;
}

export function DongkrakView() {
  const [aturan, setAturan] = useState<Aturan | null>(null);
  const [jumlahTerdampak, setJumlahTerdampak] = useState(0);
  const [loading, setLoading] = useState(true);

  const [awal, setAwal] = useState("");
  const [akhir, setAkhir] = useState("");
  const [target, setTarget] = useState("");

  const [preview, setPreview] = useState<Preview | null>(null);
  const [pratinjauLoading, setPratinjauLoading] = useState(false);
  const [menerapkan, setMenerapkan] = useState(false);

  const [dialogTerapkan, setDialogTerapkan] = useState(false);
  const [dialogReset, setDialogReset] = useState(false);

  // Muat aturan saat halaman dibuka. Semua setState terjadi setelah `await`,
  // jadi tidak ada cascading render dari dalam effect.
  useEffect(() => {
    let batal = false;

    (async () => {
      try {
        const res = await fetch("/api/dongkrak");
        const json = await res.json();
        if (batal) return;
        if (json.ok) {
          setAturan(json.data.aturan);
          setJumlahTerdampak(json.data.jumlahTerdampak);
        }
      } catch {
        if (!batal) setAturan(null);
      } finally {
        if (!batal) setLoading(false);
      }
    })();

    return () => {
      batal = true;
    };
  }, []);

  // Dipanggil setelah Terapkan / Reset (bukan dari dalam effect).
  const muatAturan = useCallback(async () => {
    try {
      const res = await fetch("/api/dongkrak");
      const json = await res.json();
      if (json.ok) {
        setAturan(json.data.aturan);
        setJumlahTerdampak(json.data.jumlahTerdampak);
      }
    } catch {
      setAturan(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const nilaiValid =
    [awal, akhir, target].every((v) => v !== "" && Number.isInteger(Number(v))) &&
    Number(awal) >= 0 &&
    Number(awal) <= 100 &&
    Number(akhir) >= 0 &&
    Number(akhir) <= 100 &&
    Number(target) >= 0 &&
    Number(target) <= 100 &&
    Number(awal) <= Number(akhir);

  const adaPeringatan = nilaiValid && Number(target) < Number(akhir);

  async function pratinjau() {
    setPratinjauLoading(true);
    try {
      const res = await fetch("/api/dongkrak/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nilai_awal: Number(awal),
          nilai_akhir: Number(akhir),
          nilai_target: Number(target),
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setPreview(json.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal membuat pratinjau.");
    } finally {
      setPratinjauLoading(false);
    }
  }

  async function terapkan() {
    setMenerapkan(true);
    try {
      const res = await fetch("/api/dongkrak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nilai_awal: Number(awal),
          nilai_akhir: Number(akhir),
          nilai_target: Number(target),
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);

      toast.success(`Aturan diterapkan pada ${json.data.jumlah} nilai.`);
      setDialogTerapkan(false);
      setPreview(null);
      setAwal("");
      setAkhir("");
      setTarget("");
      await muatAturan();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menerapkan aturan.");
    } finally {
      setMenerapkan(false);
    }
  }

  async function reset() {
    setMenerapkan(true);
    try {
      const res = await fetch("/api/dongkrak", { method: "DELETE" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      toast.success("Dongkrak direset.");
      setDialogReset(false);
      setPreview(null);
      await muatAturan();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mereset.");
    } finally {
      setMenerapkan(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Aturan yang sedang berlaku</CardTitle>
          <CardDescription>
            Hanya satu aturan berlaku pada satu waktu.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="flex h-16 items-center justify-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : aturan ? (
            <>
              <p className="text-lg font-semibold">
                Nilai {aturan.nilai_awal}–{aturan.nilai_akhir} diubah menjadi {aturan.nilai_target}
              </p>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <dt className="text-muted-foreground">Diterapkan</dt>
                <dd>{new Date(aturan.diterapkan_pada).toLocaleString("id-ID")}</dd>
                <dt className="text-muted-foreground">Nilai terdampak</dt>
                <dd>{jumlahTerdampak} nilai</dd>
              </dl>
              <Button variant="outline" onClick={() => setDialogReset(true)}>
                <RotateCcw className="size-4" />
                Reset dongkrak
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Belum ada aturan dongkrak.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Aturan baru</CardTitle>
          <CardDescription>
            Semua nilai asli pada rentang tersebut diubah menjadi nilai target.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="awal">Nilai awal</Label>
              <Input
                id="awal"
                type="number"
                min={0}
                max={100}
                step={1}
                value={awal}
                onChange={(e) => {
                  setAwal(e.target.value);
                  setPreview(null);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="akhir">Nilai akhir</Label>
              <Input
                id="akhir"
                type="number"
                min={0}
                max={100}
                step={1}
                value={akhir}
                onChange={(e) => {
                  setAkhir(e.target.value);
                  setPreview(null);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="target">Nilai target</Label>
              <Input
                id="target"
                type="number"
                min={0}
                max={100}
                step={1}
                value={target}
                onChange={(e) => {
                  setTarget(e.target.value);
                  setPreview(null);
                }}
              />
            </div>
          </div>

          {adaPeringatan ? (
            <Alert>
              <AlertTitle>Perhatian</AlertTitle>
              <AlertDescription>
                Nilai target lebih kecil dari batas akhir rentang; sebagian nilai bisa turun.
              </AlertDescription>
            </Alert>
          ) : null}

          <Button onClick={pratinjau} disabled={!nilaiValid || pratinjauLoading}>
            {pratinjauLoading ? <Loader2 className="size-4 animate-spin" /> : <Eye className="size-4" />}
            Pratinjau
          </Button>

          <Button onClick={() => setDialogTerapkan(true)} disabled={!preview}>
            <Check className="size-4" />
            Terapkan
          </Button>

          {preview ? (
            <div className="space-y-2 rounded-md border p-3">
              <p className="text-sm">
                <span className="font-medium">{preview.jumlahTerdampak}</span> nilai akan
                terdampak, <span className="font-medium">{preview.jumlahNol}</span> di antaranya
                bernilai 0 (bisa jadi mapel tanpa nilai).
              </p>
              <p className="text-sm text-muted-foreground">
                {preview.jumlahDongkrakAktif} hasil dongkrak yang sedang ada akan diganti.
              </p>

              {preview.contoh.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Siswa</TableHead>
                      <TableHead>Mapel</TableHead>
                      <TableHead className="text-center">Asli</TableHead>
                      <TableHead className="text-center">Target</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.contoh.map((c, i) => (
                      <TableRow key={i}>
                        <TableCell>{c.siswa}</TableCell>
                        <TableCell>{c.mapel}</TableCell>
                        <TableCell className="text-center">{c.nilai_asli}</TableCell>
                        <TableCell className="text-center font-medium">{c.nilai_target}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={dialogTerapkan} onOpenChange={setDialogTerapkan}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Terapkan aturan?</DialogTitle>
            <DialogDescription>
              Menerapkan aturan ini akan menghapus hasil dongkrak sebelumnya (
              {preview?.jumlahDongkrakAktif ?? 0} nilai) dan menggantinya dengan aturan baru.
              Lanjutkan?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogTerapkan(false)}>
              Batal
            </Button>
            <Button onClick={terapkan} disabled={menerapkan}>
              {menerapkan ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Terapkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogReset} onOpenChange={setDialogReset}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset dongkrak?</DialogTitle>
            <DialogDescription>
              Seluruh hasil dongkrak akan dikosongkan dan aturan yang berlaku dihapus. Nilai asli
              tidak berubah. Lanjutkan?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogReset(false)}>
              Batal
            </Button>
            <Button variant="destructive" onClick={reset} disabled={menerapkan}>
              {menerapkan ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
              Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}