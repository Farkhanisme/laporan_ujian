"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { predikat, type Predikat } from "@/lib/predikat";
import { urutanMapel } from "@/lib/urutan";
import { Loader2, Download, Save, X, Pencil } from "lucide-react";

const KELAS = ["7A", "7B", "8A", "8B", "9"];
const SEMUA_MAPEL = "semua";

const WARNA_PREDIKAT: Record<Predikat, string> = {
  A: "bg-emerald-100 text-emerald-800",
  B: "bg-sky-100 text-sky-800",
  C: "bg-amber-100 text-amber-800",
  D: "bg-rose-100 text-rose-800",
};

interface NilaiRow {
  nilaiId: number;
  siswaId: number;
  siswa: string;
  kelas: string;
  mapelId: number;
  mapel: string;
  nilai_asli: number;
  nilai_dongkrak: number | null;
  nilai_akhir: number;
  predikat: string;
}

export function NilaiView({ mapelAwal }: { mapelAwal?: string }) {
  const [kelas, setKelas] = useState("7A");
  const [siswaId, setSiswaId] = useState<string>("semua");
  const [mapel, setMapel] = useState<string>(mapelAwal ?? SEMUA_MAPEL);
  const [rows, setRows] = useState<NilaiRow[]>([]);
  const [siswaList, setSiswaList] = useState<Array<{ id: number; nama: string }>>([]);
  const [daftarMapel, setDaftarMapel] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Daftar siswa di kelas terpilih (untuk dropdown).
  useEffect(() => {
    let batal = false;

    (async () => {
      try {
        const res = await fetch(`/api/siswa?kelas=${kelas}`);
        const json = await res.json();
        if (batal) return;
        setSiswaList(json.ok ? json.data : []);
      } catch {
        if (!batal) setSiswaList([]);
      }
    })();

    return () => {
      batal = true;
    };
  }, [kelas]);

  // Daftar mapel diambil dari database supaya mapel baru ikut muncul.
  useEffect(() => {
    let batal = false;

    (async () => {
      try {
        const res = await fetch("/api/mapel");
        const json = await res.json();
        if (batal) return;
        if (json.ok) {
          setDaftarMapel(
            [...json.data.map((m: { nama: string }) => m.nama)].sort(urutanMapel)
          );
        }
      } catch {
        if (!batal) setDaftarMapel([]);
      }
    })();

    return () => {
      batal = true;
    };
  }, []);

  // Menyusun parameter query dari filter yang aktif.
  const buildParams = useCallback(() => {
    const params = new URLSearchParams({ kelas });
    if (siswaId !== "semua") params.set("siswaId", siswaId);
    if (mapel !== SEMUA_MAPEL) params.set("mapel", mapel);
    return params;
  }, [kelas, siswaId, mapel]);

  // Memuat nilai. Seluruh setState terjadi setelah `await`, jadi tidak ada
  // cascading render dari dalam effect.
  useEffect(() => {
    let batal = false;

    (async () => {
      try {
        const res = await fetch(`/api/nilai?${buildParams().toString()}`);
        const json = await res.json();
        if (batal) return;

        if (!json.ok) throw new Error(json.error);
        setRows(json.data);
        setError(null);
      } catch (err) {
        if (batal) return;
        setError(err instanceof Error ? err.message : "Gagal memuat nilai.");
        setRows([]);
      } finally {
        if (!batal) setLoading(false);
      }
    })();

    return () => {
      batal = true;
    };
  }, [buildParams]);

  // Dipanggil setelah simpan (bukan dari dalam effect).
  const muatUlang = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/nilai?${buildParams().toString()}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setRows(json.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat nilai.");
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  // Ganti kelas → kembali ke mode semua siswa dan buang draft.
  function gantiKelas(v: string) {
    setKelas(v);
    setSiswaId("semua");
    setDraft({});
  }

  function pilihSiswa(v: string) {
    setSiswaId(v);
    setDraft({});
  }

  // Ganti mapel → buang draft yang belum disimpan.
  function pilihMapel(v: string) {
    setMapel(v ?? SEMUA_MAPEL);
    setDraft({});
  }

  const modeSiswaTunggal = siswaId !== "semua";

  const siswaSaatIni = useMemo(
    () => siswaList.find((s) => String(s.id) === siswaId)?.nama,
    [siswaList, siswaId]
  );

  function nilaiDraft(row: NilaiRow): string {
    return draft[row.nilaiId] ?? String(row.nilai_asli);
  }

  async function simpan() {
    const items = Object.entries(draft).map(([id, value]) => ({
      id: Number(id),
      siswa_id: Number(siswaId),
      nilai_asli: Number(value),
    }));

    if (items.length === 0) {
      toast.info("Tidak ada perubahan.");
      return;
    }

    const tidakValid = items.find(
      (i) => !Number.isInteger(i.nilai_asli) || i.nilai_asli < 0 || i.nilai_asli > 100
    );
    if (tidakValid) {
      toast.error("Nilai harus bilangan bulat 0–100.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/nilai", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);

      if (json.data.ditolak > 0) {
        toast.error(`${json.data.ditolak} baris tidak cocok dengan siswa ini dan tidak disimpan.`);
      }
      if (json.data.jumlah > 0) {
        toast.success(`${json.data.jumlah} nilai disimpan.`);
      }
      setDraft({});
      await muatUlang();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan nilai.");
    } finally {
      setSaving(false);
    }
  }

  async function unduhSemua() {
    setDownloading(true);
    try {
      const res = await fetch("/api/export/semua");
      if (!res.ok) throw new Error("Gagal membuat file.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "nilai_semua_siswa_ASTS_GANJIL_2026-2027.xlsx";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("File nilai berhasil diunduh.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengunduh.");
    } finally {
      setDownloading(false);
    }
  }

  const jumlahDiubah = Object.keys(draft).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="filter-kelas">Kelas</Label>
          <Select value={kelas} onValueChange={(v) => gantiKelas(v ?? "7A")}>
            <SelectTrigger id="filter-kelas" className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KELAS.map((k) => (
                <SelectItem key={k} value={k}>
                  Kelas {k}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filter-mapel">Mata pelajaran</Label>
          <Select value={mapel} onValueChange={(v) => pilihMapel(v ?? SEMUA_MAPEL)}>
            <SelectTrigger id="filter-mapel" className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SEMUA_MAPEL}>Semua mata pelajaran</SelectItem>
              {daftarMapel.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filter-siswa">Siswa</Label>
          <Select value={siswaId} onValueChange={(v) => pilihSiswa(v ?? "semua")}>
            <SelectTrigger id="filter-siswa" className="w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="semua">Semua siswa di kelas</SelectItem>
              {siswaList.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.nama}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="ml-auto flex flex-wrap gap-2">
          {modeSiswaTunggal ? (
            <a
              href={`/api/export/raport/${siswaId}`}
              className={buttonVariants({ variant: "outline", size: "default" })}
            >
              <Download className="size-4" />
              Unduh Raport
            </a>
          ) : null}

          {modeSiswaTunggal && jumlahDiubah > 0 ? (
            <>
              <Button onClick={simpan} disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Simpan
              </Button>
              <Button variant="outline" onClick={() => setDraft({})} disabled={saving}>
                <X className="size-4" />
                Batal
              </Button>
            </>
          ) : null}

          <Button variant="outline" onClick={unduhSemua} disabled={downloading}>
            {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            Unduh Semua Nilai
          </Button>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {modeSiswaTunggal && siswaSaatIni ? (
        <p className="text-sm text-muted-foreground">
          Editing nilai <span className="font-medium text-foreground">{siswaSaatIni}</span>
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {!modeSiswaTunggal ? <TableHead className="w-56">Siswa</TableHead> : null}
              <TableHead>Nama Mapel</TableHead>
              <TableHead className="w-28 text-center">Nilai Asli</TableHead>
              <TableHead className="w-32 text-center">Nilai Dongkrak</TableHead>
              <TableHead className="w-24 text-center">Predikat</TableHead>
              {!modeSiswaTunggal ? <TableHead className="w-28 text-right">Aksi</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  Belum ada data nilai.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const p = predikat(row.nilai_akhir);
                return (
                  <TableRow key={row.nilaiId}>
                    {!modeSiswaTunggal ? (
                      <TableCell className="font-medium">{row.siswa}</TableCell>
                    ) : null}

                    <TableCell>{row.mapel}</TableCell>

                    <TableCell className="text-center">
                      {modeSiswaTunggal ? (
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          value={nilaiDraft(row)}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, [row.nilaiId]: e.target.value }))
                          }
                          className="h-9 w-20 text-center"
                        />
                      ) : (
                        row.nilai_asli
                      )}
                    </TableCell>

                    <TableCell
                      className={
                        row.nilai_dongkrak !== null
                          ? "text-center font-semibold bg-amber-50 text-amber-800"
                          : "text-center text-muted-foreground"
                      }
                    >
                      {row.nilai_dongkrak ?? "-"}
                    </TableCell>

                    <TableCell className="text-center">
                      <span
                        className={`inline-flex rounded px-2 py-0.5 text-xs font-semibold ${WARNA_PREDIKAT[p]}`}
                      >
                        {p}
                      </span>
                    </TableCell>

                    {!modeSiswaTunggal ? (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => pilihSiswa(String(row.siswaId))}
                        >
                          <Pencil className="size-4" />
                          Edit nilai
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {!loading && rows.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {modeSiswaTunggal
            ? `${rows.length} mapel ditampilkan`
            : `${rows.length} nilai ditampilkan`}
          {mapel !== SEMUA_MAPEL ? ` (filter: ${mapel})` : ""}
          .{" "}
          {modeSiswaTunggal
            ? "Nilai dongkrak dihitung otomatis dari aturan yang berlaku."
            : "Klik Edit nilai untuk mengubahnya."}
        </p>
      ) : null}
    </div>
  );
}