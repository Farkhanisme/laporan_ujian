import type ExcelJS from "exceljs";

/**
 * A3 tidak ada di enum `PaperSize` ExcelJS (yang isinya A4 = 9), tapi angka 8
 * tetap ditulis apa adanya ke XML dan dibaca Excel sebagai A3.
 *
 * Dipakai bersama oleh sheet yang kolomnya banyak: 53 kolom di Ringkasan dan
 * 20 kolom di Peringkat menghasilkan huruf yang tidak terbaca di A4.
 */
export const KERTAS_A3 = 8 as ExcelJS.PaperSize;

/** Konversi nomor kolom (1) menjadi huruf: 1 -> A, 20 -> T, 53 -> BA. */
export function kolomKe(n: number): string {
  let hasil = "";
  let sisa = n;
  while (sisa > 0) {
    const modulo = (sisa - 1) % 26;
    hasil = String.fromCharCode(65 + modulo) + hasil;
    sisa = Math.floor((sisa - modulo) / 26);
  }
  return hasil;
}