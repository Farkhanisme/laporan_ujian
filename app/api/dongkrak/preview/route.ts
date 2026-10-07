import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validasiDongkrak } from "@/lib/validasi";
import { urutanMapel } from "@/lib/urutan";


export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body JSON tidak valid." }, { status: 400 });
  }

  const parsed = validasiDongkrak(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 }
    );
  }

  const { nilai_awal: awal, nilai_akhir: akhir, nilai_target: target } = parsed.data;

  try {
    const stats = await db().execute({
      sql: `SELECT
              COUNT(*) AS total,
              SUM(CASE WHEN nilai_asli = 0 THEN 1 ELSE 0 END) AS nol
            FROM nilai
            WHERE nilai_asli BETWEEN ? AND ?`,
      args: [awal, akhir],
    });

    const row = stats.rows[0] as unknown as { total: number; nol: number | null };
    const jumlahTerdampak = Number(row.total);
    const jumlahNol = Number(row.nol ?? 0);

    const adaDongkrak = await db().execute({
      sql: "SELECT COUNT(*) AS n FROM nilai WHERE nilai_dongkrak IS NOT NULL",
      args: [],
    });
    const jumlahDongkrakAktif = Number((adaDongkrak.rows[0] as unknown as { n: number }).n);

    const contohRaw = await db().execute({
      sql: `SELECT s.nama AS siswa, m.nama AS mapel, n.nilai_asli AS nilai_asli
            FROM nilai n
            JOIN siswa s ON s.id = n.siswa_id
            JOIN mapel m ON m.id = n.mapel_id
            WHERE n.nilai_asli BETWEEN ? AND ?
            ORDER BY n.nilai_asli ASC, s.nama ASC, m.nama ASC
            LIMIT 10`,
      args: [awal, akhir],
    });

    const contoh = (contohRaw.rows as unknown as Array<{ siswa: string; mapel: string; nilai_asli: number }>)
      .sort((a, b) => urutanMapel(a.mapel, b.mapel))
      .map((r) => ({ ...r, nilai_target: target }));

    return NextResponse.json({
      ok: true,
      data: { jumlahTerdampak, jumlahNol, jumlahDongkrakAktif, contoh },
    });
  } catch (error) {
    console.error("POST /api/dongkrak/preview:", error);
    return NextResponse.json({ ok: false, error: "Gagal membuat pratinjau." }, { status: 500 });
  }
}