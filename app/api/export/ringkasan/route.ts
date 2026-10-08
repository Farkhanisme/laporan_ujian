import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { urutanMapel, urutanSiswa } from "@/lib/urutan";
import {
  generateRingkasan,
  type RingkasanBaris,
  type RingkasanSiswa,
} from "@/lib/excel-ringkasan";

// 128 baris × 21 kolom; butuh waktu lebih lama dari export biasa.
export const maxDuration = 300;

interface JoinedRow {
  siswaId: number;
  nama: string;
  nisn: string | null;
  kelas: string;
  mapel: string;
  nilai_asli: number;
  nilai_dongkrak: number | null;
}

export async function GET() {
  try {
    // Satu query untuk seluruh data (bukan satu query per mapel).
    const res = await db().execute({
      sql: `SELECT s.id AS siswaId, s.nama, s.nisn, s.kelas,
                   m.nama AS mapel, n.nilai_asli, n.nilai_dongkrak
            FROM nilai n
            JOIN siswa s ON s.id = n.siswa_id
            JOIN mapel m ON m.id = n.mapel_id`,
      args: [],
    });

    const rows = res.rows as unknown as JoinedRow[];

    // Kumpulkan nama mapel unik dan urutkan, menentukan urutan kolom.
    const setMapel = new Set<string>();
    for (const r of rows) setMapel.add(r.mapel);
    const mapelNama = [...setMapel].sort(urutanMapel);

    // Kelompokkan nilai per siswa.
    const grouped = new Map<number, RingkasanBaris>();
    for (const r of rows) {
      // Nilai akhir: sama seperti yang tampil di raport.
      const nilai_akhir = r.nilai_dongkrak ?? r.nilai_asli;

      let entry = grouped.get(r.siswaId);
      if (!entry) {
        entry = {
          siswa: { id: r.siswaId, nama: r.nama, nisn: r.nisn, kelas: r.kelas } as RingkasanSiswa,
          nilai: new Map<string, number>(),
        };
        grouped.set(r.siswaId, entry);
      }
      entry.nilai.set(r.mapel, nilai_akhir);
    }

    // Urutan kelas lalu nama, sama seperti raport dan daftar siswa.
    const baris = [...grouped.values()].sort((a, b) =>
      urutanSiswa(a.siswa, b.siswa)
    );

    const buffer = await generateRingkasan(baris, mapelNama);
    const filename = "ringkasan_nilai_ASTS_GANJIL_2026-2027.xlsx";

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("GET /api/export/ringkasan:", error);
    return NextResponse.json({ ok: false, error: "Gagal membuat ringkasan nilai." }, { status: 500 });
  }
}