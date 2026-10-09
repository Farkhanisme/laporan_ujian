"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import { PredikatBadge } from "@/components/predikat-badge";
import {
  BATAS_AWAL,
  PREDIKAT_KETERANGAN,
  batasAtas,
  type BatasPredikat,
  type Predikat,
} from "@/lib/predikat";

interface Rentang {
  predikat: Predikat;
  bawah: number;
  atas: number;
}

interface Sebar {
  A: number;
  B: number;
  C: number;
  D: number;
}

interface Preview {
  rentang: Rentang[];
  sebelum: Sebar;
  sesudah: Sebar;
}

interface Muat {
  batas: BatasPredikat;
  rentang: Rentang[];
  sebar: Sebar;
  memakaiBawaan: boolean;
}

const KETERANGAN: Record<string, string> = {
  minA: "Batas bawah A",
  minB: "Batas bawah B",
  minC: "Batas bawah C",
};

export function PredikatView() {
  const [muat, setMuat] = useState<Muat | null>(null);
  const [loading, setLoading] = useState(true);

  const [minA, setMinA] = useState("");
  const [minB, setMinB] = useState("");
  const [minC, setMinC] = useState("");
  const [batasTuntas, setBatasTuntas] = useState("");

  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [menyimpan, setMenyimpan] = useState(false);

  const [dialogSimpan, setDialogSimpan] = useState(false);
  const [dialogAwal, setDialogAwal] = useState(false);

  // Muat batas yang berlaku. Semua setState setelah `await`, jadi tidak ada
  // cascading render dari dalam effect.
  useEffect(() => {
    let batal = false;

    (async () => {
      try {
        const res = await fetch("/api/predikat");
        const json = await res.json();
        if (batal) return;
        if (json.ok) {
          setMuat(json.data);
          isiForm(json.data.batas);
        }
      } catch {
        if (!batal) setMuat(null);
      } finally {
        if (!batal) setLoading(false);
      }
    })();

    return () => {
      batal = true;
    };
  }, []);

  function isiForm(b: BatasPredikat) {
    setMinA(String(b.minA));
    setMinB(String(b.minB));
    setMinC(String(b.minC));
    setBatasTuntas(String(b.batasTuntas));
  }

  // Pesan validasi per field, muncul di bawah input — bukan hanya tombol yang
  // diam-diam nonaktif.
  const pesan = useMemo(() => {
    const kasar = [minA, minB, minC, batasTuntas].find((v) => v.trim() === "");
    if (kasar !== undefined) return { field: "semua", text: "Semua isian harus diisi." };

    const angka = [minA, minB, minC, batasTuntas].map(Number);
    if (angka.some((n) => !Number.isInteger(n) || n < 0 || n > 100)) {
      return { field: "semua", text: "Semua isian harus bilangan bulat 0–100." };
    }
    if (Number(minA) <= Number(minB)) {
      return { field: "minA", text: "Batas A harus lebih besar dari batas B." };
    }
    if (Number(minB) <= Number(minC)) {
      return { field: "minB", text: "Batas B harus lebih besar dari batas C." };
    }
    if (Number(minC) < 1) {
      return { field: "minC", text: "Batas C minimal 1, karena nilai 0 sampai dengan batas C – 1 selalu mendapat predikat D." };
    }
    return null;
  }, [minA, minB, minC, batasTuntas]);

  const isianSah = pesan === null;

  // Pratinjau selalu dihapus begitu isian berubah, jadi angka yang terlihat
  // pasti berasal dari isian terkini.
  function ubahField(setter: (v: string) => void, nilai: string) {
    setter(nilai);
    setPreview(null);
  }

  async function lihatPratinjau() {
    setPreviewLoading(true);
    try {
      const res = await fetch("/api/predikat/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minA: Number(minA),
          minB: Number(minB),
          minC: Number(minC),
          batasTuntas: Number(batasTuntas),
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setPreview(json.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal membuat pratinjau.");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function simpan() {
    setMenyimpan(true);
    try {
      const res = await fetch("/api/predikat", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minA: Number(minA),
          minB: Number(minB),
          minC: Number(minC),
          batasTuntas: Number(batasTuntas),
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);

      toast.success("Pengaturan predikat disimpan.");
      setDialogSimpan(false);
      setPreview(null);
      setMuat({ ...json.data, memakaiBawaan: false });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan.");
    } finally {
      setMenyimpan(false);
    }
  }

  async function kembalikanAwal() {
    setMenyimpan(true);
    try {
      const res = await fetch("/api/predikat", { method: "DELETE" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);

      toast.success("Batas predikat dikembalikan ke awal.");
      setDialogAwal(false);
      setPreview(null);
      isiForm(BATAS_AWAL);
      setMuat({ ...json.data, memakaiBawaan: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengembalikan.");
    } finally {
      setMenyimpan(false);
    }
  }

  /** Berapa nilai yang akan pindah predikat, untuk ditampilkan di dialog. */
  const berubah = useMemo(() => {
    if (!preview) return 0;
    let n = 0;
    for (const p of ["A", "B", "C", "D"] as Predikat[]) {
      n += Math.abs(preview.sebelum[p] - preview.sesudah[p]);
    }
    // Setiap nilai yang berpindah dihitung dua kali (kurang di satu predikat,
    // lebih di predikat lain), jadi bagi dua.
    return n / 2;
  }, [preview]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Batas predikat</CardTitle>
          <CardDescription>
            Isi batas bawah tiap predikat. Batas atas dihitung otomatis dari predikat
            di atasnya, jadi rentang tidak mungkin tumpang tindih atau bolong.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
              Memuat pengaturan…
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="minA">{KETERANGAN.minA}</Label>
                  <Input
                    id="minA"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={100}
                    value={minA}
                    onChange={(e) => ubahField(setMinA, e.target.value)}
                    aria-invalid={pesan?.field === "minA"}
                    className="tabular"
                  />
                  <p className="text-xs text-muted-foreground">
                    Nilai {minA || "…"} sampai 100 mendapat predikat A.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="minB">{KETERANGAN.minB}</Label>
                  <Input
                    id="minB"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={100}
                    value={minB}
                    onChange={(e) => ubahField(setMinB, e.target.value)}
                    aria-invalid={pesan?.field === "minB"}
                    className="tabular"
                  />
                  <p className="text-xs text-muted-foreground">
                    Nilai {minB || "…"} sampai {Number(minA || 0) - 1} mendapat predikat B.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="minC">{KETERANGAN.minC}</Label>
                  <Input
                    id="minC"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={100}
                    value={minC}
                    onChange={(e) => ubahField(setMinC, e.target.value)}
                    aria-invalid={pesan?.field === "minC"}
                    className="tabular"
                  />
                  <p className="text-xs text-muted-foreground">
                    Nilai {minC || "…"} sampai {Number(minB || 0) - 1} mendapat predikat C.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="batasTuntas">Batas tuntas (KKM)</Label>
                  <Input
                    id="batasTuntas"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={100}
                    value={batasTuntas}
                    onChange={(e) => ubahField(setBatasTuntas, e.target.value)}
                    aria-invalid={pesan?.field === "batasTuntas"}
                    className="tabular"
                  />
                  <p className="text-xs text-muted-foreground">
                    Nilai akhir {batasTuntas || "…"} ke atas disebut tuntas.
                  </p>
                </div>
              </div>

              {pesan ? (
                <Alert variant={pesan.field === "semua" ? "destructive" : "default"}>
                  <AlertDescription>{pesan.text}</AlertDescription>
                </Alert>
              ) : null}

              {/* Pengingat, bukan pembatas: KKM boleh berbeda dari batas C. */}
              {isianSah && Number(batasTuntas) !== Number(minC) ? (
                <Alert>
                  <AlertTitle>Batas tuntas berbeda dari batas C</AlertTitle>
                  <AlertDescription>
                    Batas tuntas {batasTuntas} tidak sama dengan batas bawah predikat C
                    ({minC}). Sebagian nilai berpredikat C mungkin belum dihitung
                    tuntas.
                  </AlertDescription>
                </Alert>
              ) : null}
            </>
          )}
        </CardContent>

        <CardFooter className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={lihatPratinjau}
            disabled={!isianSah || previewLoading || loading}
          >
            {previewLoading ? "Menghitung…" : "Lihat pratinjau"}
          </Button>

          {/* Simpan hanya boleh aktif kalau pratinjau sudah dibuat, supaya
              yang tersimpan persis yang terlihat. */}
          <Button onClick={() => setDialogSimpan(true)} disabled={!preview || loading}>
            Simpan
          </Button>

          <Button
            variant="ghost"
            className="ml-auto"
            onClick={() => setDialogAwal(true)}
            disabled={loading || muat?.memakaiBawaan}
          >
            Kembalikan ke awal
          </Button>
        </CardFooter>
      </Card>

      {preview ? (
        <Card>
          <CardHeader>
            <CardTitle>Pratinjau</CardTitle>
            <CardDescription>
              {berubah === 0
                ? "Tidak ada nilai yang berpindah predikat."
                : `${berubah} nilai akan berpindah predikat.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Predikat</TableHead>
                  <TableHead>Rentang nilai</TableHead>
                  <TableHead className="w-32 text-center">Sekarang</TableHead>
                  <TableHead className="w-32 text-center">Sesudah</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.rentang.map((r) => {
                  const berubahPredikat = preview.sebelum[r.predikat] !== preview.sesudah[r.predikat];
                  return (
                    <TableRow key={r.predikat}>
                      <TableCell>
                        <PredikatBadge
                          nilai={r.bawah}
                          batas={{
                            minA: Number(minA),
                            minB: Number(minB),
                            minC: Number(minC),
                            batasTuntas: Number(batasTuntas),
                          }}
                        />
                      </TableCell>
                      <TableCell className="tabular">
                        {r.bawah}–{r.atas}
                        <span className="ml-2 text-xs text-muted-foreground">
                          {PREDIKAT_KETERANGAN[r.predikat]}
                        </span>
                      </TableCell>
                      <TableCell className="tabular text-center">
                        {preview.sebelum[r.predikat]}
                      </TableCell>
                      <TableCell
                        className={`tabular text-center ${berubahPredikat ? "font-semibold text-brand" : ""}`}
                      >
                        {preview.sesudah[r.predikat]}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {muat && !loading ? (
        <p className="text-xs text-muted-foreground">
          Batas yang sedang berlaku:{" "}
          {(["A", "B", "C", "D"] as Predikat[]).map((p) => (
            <span key={p} className="mr-2">
              {p} {p === "D" ? 0 : muat.batas[`min${p}` as "minA" | "minB" | "minC"]}–
              {batasAtas(p, muat.batas)}
            </span>
          ))}
          · tuntas {muat.batas.batasTuntas}
        </p>
      ) : null}

      <Dialog open={dialogSimpan} onOpenChange={setDialogSimpan}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Simpan batas predikat?</DialogTitle>
            <DialogDescription>
              {berubah === 0
                ? "Batas predikat akan disimpan, tetapi tidak ada nilai yang berpindah."
                : `${berubah} nilai akan berpindah predikat.`}{" "}
              Ini berlaku untuk raport, ringkasan, dan ranking yang diunduh setelah
              sekarang. Berkas yang sudah diunduh sebelumnya tidak berubah.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogSimpan(false)}>
              Batal
            </Button>
            <Button onClick={simpan} disabled={menyimpan}>
              {menyimpan ? "Menyimpan…" : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogAwal} onOpenChange={setDialogAwal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kembalikan ke batas awal?</DialogTitle>
            <DialogDescription>
              Batas kembali ke A 93, B 85, C 77, dan batas tuntas 77. Nilai yang
              sedang berpindah predikat akan kembali seperti semula.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogAwal(false)}>
              Batal
            </Button>
            <Button onClick={kembalikanAwal} disabled={menyimpan}>
              {menyimpan ? "Memproses…" : "Kembalikan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}