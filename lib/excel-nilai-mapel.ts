import ExcelJS from "exceljs";
import { predikat, type BatasPredikat } from "./predikat";
import { kolomKe } from "./excel-kertas";

/** Satu baris nilai untuk satu siswa pada satu mapel. */
export interface BarisNilaiMapel {
  nama: string;
  nisn: string | null;
  kelas: string;
  nilai_asli: number;
  nilai_dongkrak: number | null;
  nilai_akhir: number;
}

/** Judul kolom. MAPEL ikut dicetak supaya berkasnya berdiri sendiri. */
export const HEADER = [
  "NO",
  "NAMA",
  "NISN",
  "KELAS",
  "MAPEL",
  "NILAI ASLI",
  "NILAI DONGKRAK",
  "NILAI AKHIR",
  "PREDIKAT",
] as const;

/**
 * Lebar kolom. Kolom NAMA mengikuti nama terpanjang di data (33 karakter) plus
 * ruang, kolom MAPEL mengikuti nama mapel terpanjang, dan "NILAI DONGKRAK"
 * ditulis penuh supaya judulnya tidak terpotong.
 */
export const LEBAR = [6, 36, 12, 8, 26, 11, 16, 12, 11];

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

/** Tanpa warna latar, konsisten dengan sheet ekspor yang lain. */
const TANPA_LATAR = {
  type: "pattern" as const,
  pattern: "none" as const,
};

/**
 * Satu sheet nilai satu kelas untuk SATU mapel: judul kolom di baris 1, data
 * mulai baris 2 — tata letak yang sama dengan `excel-ranking.ts`.
 *
 * Sheet ini sengaja tanpa kop. Nama mapel sudah ada di kolom MAPEL dan di nama
 * berkas, jadi berkasnya tetap bisa dibaca sendiri tanpa halaman judul.
 *
 * NILAI DONGKRAK ditulis sebagai angka, bukan "28 → 30", supaya kolomnya masih
 * bisa dipakai menghitung di Excel. Baris tanpa dongkrak dibiarkan kosong,
 * bukan diisi teks pengganti. Nilai akhir dan predikat memakai `batas` yang
 * sedang berlaku supaya sama persis dengan yang tampil di layar.
 *
 * @param baris nilai siswa di kelas tersebut, sudah terurut
 * @param mapel nama mapel; ditulis di tiap baris agar file berdiri sendiri
 * @param batas batas predikat yang sedang berlaku
 */
export function isiSheetNilaiMapel(
  ws: ExcelJS.Worksheet,
  baris: BarisNilaiMapel[],
  mapel: string,
  batas: BatasPredikat
) {
  const jumlahKolom = HEADER.length;

  ws.getRow(1).height = 24;
  HEADER.forEach((judul, i) => {
    const cell = ws.getCell(1, i + 1);
    cell.value = judul;
    cell.font = { bold: true };
    cell.alignment = RATA_TENGAH;
    cell.fill = TANPA_LATAR;
    cell.border = GARI;
  });

  baris.forEach((b, i) => {
    const n = i + 2;

    const no = ws.getCell(n, 1);
    no.value = i + 1;
    no.alignment = RATA_TENGAH;
    no.border = GARI;

    const nama = ws.getCell(n, 2);
    nama.value = b.nama;
    nama.alignment = RATA_KIRI;
    nama.border = GARI;

    // NISN kosong -> sel kosong, bukan teks pengganti. numFmt "@" supaya
    // angka berawalan 0 tidak diubah Excel.
    const nisn = ws.getCell(n, 3);
    if (b.nisn) {
      nisn.value = b.nisn;
      nisn.numFmt = "@";
    }
    nisn.alignment = RATA_KIRI;
    nisn.border = GARI;

    const kelas = ws.getCell(n, 4);
    kelas.value = b.kelas;
    kelas.alignment = RATA_TENGAH;
    kelas.border = GARI;

    const kolomMapel = ws.getCell(n, 5);
    kolomMapel.value = mapel;
    kolomMapel.alignment = RATA_KIRI;
    kolomMapel.border = GARI;

    // Nilai selalu bilat (CHECK 0..100 di skema), jadi formatnya "0".
    const asli = ws.getCell(n, 6);
    asli.value = b.nilai_asli;
    asli.numFmt = "0";
    asli.alignment = RATA_TENGAH;
    asli.border = GARI;

    const dongkrak = ws.getCell(n, 7);
    if (b.nilai_dongkrak !== null) {
      dongkrak.value = b.nilai_dongkrak;
      dongkrak.numFmt = "0";
    }
    dongkrak.alignment = RATA_TENGAH;
    dongkrak.border = GARI;

    const akhir = ws.getCell(n, 8);
    akhir.value = b.nilai_akhir;
    akhir.numFmt = "0";
    akhir.alignment = RATA_TENGAH;
    akhir.border = GARI;

    const predikatCell = ws.getCell(n, 9);
    predikatCell.value = predikat(b.nilai_akhir, batas);
    predikatCell.alignment = RATA_TENGAH;
    predikatCell.border = GARI;
  });

  LEBAR.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  // Area cetak dihitung dari jumlah baris supaya kelas yang bertambah atau
  // berkurang jumlah siswanya tetap tercetak utuh.
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

  // Judul kolom tetap terlihat saat menggulir ke bawah.
  ws.views = [{ state: "frozen", ySplit: 1 }];
}

/** Nilai satu kelas untuk satu mapel: satu sheet. */
export async function generateNilaiMapel(
  baris: BarisNilaiMapel[],
  kelas: string,
  mapel: string,
  batas: BatasPredikat
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet(`Nilai ${mapel} Kelas ${kelas}`);
  isiSheetNilaiMapel(ws, baris, mapel, batas);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}