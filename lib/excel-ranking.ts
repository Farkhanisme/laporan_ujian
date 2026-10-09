import ExcelJS from "exceljs";
import type { BarisRanking } from "./ranking";
import { predikat, type BatasPredikat } from "./predikat";
import { namaSheet } from "./nama-sheet";

/** Judul kolom saat ranking berdasarkan seluruh mapel (rata-rata). */
export const HEADER_RANKING = [
  "RANKING",
  "NAMA",
  "KELAS",
  "RATA-RATA",
  "PREDIKAT",
] as const;

/** Judul kolom saat ranking satu mapel: angkanya nilai mapel itu, bukan rata-rata. */
export const HEADER_RANKING_MAPEL = [
  "RANKING",
  "NAMA",
  "KELAS",
  "MAPEL",
  "NILAI",
  "PREDIKAT",
] as const;

// Kolom NAMA dibuat selebar nama terpanjang di data (33 karakter) plus ruang.
// Kolom MAPEL harus muat nama mapel terpanjang ("Sejarah Kebudayaan Islam").
export const LEBAR_RANKING = [10, 36, 10, 12, 11];
export const LEBAR_RANKING_MAPEL = [10, 36, 10, 26, 10, 11];

const RATA_TENGAH = {
  horizontal: "center" as const,
  vertical: "middle" as const,
};

const RATA_KIRI = {
  horizontal: "left" as const,
  vertical: "middle" as const,
};

const GARI: Partial<ExcelJS.Borders> = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" },
};

const TANPA_LATAR = {
  type: "pattern" as const,
  pattern: "none" as const,
};

/**
 * Ranking kelas: header di baris 1, data mulai baris 2.
 *
 * `isiSheetRanking` menulis tabel ranking satu kelas dari seluruh mapel;
 * `isiSheetRankingMapel` menulis tabel ranking satu mapel. Keduanya memakai
 * pemformat yang sama, jadi keduanya tidak bisa berbeda dalam hal garis,
 * rata-rata, atau format angka.
 *
 * Kolom KELAS ikut dicetak supaya berkasnya bisa dibaca sendiri tanpa
 * melihat nama berkas.
 *
 * @param baris hasil `hitungRanking`, sudah terurut dan sudah berperingkat
 * @param mapel nama mapel; `undefined` berarti seluruh mapel
 * @param batas batas predikat yang sedang berlaku
 */
export function isiSheetRanking(
  ws: ExcelJS.Worksheet,
  baris: BarisRanking[],
  batas: BatasPredikat,
  mapel?: string
) {
  if (mapel === undefined) isiSheetSemuaMapel(ws, baris, batas);
  else isiSheetSatuMapel(ws, baris, mapel, batas);
}

/** Tabel ranking dari seluruh mapel: angka kolom keempat adalah rata-rata. */
function isiSheetSemuaMapel(
  ws: ExcelJS.Worksheet,
  baris: BarisRanking[],
  batas: BatasPredikat
) {
  const jumlahKolom = HEADER_RANKING.length;

  ws.getRow(1).height = 24;
  HEADER_RANKING.forEach((judul, i) => {
    const cell = ws.getCell(1, i + 1);
    cell.value = judul;
    cell.font = { bold: true };
    cell.alignment = RATA_TENGAH;
    cell.fill = TANPA_LATAR;
    cell.border = GARI;
  });

  baris.forEach((b, i) => {
    const n = i + 2;

    const peringkat = ws.getCell(n, 1);
    peringkat.value = b.peringkat;
    peringkat.alignment = RATA_TENGAH;
    peringkat.border = GARI;

    const nama = ws.getCell(n, 2);
    nama.value = b.nama;
    nama.alignment = RATA_KIRI;
    nama.border = GARI;

    const kelas = ws.getCell(n, 3);
    kelas.value = b.kelas;
    kelas.alignment = RATA_TENGAH;
    kelas.border = GARI;

    const rata = ws.getCell(n, 4);
    // Satu desimal supaya rata-rata yang tampil sama dengan yang di layar.
    rata.value = b.rata;
    rata.numFmt = "0.0";
    rata.alignment = RATA_TENGAH;
    rata.border = GARI;

    const predikatCell = ws.getCell(n, 5);
    predikatCell.value = predikat(b.rata, batas);
    predikatCell.alignment = RATA_TENGAH;
    predikatCell.border = GARI;
  });

  LEBAR_RANKING.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  aturCetak(ws, jumlahKolom, baris.length);
}

