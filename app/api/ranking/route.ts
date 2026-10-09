import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/** Satu nilai akhir siswa pada satu mapel, sesuai bentuk `lib/ranking.ts`. */
export interface RankingApiRow {
  siswaId: number;
  nama: string;
  kelas: string;
  nilai_akhir: number;
}

interface JoinedRow {
  siswaId: number;
  nama: string;
  kelas: string;
  nilai_dongkrak: number | null;
  nilai_asli: number;
}

/**
 * GET /api/ranking?kelas=7A
 *
 * Mengembalikan nilai akhir MENTAH, bukan peringkat yang sudah jadi.
 * `hitungRanking` dipanggil di sisi klien dan di ekspor Excel, jadi tidak ada
 * dua tempat yang bisa menghitung peringkat berbeda.
 */
export async function GET(request: NextRequest) {
  try {
    const kelas = new URL(request.url).searchParams.get("kelas")?.trim();

    // Tanpa kelas tidak ada ranking yang bermakna (peringkat selalu dihitung
    // di dalam satu kelas), jadi parameter kelas wajib diisi.
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

    // Nilai akhir: sama seperti raport, ringkasan, dan halaman Nilai.
    const data: RankingApiRow[] = (result.rows as unknown as JoinedRow[])
      .map((r) => ({
        siswaId: r.siswaId,
        nama: r.nama,
        kelas: r.kelas,
        nilai_akhir: r.nilai_dongkrak ?? r.nilai_asli,
      }));

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error("GET /api/ranking:", error);
    return NextResponse.json(
      { ok: false, error: "Gagal memuat data ranking." },
      { status: 500 }
    );
  }
}