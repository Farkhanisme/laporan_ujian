import { db } from "./db";
import { BATAS_AWAL, type BatasPredikat } from "./predikat";

interface BatasRow {
  min_a: number;
  min_b: number;
  min_c: number;
  batas_tuntas: number;
}

/**
 * Batas predikat yang sedang berlaku.
 *
 * Sidinya server saja: nilainya dibaca dari database, jadi tidak pernah ikut
 * ke bundel klien. Kalau tabel belum ada (migrasi belum dijalankan) atau isinya
 * tidak masuk akal, kembalikan `BATAS_AWAL` supaya aplikasi tetap berjalan
 * daripada gagal total.
 */
export async function ambilBatasPredikat(): Promise<BatasPredikat> {
  try {
    const res = await db().execute({
      sql: "SELECT min_a, min_b, min_c, batas_tuntas FROM batas_predikat WHERE id = 1",
      args: [],
    });

    const row = res.rows[0] as unknown as BatasRow | undefined;
    if (!row) return BATAS_AWAL;

    const batas: BatasPredikat = {
      minA: Number(row.min_a),
      minB: Number(row.min_b),
      minC: Number(row.min_c),
      batasTuntas: Number(row.batas_tuntas),
    };

    // Menurun ketat seperti CHECK di tabel. Kalau datanya rusak, lebih baik pakai
    // bawaan daripada menghasilkan predikat yang tidak masuk akal.
    if (!(batas.minA > batas.minB && batas.minB > batas.minC)) return BATAS_AWAL;

    return batas;
  } catch (error) {
    // Tabel belum ada kalau migrasi belum dijalankan: itu kondisi yang wajar,
    // bukan kegagalan. Catat sekali di log supaya mudah dicari kalau memang
    // masalah lain.
    console.warn("Gagal membaca batas_predikat, memakai batas bawaan:", error);
    return BATAS_AWAL;
  }
}