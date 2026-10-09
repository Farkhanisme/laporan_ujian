import ExcelJS from "exceljs";
import { deskripsiNilai, predikat, predikatDenganKeterangan } from "./predikat";

export interface RingkasanSiswa {
  id: number;
  nama: string;
  nisn: string | null;
  kelas: string;
}

/** Satu siswa dengan nilainya per nama mapel (sudah berupa nilai akhir). */
export interface RingkasanBaris {
  siswa: RingkasanSiswa;
  nilai: Map<string, number>;
}

export const HEADER_IDENTITAS = ["NO", "NAMA", "NISN", "TTL", "KELAS"] as const;

/** Baris judul kelompok di bawah nama mapel, diulang tiap mapel. */
export const HEADER_MAPEL = ["NILAI", "PREDIKAT", "DESKRIPSI"] as const;

/** Lebar kolom identitas; tiap mapel memakai LEBAR_MAPEL (nilai, predikat, deskripsi). */
export const LEBAR_IDENTITAS = [5, 34, 12, 12, 8];
/** Lebar kolom nilai, predikat ("A (Sangat Baik)"), dan deskripsi ("Belum Tuntas"). */
export const LEBAR_MAPEL = [7, 16, 14];

const BARIS_HEADER_MAPEL = 1;
const BARIS_HEADER_SUB = 2;
const BARIS_DATA_PERTAMA = 3;

/**
 * A3 tidak ada di enum `PaperSize` ExcelJS (yang isinya A4 = 9), tapi angka 8
 * tetap ditulis apa adanya ke XML dan dibaca Excel sebagai A3.
 */
const KERTAS_A3 = 8 as ExcelJS.PaperSize;

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

/** Tanpa warna latar, konsisten dengan kop raport. */
const TANPA_LATAR = {
  type: "pattern" as const,
  pattern: "none" as const,
};

/**
 * Ringkasan nilai: satu sheet, dua baris header, data mulai baris 3.
 *
 * Kolom: NO | NAMA | NISN | TTL | KELAS | <3 kolom per mapel>
 *   tiap mapel memakai tiga kolom: nilai (angka), predikat ("B (Baik)"),
 *   dan deskripsi ketuntasan ("Tuntas" / "Belum Tuntas").
 * Baris 1 berisi nama mapel di-merge tiga kolom, baris 2 berisi
 * NILAI | PREDIKAT | DESKRIPSI. Kolom identitas di-merge baris 1-2.
 * Field yang belum ada (NISN, TTL, nilai mapel) dibiarkan kosong —
 * tanpa teks pengganti.
 *
 * @param mapelNama daftar nama mapel, sudah berurutan; menentukan urutan kolom
 */
