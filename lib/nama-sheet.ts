/**
 * Aturan nama sheet Excel:
 * - maksimal 31 karakter
 * - tanpa karakter terlarang : \ / ? * [ ]
 * - unik tanpa membedakan huruf besar/kecil
 * - spasi di ujung dihapus sebelum menambah akhiran " (2)", " (3)", ...
 *
 * Dipisahkan dari lib/excel.ts agar bisa diuji tanpa memuat exceljs.
 */
export function namaSheet(nama: string, dipakai: Set<string>): string {
  const dasar = nama.replace(/[:\\/?*\[\]]/g, " ").trim();
  let s = dasar.slice(0, 31).trimEnd();

  for (let i = 2; dipakai.has(s.toLowerCase()); i++) {
    const akhiran = ` (${i})`;
    s = dasar.slice(0, 31 - akhiran.length).trimEnd() + akhiran;
  }

  dipakai.add(s.toLowerCase());
  return s;
}

/** Nama berkas: buang karakter yang tidak valid untuk nama berkas. */
export function sanitizeFilename(nama: string): string {
  return nama.replace(/[\\/:*?"<>|]/g, "-").trim();
}