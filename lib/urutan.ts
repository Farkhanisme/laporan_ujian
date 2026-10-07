/**
 * Urutan tampilan dan cetak.
 *
 * Mapel diurutkan abjad, tidak peka huruf besar/kecil. Daftar ini sengaja
 * TIDAK disimpan sebagai konstanta: menambah mapel baru tidak perlu mengubah
 * kode, dan urutannya otomatis benar untuk mapel yang belum pernah dikenal.
 * (SQLite tidak bisa dipakai untuk ini karena ORDER BY di sana peka huruf
 * besar/kecil.)
 */
export function urutanMapel(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

export const URUTAN_KELAS = ["7A", "7B", "8A", "8B", "9"];

export function urutanKelas(a: string, b: string): number {
  const ia = URUTAN_KELAS.indexOf(a);
  const ib = URUTAN_KELAS.indexOf(b);
  if (ia !== -1 && ib !== -1) return ia - ib;
  if (ia !== -1) return -1;
  if (ib !== -1) return 1;
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

export function urutanSiswa(
  a: { kelas: string; nama: string },
  b: { kelas: string; nama: string }
): number {
  const kelasCmp = urutanKelas(a.kelas, b.kelas);
  if (kelasCmp !== 0) return kelasCmp;
  return a.nama.localeCompare(b.nama, undefined, { sensitivity: "base" });
}

export const TINGKAT = [7, 8, 9];

export function getTingkatFromKelas(kelas: string): number {
  return parseInt(kelas.charAt(0), 10);
}

export function bisaPindahKelas(kelasAsal: string, kelasTujuan: string): boolean {
  return getTingkatFromKelas(kelasAsal) === getTingkatFromKelas(kelasTujuan);
}