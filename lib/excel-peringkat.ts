import ExcelJS from "exceljs";
import type { BarisPeringkat } from "./ranking";
import { KERTAS_A3, kolomKe } from "./excel-kertas";

export const HEADER_PERINGKAT = ["NO", "NAMA", "KELAS"] as const;
export const HEADER_KOLOM_AKHIR = "RANKING";

/**
 * Lebar kolom. Kolom mapel harus muat dua hal: teks "12 dari 100" (11 karakter)
 * dan nama mapel terpanjang yang tidak bisa dipisah kata, yaitu "Informatika"
 * (11 karakter). Dengan 13, keduanya muat dan tidak ada judul yang terpotong
 * di tengah kata.
 */
export const LEBAR_PERINGKAT = [5, 32, 8];
export const LEBAR_MAPEL_PERINGKAT = 13;
export const LEBAR_RANKING_AKHIR = 12;

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
 * Peringkat semua siswa: satu sheet, satu baris per siswa.
 *
 * Kolom: NO | NAMA | KELAS | <satu kolom per mapel> | RANKING
 * Isi kolom mapel dan kolom terakhir berupa TEKS "peringkat dari jumlah
 * murid", contoh "3 dari 20". Teks, bukan angka, supaya langsung terbaca dan
 * tidak perlu dibongkar sendiri.
 *
 * @param baris hasil `hitungPeringkatSemua`, sudah terurut
 * @param mapelNama daftar nama mapel, sudah berurutan; menentukan urutan kolom
 * @param jumlahSiswaKelas jumlah murid per kelas, untuk teks "dari N"
 */
export function isiSheetPeringkat(
  ws: ExcelJS.Worksheet,
  baris: BarisPeringkat[],
  mapelNama: string[],
  jumlahSiswaKelas: Map<string, number>
) {
  const kolomAwal = HEADER_PERINGKAT.length + 1;
  const kolomAkhir = kolomAwal + mapelNama.length;

  // --- Header baris 1 ---
  ws.getRow(1).height = 46;
  const judul = [...HEADER_PERINGKAT, ...mapelNama, HEADER_KOLOM_AKHIR];
  judul.forEach((teks, i) => {
    const cell = ws.getCell(1, i + 1);
    cell.value = teks;
    cell.font = { bold: true };
    // Nama mapel membungkus supaya kolom tidak perlu lebar penuh.
    cell.alignment = { ...RATA_TENGAH, wrapText: true };
    cell.fill = TANPA_LATAR;
    cell.border = GARI;
  });

  // --- Data mulai baris 2 ---
  baris.forEach((b, index) => {
    const n = index + 2;
    // "dari N" memakai jumlah murid kelas SISWA itu, bukan jumlah seluruh
    // siswa: 19 siswa di 7A berarti "dari 19" untuk mereka semua.
    const jumlah = jumlahSiswaKelas.get(b.kelas) ?? 0;
    const format = (peringkat: number) => `${peringkat} dari ${jumlah}`;

    const no = ws.getCell(n, 1);
    no.value = index + 1;
    no.alignment = RATA_TENGAH;
    no.border = GARI;

    const nama = ws.getCell(n, 2);
    nama.value = b.nama;
    nama.alignment = RATA_KIRI;
    nama.border = GARI;

    const kelas = ws.getCell(n, 3);
    kelas.value = b.kelas;
    kelas.alignment = RATA_TENGAH;
    kelas.border = GARI;

    mapelNama.forEach((m, i) => {
      const cell = ws.getCell(n, kolomAwal + i);
      const peringkat = b.rankingMapel.get(m);
      // Mapel tanpa nilai untuk siswa ini: sel kosong, tanpa teks pengganti.
      if (peringkat !== undefined) cell.value = format(peringkat);
      cell.alignment = RATA_TENGAH;
      cell.border = GARI;
    });

    const akhir = ws.getCell(n, kolomAkhir);
    akhir.value = format(b.rankingKelas);
    akhir.font = { bold: true };
    akhir.alignment = RATA_TENGAH;
    akhir.border = GARI;
  });

  // --- Lebar kolom ---
  LEBAR_PERINGKAT.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });
  mapelNama.forEach((_, i) => {
    ws.getColumn(kolomAwal + i).width = LEBAR_MAPEL_PERINGKAT;
  });
  ws.getColumn(kolomAkhir).width = LEBAR_RANKING_AKHIR;

  // --- Pengaturan cetak ---
  // 20 kolom di A4 tegak mendatar menghasilkan huruf yang tidak terbaca, jadi
  // A3. Tinggi bebas supaya 128 baris tidak dipengecilkan dua kali, dan baris
  // header diulang di tiap halaman.
  const barisAkhir = 1 + baris.length;
  ws.pageSetup = {
    paperSize: KERTAS_A3,
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printArea: `A1:${kolomKe(kolomAkhir)}${barisAkhir}`,
    printTitlesRow: "1:1",
    horizontalCentered: true,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
  };
}

export async function generatePeringkat(
  baris: BarisPeringkat[],
  mapelNama: string[],
  jumlahSiswaKelas: Map<string, number>
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet("Peringkat");
  isiSheetPeringkat(ws, baris, mapelNama, jumlahSiswaKelas);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}