export function isiSheetRingkasan(
  ws: ExcelJS.Worksheet,
  baris: RingkasanBaris[],
  mapelNama: string[]
) {
  const kolomIdentitas = HEADER_IDENTITAS.length;
  const kolomPerMapel = HEADER_MAPEL.length;
  const totalKolom = kolomIdentitas + mapelNama.length * kolomPerMapel;

  /** Kolom pertama (1) dari mapel ke-`i`. */
  const kolomMapel = (i: number) => kolomIdentitas + i * kolomPerMapel + 1;

  // --- Header baris 1 dan 2 ---
  ws.getRow(BARIS_HEADER_MAPEL).height = 30;
  ws.getRow(BARIS_HEADER_SUB).height = 18;

  HEADER_IDENTITAS.forEach((judul, i) => {
    // Merge vertikal supaya judul identitas membentang dua baris header.
    ws.mergeCells(BARIS_HEADER_MAPEL, i + 1, BARIS_HEADER_SUB, i + 1);
    const cell = ws.getCell(BARIS_HEADER_MAPEL, i + 1);
    cell.value = judul;
    cell.font = { bold: true };
    cell.alignment = RATA_TENGAH;
    cell.fill = TANPA_LATAR;
    cell.border = GARI;
  });

  mapelNama.forEach((nama, i) => {
    const awal = kolomMapel(i);

    // Baris 1: nama mapel menutupi tiga kolom.
    ws.mergeCells(BARIS_HEADER_MAPEL, awal, BARIS_HEADER_MAPEL, awal + kolomPerMapel - 1);
    const judul = ws.getCell(BARIS_HEADER_MAPEL, awal);
    judul.value = nama;
    judul.font = { bold: true };
    // Nama mapel membungkus supaya kolom tidak perlu lebar penuh.
    judul.alignment = { ...RATA_TENGAH, wrapText: true };
    judul.fill = TANPA_LATAR;

    // Baris 2: judul tiap kolom di bawahnya.
    HEADER_MAPEL.forEach((sub, j) => {
      const cell = ws.getCell(BARIS_HEADER_SUB, awal + j);
      cell.value = sub;
      cell.font = { bold: true };
      cell.alignment = RATA_TENGAH;
      cell.fill = TANPA_LATAR;
    });

    // Border dipasang ke tiap sel, bukan hanya sel utama merge, kalau tidak
    // sisi dalam kelompok mapel tidak bergaris.
    for (let r = BARIS_HEADER_MAPEL; r <= BARIS_HEADER_SUB; r++) {
      for (let c = awal; c < awal + kolomPerMapel; c++) {
        ws.getCell(r, c).border = GARI;
      }
    }
  });

  // --- Data mulai baris 3 ---
  baris.forEach((b, index) => {
    const n = BARIS_DATA_PERTAMA + index;

    const no = ws.getCell(n, 1);
    no.value = index + 1;
    no.alignment = RATA_TENGAH;
    no.border = GARI;

    const nama = ws.getCell(n, 2);
    nama.value = b.siswa.nama;
    nama.alignment = RATA_KIRI;
    nama.border = GARI;

    // NISN kosong -> sel kosong, bukan teks pengganti.
    const nisn = ws.getCell(n, 3);
    if (b.siswa.nisn) {
      nisn.value = b.siswa.nisn;
      nisn.numFmt = "@";
    }
    nisn.alignment = RATA_KIRI;
    nisn.border = GARI;

    // TTL tidak ada di skema -> sel dibiarkan kosong.
    const ttl = ws.getCell(n, 4);
    ttl.alignment = RATA_KIRI;
    ttl.border = GARI;

    const kelas = ws.getCell(n, 5);
    kelas.value = b.siswa.kelas;
    kelas.alignment = RATA_TENGAH;
    kelas.border = GARI;

    mapelNama.forEach((m, i) => {
      const awal = kolomMapel(i);
      const nilai = b.nilai.get(m);

      const selNilai = ws.getCell(n, awal);
      const selPredikat = ws.getCell(n, awal + 1);
      const selDeskripsi = ws.getCell(n, awal + 2);

      // Mapel tanpa nilai: ketiga sel kosong, tanpa teks pengganti.
      if (nilai !== undefined) {
        selNilai.value = nilai;
        selNilai.numFmt = "0";
        selPredikat.value = predikatDenganKeterangan(predikat(nilai));
        selDeskripsi.value = deskripsiNilai(nilai);
      }

      selNilai.alignment = RATA_TENGAH;
      selPredikat.alignment = RATA_TENGAH;
      selDeskripsi.alignment = RATA_TENGAH;
      selNilai.border = GARI;
      selPredikat.border = GARI;
      selDeskripsi.border = GARI;
    });
  });

  // --- Lebar kolom ---
  LEBAR_IDENTITAS.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });
  mapelNama.forEach((_, i) => {
    LEBAR_MAPEL.forEach((w, j) => {
      ws.getColumn(kolomMapel(i) + j).width = w;
    });
  });

  // --- Pengaturan cetak ---
  // 53 kolom dipaksakan ke 1 halaman lebar A3 hanya menghasilkan huruf
  // ~3,4pt saat dicetak (diukur lewat konversi ke PDF), jadi muat 2 halaman
  // lebar: huruf jadi ~6,8pt dan masih terbaca. Sebagai gantinya, kolom NO dan
  // NAMA diulang di halaman kanan supaya baris siswa tetap bisa dikenali.
  // Tinggi bebas (fitToHeight 0) supaya 128 baris tidak dipengecilkan lagi.
  const barisAkhir = BARIS_DATA_PERTAMA - 1 + baris.length;
  ws.pageSetup = {
    paperSize: KERTAS_A3,
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 2,
    fitToHeight: 0,
    printArea: `A1:${kolomKe(totalKolom)}${barisAkhir}`,
    // Ulangi dua baris header dan kolom identitas di tiap halaman cetak.
    printTitlesRow: `${BARIS_HEADER_MAPEL}:${BARIS_HEADER_SUB}`,
    printTitlesColumn: "A:B",
    horizontalCentered: true,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
  };

  // Nama dan header mapel tetap terlihat saat menggulir ke bawah/ke kanan.
  ws.views = [{ state: "frozen", xSplit: 2, ySplit: BARIS_HEADER_SUB }];
}

/** Konversi nomor kolom (1) menjadi huruf: 1 -> A, 21 -> U, 53 -> BA. */
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

export async function generateRingkasan(
  baris: RingkasanBaris[],
  mapelNama: string[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet("Ringkasan");
  isiSheetRingkasan(ws, baris, mapelNama);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}