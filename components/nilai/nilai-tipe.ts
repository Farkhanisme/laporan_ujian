/** Baris nilai sesuai bentuk yang dikembalikan `GET /api/nilai`. */
export interface NilaiRow {
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

/**
 * Nilai harus bilangan bulat 0–100, sama seperti aturan server. Kosong
 * diizinkan di sini (sedang diketik) tetapi tidak akan lolos saat menyimpan.
 */
export function nilaiValid(v: string): boolean {
  if (v.trim() === "") return false;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= 100;
}

/** Cell yang belum bisa disimpan karena isiannya tidak valid. */
export function hitungSelInvalid(
  draft: Record<number, string>,
  berubah: (nilaiId: number) => boolean
): number[] {
  return Object.keys(draft)
    .map(Number)
    .filter((id) => berubah(id) && !nilaiValid(draft[id]));
}