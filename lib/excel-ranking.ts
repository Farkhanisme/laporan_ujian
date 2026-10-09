import ExcelJS from "exceljs";
import type { BarisRanking } from "./ranking";

export const HEADER_RANKING = ["RANKING", "NAMA", "KELAS", "RATA-RATA"] as const;

// Lebar kolom RANKING | NAMA | KELAS | RATA-RATA.Kolom NAMA dibuat
// selebar nama terpanjang di data (33 karakter) plus ruang).
export const LEBAR_RANKING = [10, 36, 10, 12];

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
 * Kolom: RANKING | NAMA | KELAS | RATA-RATA. Kolom KELAS sengaja ikut
 * dicetak supaya berkasnya bisa dibaca sendiri tanpa melihat nama berkas.
 *
 * @param baris hasil `hitungRanking`, sudah terurut dan sudah berperingkat
 */
export function isiSheetRanking(ws: ExcelJS.Worksheet, baris: BarisRanking[]) {
  const jumlahKolom = HEADER_RANKING.length;

  // --- Header baris 1 ---
  ws.getRow(1).height = 24;
  HEADER_RANKING.forEach((judul, i) => {
    const cell = ws.getCell(1, i + 1);
    cell.value = judul;
    cell.font = { bold: true };
    cell.alignment = RATA_TENGAH;
    cell.fill = TANPA_LATAR;
    cell.border = GARI;
  });

  // --- Data mulai baris 2 ---
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

    const kelasCell = ws.getCell(n, 3);
    kelasCell.value = b.kelas;
    kelasCell.alignment = RATA_TENGAH;
    kelasCell.border = GARI;

    const rata = ws.getCell(n, 4);
    // Satu desimal supaya rata-rata yang tampil sama dengan yang di layar.
    rata.value = b.rata;
    rata.numFmt = "0.0";
    rata.alignment = RATA_TENGAH;
    rata.border = GARI;
  });

  // --- Lebar kolom ---
  LEBAR_RANKING.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  // --- Pengaturan cetak: A4 tegak, muat 1 halaman. Kelas terbesar 34 siswa
  // sehingga satu halaman sudah cukup tanpa mengecilkan teks.
  const barisAkhir = 1 + baris.length;
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

/** Konversi nomor kolom (1) menjadi huruf: 1 -> A, 4 -> D. */
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

export async function generateRanking(
  baris: BarisRanking[],
  kelas: string
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  // Nama sheet dibatasi 31 karakter; kelas maksalah "9" jadi selalu muat.
  const ws = workbook.addWorksheet(`Ranking Kelas ${kelas}`);
  isiSheetRanking(ws, baris);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}