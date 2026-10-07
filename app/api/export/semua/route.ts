import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { predikat } from "@/lib/predikat";
import { urutanMapel, urutanSiswa } from "@/lib/urutan";
import { generateSemuaNilai, type SiswaData, type NilaiRow } from "@/lib/excel";

// 128 sheet bisa butuh waktu; beri batas yang lebih longgar dari default.
export const maxDuration = 300;

interface JoinedRow {
  siswaId: number;
  nama: string;
  kelas: string;
  nis: string | null;
  nisn: string | null;
  mapel: string;
  nilai_asli: number;
  nilai_dongkrak: number | null;
}

export async function GET() {
  try {
    // Satu query untuk seluruh data (bukan satu query per siswa).
    const res = await db().execute({
      sql: `SELECT s.id AS siswaId, s.nama, s.kelas, s.nis, s.nisn,
                   m.nama AS mapel, n.nilai_asli, n.nilai_dongkrak
            FROM nilai n
            JOIN siswa s ON s.id = n.siswa_id
            JOIN mapel m ON m.id = n.mapel_id`,
      args: [],
    });

    const rows = res.rows as unknown as JoinedRow[];

    const grouped = new Map<number, { siswa: SiswaData; nilai: NilaiRow[] }>();

    for (const r of rows) {
      const nilai_akhir = r.nilai_dongkrak ?? r.nilai_asli;

      let entry = grouped.get(r.siswaId);
      if (!entry) {
        entry = {
          siswa: { id: r.siswaId, nama: r.nama, kelas: r.kelas, nis: r.nis, nisn: r.nisn },
          nilai: [],
        };
        grouped.set(r.siswaId, entry);
      }

      entry.nilai.push({
        mapel: r.mapel,
        nilai_akhir,
        predikat: predikat(nilai_akhir),
      });
    }

    const allData = [...grouped.values()]
      .map((entry) => ({
        ...entry,
        nilai: entry.nilai.sort((a, b) => urutanMapel(a.mapel, b.mapel)),
      }))
      .sort((a, b) => urutanSiswa(a.siswa, b.siswa));

    const buffer = await generateSemuaNilai(allData);
    const filename = "nilai_semua_siswa_ASTS_GANJIL_2026-2027.xlsx";

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("GET /api/export/semua:", error);
    return NextResponse.json({ ok: false, error: "Gagal membuat file nilai." }, { status: 500 });
  }
}