export type Predikat = "A" | "B" | "C" | "D";

/**
 * Batas bawah tiap predikat, bisa diubah pengguna lewat halaman
 * Pengaturan Predikat.
 *
 * Hanya batas bawah yang disimpan. Batas atas tiap predikat diturunkan dari
 * predikat di atasnya, jadi mustahil ada celah atau tumpang tindih antar rentang:
 * A >= minA selalu jadi minA..100, B jadi minB..minA-1, dan seterusnya.
 *
 * `minD` tidak disimpan karena selalu 0 — semua nilai 0..100 wajib punya
 * predikat, tidak boleh ada nilai yang jatuh ke luar seluruh rentang.
 */
export interface BatasPredikat {
  minA: number;
  minB: number;
  minC: number;
  /** Nilai akhir mulai angka ini disebut tuntas. */
  batasTuntas: number;
}

/**
 * Batas bawaan dipakai kalau tabel `batas_predikat` belum ada, mis. migrasi
 * belum dijalankan. Nilai ini sama dengan ketentuan awal aplikasi.
 */
export const BATAS_AWAL: BatasPredikat = {
  minA: 93,
  minB: 85,
  minC: 77,
  batasTuntas: 77,
};

/** Batas atas tiap predikat, dihitung dari batas bawah di atasnya. */
export function batasAtas(p: Predikat, batas: BatasPredikat): number {
  switch (p) {
    case "A":
      return 100;
    case "B":
      return batas.minA - 1;
    case "C":
      return batas.minB - 1;
    case "D":
      return batas.minC - 1;
  }
}

/**
 * Predikat dari nilai akhir.
 *
 * `batas` sengaja WAJIB (tanpa nilai bawaan): kalau dipanggil tanpa batas,
 * TypeScript akan gagal saat build. Nilai bawaan di sini justru berbahaya,
 * karena tempat yang lupa mengoper batasnya akan diam-diam memakai angka lama
 * dan menghasilkan raport yang salah tanpa ada yang gagal.
 */
export function predikat(nilai: number, batas: BatasPredikat): Predikat {
  if (nilai >= batas.minA) return "A";
  if (nilai >= batas.minB) return "B";
  if (nilai >= batas.minC) return "C";
  return "D";
}

/** Rentang nilai dalam bentuk teks, dipakai sebagai tooltip badge di UI. */
export function predikatLabel(p: Predikat, batas: BatasPredikat): string {
  return `${p} (${rentangBawah(p, batas)}–${batasAtas(p, batas)})`;
}

/** Rentang bawah sebuah predikat (0 untuk D). */
function rentangBawah(p: Predikat, batas: BatasPredikat): number {
  switch (p) {
    case "A":
      return batas.minA;
    case "B":
      return batas.minB;
    case "C":
      return batas.minC;
    case "D":
      return 0;
  }
}

/**
 * Keterangan kata predikat. Berbeda dengan `predikatLabel` yang menyebut
 * rentang angka, yang ini menjelaskan artinya — dipakai di Excel ringkasan.
 */
export const PREDIKAT_KETERANGAN: Record<Predikat, string> = {
  A: "Sangat Baik",
  B: "Baik",
  C: "Cukup",
  D: "Kurang",
};

/** Predikat berikut keterangannya, contoh: "B (Baik)". */
export function predikatDenganKeterangan(p: Predikat): string {
  return `${p} (${PREDIKAT_KETERANGAN[p]})`;
}

/**
 * Keterangan ketuntasan nilai akhir, memakai batas tuntas yang sedang berlaku.
 */
export function deskripsiNilai(nilai: number, batas: BatasPredikat): "Tuntas" | "Belum Tuntas" {
  return nilai >= batas.batasTuntas ? "Tuntas" : "Belum Tuntas";
}

/** Kelas badge predikat, termasuk varian gelap, dipakai seluruh UI. */
export const PREDIKAT_CLASSES: Record<Predikat, string> = {
  A: "bg-emerald-100 text-emerald-800 ring-emerald-600/20 dark:bg-emerald-500/15 dark:text-emerald-300",
  B: "bg-sky-100 text-sky-800 ring-sky-600/20 dark:bg-sky-500/15 dark:text-sky-300",
  C: "bg-amber-100 text-amber-800 ring-amber-600/20 dark:bg-amber-500/15 dark:text-amber-300",
  D: "bg-rose-100 text-rose-800 ring-rose-600/20 dark:bg-rose-500/15 dark:text-rose-300",
};