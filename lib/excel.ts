import ExcelJS from "exceljs";
import { NAMA_MADRASAH, TAHUN_AJARAN, SEMESTER } from "./config";
import { urutanMapel } from "./urutan";
import { namaSheet } from "./nama-sheet";
import type { Predikat } from "./predikat";

export interface SiswaData {
  id: number;
  nama: string;
  kelas: string;
  nis: string | null;
  nisn: string | null;
}

export interface NilaiRow {
  mapel: string;
  nilai_akhir: number;
  predikat: Predikat;
}

function selTeks(
  ws: ExcelJS.Worksheet,
  alamat: string,
  nilai: string,
  tebal = false
) {
  const cell = ws.getCell(alamat);
  cell.value = nilai;
  // Sel teks agar "2026/2027" dan angka berawalan 0 tidak diubah Excel.
  cell.numFmt = "@";
  if (tebal) cell.font = { bold: true };
}

const RATA_TENGAH = {
  horizontal: "center" as const,
  vertical: "middle" as const,
};

const GARI: Partial<ExcelJS.Borders> = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" },
};

/** Judul kolom tanpa warna latar (putih), hanya tebal, rata tengah, bergaris. */
const TANPA_LATAR = {
  type: "pattern" as const,
  pattern: "none" as const,
};

/**
 * Membangun isi satu sheet raport siswa.
 * Dipakai oleh F4 (satu siswa) dan F5 (semua siswa) agar isinya identik.
 */
export function isiSheetSiswa(ws: ExcelJS.Worksheet, siswa: SiswaData, nilai: NilaiRow[]) {
  // --- Kop: pasangan label (kolom A & C) dan nilai (kolom B & D) ---
  // Label ditulis kapital; nilai di sebelahnya mengikuti aslinya.
  // A1 "NAMA" | B1 nama siswa        | C1 "MADRAHSAH"         | D1 nama madrasah
  // A2 "NIS"  | B2 NIS               | C2 "KELAS/SEMESTER"   | D2 kelas/semester
  // A3 "NISN" | B3 NISN              | C3 "TAHUN AJARAN"     | D3 tahun ajaran
  selTeks(ws, "A1", "NAMA", true);
  selTeks(ws, "B1", siswa.nama, true);
  selTeks(ws, "C1", "MADRAHSAH", true);
  selTeks(ws, "D1", NAMA_MADRASAH, true);

  selTeks(ws, "A2", "NIS", true);
  selTeks(ws, "B2", siswa.nis ?? "", true);
  selTeks(ws, "C2", "KELAS/SEMESTER", true);
  selTeks(ws, "D2", `${siswa.kelas}/${SEMESTER}`, true);

  selTeks(ws, "A3", "NISN", true);
  selTeks(ws, "B3", siswa.nisn ?? "", true);
  selTeks(ws, "C3", "TAHUN AJARAN", true);
  selTeks(ws, "D3", TAHUN_AJARAN, true);

  // --- Judul kolom ---
  ws.getCell("A4").value = "No";
  ws.getCell("B4").value = "Nama Mapel";
  ws.getCell("C4").value = "Nilai";
  ws.getCell("D4").value = "Predikat";

  for (const alamat of ["A4", "B4", "C4", "D4"]) {
    const cell = ws.getCell(alamat);
    cell.font = { bold: true };
    cell.alignment = RATA_TENGAH;
    // Tanpa warna latar (putih): judul kolom tetap tebal, rata tengah, bergaris.
    cell.fill = TANPA_LATAR;
    cell.border = GARI;
  }

  // --- Baris mapel, urut abjad nama mapel ---
  const urut = [...nilai].sort((a, b) => urutanMapel(a.mapel, b.mapel));

  urut.forEach((row, i) => {
    const n = i + 5;

    const no = ws.getCell(`A${n}`);
    no.value = i + 1;
    no.alignment = RATA_TENGAH;
    no.border = GARI;

    const mapel = ws.getCell(`B${n}`);
    mapel.value = row.mapel;
    mapel.border = GARI;

    const nilaiCell = ws.getCell(`C${n}`);
    nilaiCell.value = row.nilai_akhir;
    nilaiCell.numFmt = "0";
    nilaiCell.alignment = RATA_TENGAH;
    nilaiCell.border = GARI;

    const pred = ws.getCell(`D${n}`);
    pred.value = row.predikat;
    pred.alignment = RATA_TENGAH;
    pred.border = GARI;
  });

  // --- Lebar kolom ---
  // A: label kop (nama/nis/nisn) + kolom No  → cukup sempit
  // B: nama siswa (terpanjang 33 karakter) + kolom Nama Mapel → lebar
  // C: label kop (kelas/semester, tahun ajaran) + kolom Nilai
  // D: nilai kop (nama madrasah) + kolom Predikat
  ws.getColumn(1).width = 12;
  ws.getColumn(2).width = 36;
  ws.getColumn(3).width = 16;
  ws.getColumn(4).width = 20;

  // --- Pengaturan cetak: 1 siswa = 1 lembar A4 ---
  // Area cetak dihitung dari jumlah baris supaya mapel baru ikut tercetak.
  // Dengan 16 mapel hasilnya "A1:D20", sama seperti sebelumnya.
  const barisAkhir = 4 + urut.length;
  ws.pageSetup = {
    paperSize: 9,
    orientation: "portrait",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    printArea: `A1:D${barisAkhir}`,
    horizontalCentered: true,
    margins: { left: 0.7, right: 0.7, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
  };
}

/** F4: satu sheet untuk satu siswa. */
export async function generateRaportSiswa(
  siswa: SiswaData,
  nilai: NilaiRow[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const dipakai = new Set<string>();
  const ws = workbook.addWorksheet(namaSheet(siswa.nama, dipakai));
  isiSheetSiswa(ws, siswa, nilai);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/** F5: satu sheet per siswa. */
export async function generateSemuaNilai(
  allData: Array<{ siswa: SiswaData; nilai: NilaiRow[] }>
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const dipakai = new Set<string>();

  for (const { siswa, nilai } of allData) {
    const ws = workbook.addWorksheet(namaSheet(siswa.nama, dipakai));
    isiSheetSiswa(ws, siswa, nilai);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}