import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hitungPeringkatSemua, type BarisNilaiLengkap } from "@/lib/ranking";
import { generatePeringkat } from "@/lib/excel-peringkat";
import { urutanMapel } from "@/lib/urutan";

interface JoinedRow {
  siswaId: number;
  nama: string;
  kelas: string;
  mapel: string;
  nilai_dongkrak: number | null;
  nilai_asli: number;
}

/**
 * GET /api/export/peringkat
 *
 * Peringkat seluruh siswa dalam satu sheet: satu baris per siswa, satu kolom
 * per mapel berisi peringkat pada mapel itu, dan kolom terakhir berisi
 * peringkat dari rata-rata seluruh mapel. Semuanya dihitung DI DALAM satu
 * kelas, jadi "dari N" memakai jumlah murid kelas tersebut.
 */
export async function GET() {
  try {
    const result = await db().execute({
      sql: `SELECT s.id AS siswaId,
                   s.nama,
                   s.kelas,
                   m.nama AS mapel,
                   n.nilai_asli,
                   n.nilai_dongkrak
            FROM nilai n
            JOIN siswa s ON s.id = n.siswa_id
            JOIN mapel m ON m.id = n.mapel_id`,
      args: [],
    });

    const rows = result.rows as unknown as JoinedRow[];

    // Nilai akhir: sama seperti raport, ringkasan, dan halaman Nilai.
    const barisNilai: BarisNilaiLengkap[] = rows.map((r) => ({
      siswaId: r.siswaId,
      nama: r.nama,
      kelas: r.kelas,
      mapel: r.mapel,
      nilai_akhir: r.nilai_dongkrak ?? r.nilai_asli,
    }));

    // Daftar mapel diambil dari data, bukan dari daftar tetap, supaya mapel baru
    // ikut jadi kolom tanpa perlu mengubah kode.
    const setMapel = new Set<string>();
    for (const r of rows) setMapel.add(r.mapel);
    const mapelNama = [...setMapel].sort(urutanMapel);

    // Pembagi "dari N": jumlah murid unik per kelas, dihitung sekali.
    const jumlahSiswaKelas = new Map<string, number>();
    const siswaUnik = new Set<string>();
    for (const r of rows) {
      const kunci = `${r.kelas}\u0000${r.siswaId}`;
      if (siswaUnik.has(kunci)) continue;
      siswaUnik.add(kunci);
      jumlahSiswaKelas.set(r.kelas, (jumlahSiswaKelas.get(r.kelas) ?? 0) + 1);
    }

    const baris = hitungPeringkatSemua(barisNilai);
    const buffer = await generatePeringkat(baris, mapelNama, jumlahSiswaKelas);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="peringkat_semua_siswa_ASTS_GANJIL_2026-2027.xlsx"`,
      },
    });
  } catch (error) {
    console.error("GET /api/export/peringkat:", error);
    return NextResponse.json(
      { ok: false, error: "Gagal membuat daftar peringkat." },
      { status: 500 }
    );
  }
}