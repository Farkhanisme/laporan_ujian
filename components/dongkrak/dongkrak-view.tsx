"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";
import { ArrowRight, Check, Eye, Loader2, Minus, RotateCcw, Sparkles, TrendingUp } from "lucide-react";

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

/** Rentang yang sering dipakai untuk menaikkan nilai kelompok bawah. */
const PRESET = [
  { label: "60–69 → 70", awal: "60", akhir: "69", target: "70" },
  { label: "65–74 → 75", awal: "65", akhir: "74", target: "75" },
  { label: "70–79 → 80", awal: "70", akhir: "79", target: "80" },
  { label: "75–84 → 85", awal: "75", akhir: "84", target: "85" },
];

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

  // Pesan validasi per field, muncul di bawah input — bukan hanya tombol
  // yang diam-diam nonaktif.
  const pesan = useMemo(() => {
    const kosong = [awal, akhir, target].some((v) => v.trim() === "");
    if (kosong) return null;

    const angka = [awal, akhir, target].map(Number);
    if (angka.some((n) => !Number.isInteger(n) || n < 0 || n > 100)) {
      return { field: "semua", text: "Semua isian harus bilangan bulat 0–100." };
    }
    if (Number(awal) > Number(akhir)) {
      return { field: "akhir", text: "Nilai akhir tidak boleh lebih kecil dari nilai awal." };
    }
    return null;
  }, [awal, akhir, target]);

  const nilaiValid = pesan === null && [awal, akhir, target].every((v) => v.trim() !== "");

  const adaPeringatan = nilaiValid && Number(target) < Number(akhir);

  // `ubahField` mengosongkan preview setiap kali isian berubah, jadi preview
  // yang ada pasti dibuat dari isian terkini.
  const pratinjauSesuai = preview !== null && nilaiValid;

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

  function ubahField(setter: (v: string) => void, nilai: string) {
    setter(nilai);
    // Pratinjau tidak lagi boleh dipakai begitu isiannya berubah.
    setPreview(null);
  }

  return (
    <div className="space-y-4">
      {/* Status aturan aktif: yang paling sering dicek, jadi paling atas. */}
      {loading ? (
        <Card>
          <CardContent className="flex h-24 items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : aturan ? (
        <Card className="border-brand/25 bg-brand-subtle/40">
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5 font-medium text-brand">
              <TrendingUp className="size-4" aria-hidden />
              Aturan yang sedang berlaku
            </CardDescription>
            <CardTitle className="tabular flex flex-wrap items-center gap-2 text-2xl">
              <span className="rounded-lg bg-card px-2.5 py-1 ring-1 ring-brand/25">
                {aturan.nilai_awal}&ndash;{aturan.nilai_akhir}
              </span>
              <ArrowRight className="size-5 text-brand" aria-hidden />
              <span className="rounded-lg bg-brand px-2.5 py-1 text-brand-foreground">
                {aturan.nilai_target}
              </span>
            </CardTitle>
          </CardHeader>
          <CardFooter className="flex flex-wrap items-center justify-between gap-3 border-brand/15 bg-transparent">
            <p className="tabular text-sm text-muted-foreground">
              {jumlahTerdampak} nilai terdampak · diterapkan{" "}
              {new Date(aturan.diterapkan_pada).toLocaleString("id-ID")}
            </p>
            <Button variant="outline" size="sm" onClick={() => setDialogReset(true)}>
              <RotateCcw className="size-4" />
              Reset dongkrak
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <Alert>
          <TrendingUp className="size-4" />
          <AlertTitle>Belum ada aturan dongkrak</AlertTitle>
          <AlertDescription>
            Nilai akhir saat ini sama dengan nilai asli. Buat aturan di bawah bila ingin menaikkan
            nilai kelompok tertentu.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <Card>
          <CardHeader>
            <CardTitle>Aturan baru</CardTitle>
            <CardDescription>
              Semua nilai asli pada rentang tersebut diubah menjadi nilai target. Nilai asli
              tidak pernah berubah.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <FieldNilai
                id="awal"
                label="Nilai awal"
                nilai={awal}
                onChange={(v) => ubahField(setAwal, v)}
                error={pesan?.field === "akhir" || pesan?.field === "semua" ? pesan.text : null}
              />
              <FieldNilai
                id="akhir"
                label="Nilai akhir"
                nilai={akhir}
                onChange={(v) => ubahField(setAkhir, v)}
                error={pesan?.field === "akhir" ? pesan.text : null}
              />
              <FieldNilai
                id="target"
                label="Nilai target"
                nilai={target}
                onChange={(v) => ubahField(setTarget, v)}
                error={pesan?.field === "semua" ? pesan.text : null}
              />
            </div>

            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Preset cepat</p>
              <div className="flex flex-wrap gap-1.5">
                {PRESET.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => {
                      setAwal(p.awal);
                      setAkhir(p.akhir);
                      setTarget(p.target);
                      setPreview(null);
                    }}
                    className="tabular rounded-lg border bg-card px-2.5 py-1.5 text-xs font-medium transition-colors hover:border-brand/40 hover:bg-brand-subtle hover:text-brand focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    {p.label}
                  </button>
                ))}
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
              {pratinjauLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Eye className="size-4" />
              )}
              Lihat pratinjau dampak
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pratinjau</CardTitle>
            <CardDescription>
              {pratinjauSesuai
                ? "Periksa dulu sebelum aturan diterapkan."
                : "Isi ketiga kolom, lalu buat pratinjau untuk melihat dampaknya."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!pratinjauSesuai || !preview ? (
              <EmptyState
                icon={Sparkles}
                title="Belum ada pratinjau"
                description="Pratinjau menunjukkan berapa nilai yang terdampak dan contohnya, sebelum ada perubahan ke database."
              />
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <Angka
                    label="Nilai terdampak"
                    nilai={preview.jumlahTerdampak}
                    nada="brand"
                  />
                  <Angka label="Bernilai 0" nilai={preview.jumlahNol} />
                  <Angka
                    label="Dongkrak lama diganti"
                    nilai={preview.jumlahDongkrakAktif}
                    nada="peringatan"
                  />
                </div>

                {preview.jumlahNol > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Nilai 0 ikut masuk rentang. Sebagian bisa mapel yang memang belum diisi.
                  </p>
                ) : null}

                {preview.contoh.length > 0 ? (
                  <div className="overflow-hidden rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead>Siswa</TableHead>
                          <TableHead>Mapel</TableHead>
                          <TableHead className="w-24 text-center">Asli</TableHead>
                          <TableHead className="w-28 text-center">Jadi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.contoh.map((c, i) => {
                          const turun = c.nilai_target < c.nilai_asli;
                          return (
                            <TableRow key={i} className="h-9">
                              <TableCell className="max-w-40 truncate">{c.siswa}</TableCell>
                              <TableCell className="max-w-40 truncate">{c.mapel}</TableCell>
                              <TableCell className="tabular text-center text-muted-foreground">
                                {c.nilai_asli}
                              </TableCell>
                              <TableCell className="tabular text-center">
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
                                    turun
                                      ? "bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/15 dark:text-rose-300"
                                      : "bg-brand-subtle text-brand ring-brand/20"
                                  )}
                                >
                                  {turun ? (
                                    <Minus className="size-3" aria-hidden />
                                  ) : (
                                    <ArrowRight className="size-3" aria-hidden />
                                  )}
                                  {c.nilai_target}
                                </span>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : null}

                <Button className="w-full" onClick={() => setDialogTerapkan(true)}>
                  <Check className="size-4" />
                  Terapkan aturan
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogTerapkan} onOpenChange={setDialogTerapkan}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Terapkan aturan?</DialogTitle>
            <DialogDescription>
              Nilai asli {awal}&ndash;{akhir} akan menjadi {target}. Menerapkan aturan ini juga
              menghapus hasil dongkrak sebelumnya ({preview?.jumlahDongkrakAktif ?? 0} nilai) dan
              menggantinya dengan yang baru. Nilai asli tidak berubah.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogTerapkan(false)}>
              Batal
            </Button>
            <Button onClick={terapkan} disabled={menerapkan}>
              {menerapkan ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
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
              {menerapkan ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RotateCcw className="size-4" />
              )}
              Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FieldNilai({
  id,
  label,
  nilai,
  onChange,
  error,
}: {
  id: string;
  label: string;
  nilai: string;
  onChange: (v: string) => void;
  error: string | null;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        max={100}
        step={1}
        value={nilai}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn("tabular h-9", error && "border-destructive")}
      />
      {error ? (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Angka({
  label,
  nilai,
  nada = "netral",
}: {
  label: string;
  nilai: number;
  nada?: "netral" | "brand" | "peringatan";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2",
        nada === "brand" && "border-brand/25 bg-brand-subtle/50",
        nada === "peringatan" && "border-amber-600/20 bg-amber-50 dark:bg-amber-500/10"
      )}
    >
      <p className="tabular text-lg font-semibold leading-tight">{nilai}</p>
      <p className="text-[0.7rem] leading-tight text-muted-foreground">{label}</p>
    </div>
  );
}