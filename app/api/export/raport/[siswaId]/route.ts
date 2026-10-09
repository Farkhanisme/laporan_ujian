import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { predikat } from "@/lib/predikat";
import { ambilBatasPredikat } from "@/lib/predikat-db";
import { urutanMapel } from "@/lib/urutan";
import { generateRaportSiswa, type SiswaData, type NilaiRow } from "@/lib/excel";
import { sanitizeFilename } from "@/lib/nama-sheet";


export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ siswaId: string }> }
) {
  const { siswaId } = await params;
  const id = Number(siswaId);

  if (!Number.isInteger(id)) {
    return NextResponse.json({ ok: false, error: "ID siswa tidak valid." }, { status: 400 });
  }

  try {
    const siswaRes = await db().execute({
      sql: "SELECT id, nama, kelas, nis, nisn FROM siswa WHERE id = ?",
      args: [id],
    });
    const row = siswaRes.rows[0] as unknown as SiswaData | undefined;

    if (!row) {
      return NextResponse.json({ ok: false, error: "Siswa tidak ditemukan." }, { status: 404 });
    }

    const nilaiRes = await db().execute({
      sql: `SELECT m.nama AS mapel, n.nilai_asli, n.nilai_dongkrak
            FROM nilai n
            JOIN mapel m ON m.id = n.mapel_id
            WHERE n.siswa_id = ?`,
      args: [id],
    });

    const batas = await ambilBatasPredikat();

    const nilaiRows: NilaiRow[] = (nilaiRes.rows as unknown as Array<{
      mapel: string;
      nilai_asli: number;
      nilai_dongkrak: number | null;
    }>)
      .map((r) => {
        const nilai_akhir = r.nilai_dongkrak ?? r.nilai_asli;
        return { ...r, nilai_akhir, predikat: predikat(nilai_akhir, batas) };
      })
      .sort((a, b) => urutanMapel(a.mapel, b.mapel));

    const buffer = await generateRaportSiswa(row, nilaiRows);
    const filename = sanitizeFilename(`raport_${row.kelas}_${row.nama}.xlsx`);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("GET /api/export/raport/[siswaId]:", error);
    return NextResponse.json({ ok: false, error: "Gagal membuat raport." }, { status: 500 });
  }
}