/**
 * Tabel ranking satu mapel: `rata` berisi nilai mapel itu (satu baris nilai
 * per siswa), jadi kolomnya ditulis sebagai ANGKA BULAT dengan judul NILAI,
 * bukan sebagai rata-rata satu desimal.
 */
function isiSheetSatuMapel(
  ws: ExcelJS.Worksheet,
  baris: BarisRanking[],
  mapel: string,
  batas: BatasPredikat
) {
  const jumlahKolom = HEADER_RANKING_MAPEL.length;

  ws.getRow(1).height = 24;
  HEADER_RANKING_MAPEL.forEach((judul, i) => {
    const cell = ws.getCell(1, i + 1);
    cell.value = judul;
    cell.font = { bold: true };
    cell.alignment = RATA_TENGAH;
    cell.fill = TANPA_LATAR;
    cell.border = GARI;
  });

  baris.forEach((b, i) => {
    const n = i + 2;

    const peringkat = ws.getCell(n, 1);
    peringkat.value = b.peringkat;
    peringkat.alignment = RATA_TENGAH;
    peringkat.border = GARI;

    const nama = ws.getCell(n, 2);
    nama.value = b.nama;
    nama.alignment = RATA_KIRI;
    nama.border = GARI;

    const kelas = ws.getCell(n, 3);
    kelas.value = b.kelas;
    kelas.alignment = RATA_TENGAH;
    kelas.border = GARI;

    const kolomMapel = ws.getCell(n, 4);
    kolomMapel.value = mapel;
    kolomMapel.alignment = RATA_KIRI;
    kolomMapel.border = GARI;

    const nilai = ws.getCell(n, 5);
    // Nilai mapel selalu bulat (CHECK 0..100 di skema), jadi bukan desimal.
    nilai.value = b.rata;
    nilai.numFmt = "0";
    nilai.alignment = RATA_TENGAH;
    nilai.border = GARI;

    const predikatCell = ws.getCell(n, 6);
    predikatCell.value = predikat(b.rata, batas);
    predikatCell.alignment = RATA_TENGAH;
    predikatCell.border = GARI;
  });

  LEBAR_RANKING_MAPEL.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  aturCetak(ws, jumlahKolom, baris.length);
}

/** Area cetak dihitung dari jumlah kolom dan baris supaya mapel/siswa baru ikut tercetak. */
function aturCetak(ws: ExcelJS.Worksheet, jumlahKolom: number, jumlahBaris: number) {
  const barisAkhir = 1 + jumlahBaris;
  ws.pageSetup = {
    paperSize: 9,
    orientation: "portrait",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    printArea: `A1:${kolomKe(jumlahKolom)}${barisAkhir}`,
    horizontalCentered: true,
    margins: { left: 0.7, right: 0.7, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
  };
}

/** Konversi nomor kolom (1) menjadi huruf: 1 -> A, 6 -> F. */
function kolomKe(n: number): string {
  let hasil = "";
  let sisa = n;
  while (sisa > 0) {
    const modulo = (sisa - 1) % 26;
    hasil = String.fromCharCode(65 + modulo) + hasil;
    sisa = Math.floor((sisa - modulo) / 26);
  }
  return hasil;
}

/** Ranking satu kelas dari seluruh mapel: satu sheet. */
export async function generateRanking(
  baris: BarisRanking[],
  kelas: string,
  batas: BatasPredikat
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet(`Ranking Kelas ${kelas}`);
  isiSheetRanking(ws, baris, batas);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/** Satu sheet Ranking: satu kelas, satu mapel, seluruh siswa. */
export interface SheetRankingMapel {
  mapel: string;
  baris: BarisRanking[];
}

/**
 * Ranking satu kelas untuk SETIAP mapel: satu sheet per mapel.
 *
 * Nama sheet memakai `namaSheet` karena "Ranking Sejarah Kebudayaan Islam" adalah
 * 32 karakter, melewati batas 31 karakter Excel. Set yang dipakai juga
 * menjamin nama tidak bentrok antar mapel.
 */
export async function generateRankingSemuaMapel(
  daftar: SheetRankingMapel[],
  kelas: string,
  batas: BatasPredikat
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const dipakai = new Set<string>();

  // Sheet kosong hanya bila tidak ada mapel sama sekali.
  if (daftar.length === 0) {
    workbook.addWorksheet(`Ranking Kelas ${kelas}`);
  }

  for (const { mapel, baris } of daftar) {
    const ws = workbook.addWorksheet(namaSheet(`Ranking ${mapel}`, dipakai));
    isiSheetRanking(ws, baris, batas, mapel);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}