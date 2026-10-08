import ExcelJS from "exceljs";

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

/** Lebar kolom identitas; kolom mapel memakai LEBAR_MAPEL. */
export const LEBAR_IDENTITAS = [5, 34, 12, 12, 8];
export const LEBAR_MAPEL = 8;

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
 * Ringkasan nilai: satu sheet, header di baris 1, data mulai baris 2.
 *
 * Kolom: NO | NAMA | NISN | TTL | KELAS | <satu kolom per mapel>
 * Field yang belum ada (NISN, TTL) dibiarkan kosong — tanpa teks pengganti.
 *
 * @param mapelNama daftar nama mapel, sudah berurutan; menentukan urutan kolom
 */
export function isiSheetRingkasan(
  ws: ExcelJS.Worksheet,
  baris: RingkasanBaris[],
  mapelNama: string[]
) {
  const kolomIdentitas = HEADER_IDENTITAS.length;
  const totalKolom = kolomIdentitas + mapelNama.length;

  // --- Header baris 1 ---
  ws.getRow(1).height = 42;
  HEADER_IDENTITAS.forEach((judul, i) => {
    const cell = ws.getCell(1, i + 1);
    cell.value = judul;
    cell.font = { bold: true };
    cell.alignment = RATA_TENGAH;
    cell.fill = TANPA_LATAR;
    cell.border = GARI;
  });

  mapelNama.forEach((nama, i) => {
    const cell = ws.getCell(1, kolomIdentitas + i + 1);
    cell.value = nama;
    cell.font = { bold: true };
    // Nama mapel membungkus supaya kolom tidak perlu lebar penuh.
    cell.alignment = { ...RATA_TENGAH, wrapText: true };
    cell.fill = TANPA_LATAR;
    cell.border = GARI;
  });

  // --- Data mulai baris 2 ---
  baris.forEach((b, index) => {
    const n = index + 2;

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
      const cell = ws.getCell(n, kolomIdentitas + i + 1);
      const nilai = b.nilai.get(m);
      if (nilai !== undefined) {
        cell.value = nilai;
        cell.numFmt = "0";
      }
      cell.alignment = RATA_TENGAH;
      cell.border = GARI;
    });
  });

  // --- Lebar kolom ---
  LEBAR_IDENTITAS.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });
  mapelNama.forEach((_, i) => {
    ws.getColumn(kolomIdentitas + i + 1).width = LEBAR_MAPEL;
  });

  // --- Pengaturan cetak ---
  // Landscape + hanya lebar yang dipaksakan muat (fitToHeight 0), supaya
  // 128 baris tidak ikut dipengecilkan dua kali dan jadi tidak terbaca.
  const barisAkhir = 1 + baris.length;
  ws.pageSetup = {
    paperSize: 9,
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printArea: `A1:${kolomKe(totalKolom)}${barisAkhir}`,
    horizontalCentered: true,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
  };

  // Header tetap terlihat saat menggulir ke bawah.
  ws.views = [{ state: "frozen", xSplit: 2, ySplit: 1 }];
}

/** Konversi nomor kolom (1) menjadi huruf: 1 -> A, 21 -> U. */
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