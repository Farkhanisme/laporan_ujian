import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hitungRanking, type BarisNilai } from "@/lib/ranking";
import { generateRanking } from "@/lib/excel-ranking";
import { sanitizeFilename } from "@/lib/nama-sheet";

interface JoinedRow {
  siswaId: number;
  nama: string;
  kelas: string;
  nilai_dongkrak: number | null;
  nilai_asli: number;
}

export async function GET(request: NextRequest) {
  try {
    const kelas = new URL(request.url).searchParams.get("kelas")?.trim();

    if (!kelas) {
      return NextResponse.json(
        { ok: false, error: "Parameter kelas wajib diisi." },
        { status: 400 }
      );
    }

    const result = await db().execute({
      sql: `SELECT s.id AS siswaId,
                   s.nama,
                   s.kelas,
                   n.nilai_asli,
                   n.nilai_dongkrak
            FROM nilai n
            JOIN siswa s ON s.id = n.siswa_id
            WHERE s.kelas = ?`,
      args: [kelas],
    });

    // Satu query untuk seluruh kelas, lalu peringkat dihitung dengan fungsi
    // yang sama seperti di layar (`hitungRanking`).
    const barisNilai: BarisNilai[] = (result.rows as unknown as JoinedRow[]).map((r) => ({
      siswaId: r.siswaId,
      nama: r.nama,
      kelas: r.kelas,
      nilai_akhir: r.nilai_dongkrak ?? r.nilai_asli,
    }));

    const baris = hitungRanking(barisNilai);
    const buffer = await generateRanking(baris, kelas);

    // Kelas ikut ke nama berkas supaya unduhan beberapa kelas tidak tertimpa.
    const filename = sanitizeFilename(`ranking_nilai_kelas_${kelas}_ASTS_GANJIL_2026-2027.xlsx`);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("GET /api/export/ranking:", error);
    return NextResponse.json(
      { ok: false, error: "Gagal membuat ranking nilai." },
      { status: 500 }
    );
  }
}