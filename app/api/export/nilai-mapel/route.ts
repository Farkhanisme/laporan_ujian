import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { urutanSiswa } from "@/lib/urutan";
import { generateNilaiMapel, type BarisNilaiMapel } from "@/lib/excel-nilai-mapel";
import { sanitizeFilename } from "@/lib/nama-sheet";
import { ambilBatasPredikat } from "@/lib/predikat-db";

interface JoinedRow {
  nama: string;
  nisn: string | null;
  kelas: string;
  nilai_asli: number;
  nilai_dongkrak: number | null;
}

/**
 * GET /api/export/nilai-mapel?kelas=7A&mapel=Matematika
 *
 * Nilai satu kelas untuk SATU mapel, satu sheet. Berbeda dari `/api/export/
 * semua` (satu sheet per siswa) dan `/api/export/ringkasan` (semua mapel dalam
 * satu sheet lebar): berkas ini menjawab "siapa nilai IPA di kelas 7A?".
 *
 * Query-nya sama dengan `GET /api/nilai` untuk kombinasi kelas + mapel yang
 * sama, jadi isi berkas tidak mungkin berbeda dari yang tampil di layar.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const kelas = searchParams.get("kelas")?.trim();
    const mapel = searchParams.get("mapel")?.trim();

    if (!kelas) {
      return NextResponse.json(
        { ok: false, error: "Parameter kelas wajib diisi." },
        { status: 400 }
      );
    }

    // `mapel` wajib diisi, bukan opsional: satu mapel per berkas. Nilai "semua"
    // yang dikirim layar berarti "belum memilih mapel", jadi ditolak di sini
    // alih-alih mengunduh seluruh mapel tanpa diminta.
    if (!mapel) {
      return NextResponse.json(
        { ok: false, error: "Parameter mapel wajib diisi." },
        { status: 400 }
      );
    }

    const result = await db().execute({
      sql: `SELECT s.nama,
                   s.nisn,
                   s.kelas,
                   m.nama AS mapel,
                   n.nilai_asli,
                   n.nilai_dongkrak
            FROM nilai n
            JOIN siswa s ON s.id = n.siswa_id
            JOIN mapel m ON m.id = n.mapel_id
            WHERE s.kelas = ? AND m.nama = ?`,
      args: [kelas, mapel],
    });

    const baris: BarisNilaiMapel[] = (result.rows as unknown as JoinedRow[])
      .map((r) => ({
        nama: r.nama,
        nisn: r.nisn,
        kelas: r.kelas,
        nilai_asli: r.nilai_asli,
        nilai_dongkrak: r.nilai_dongkrak,
        // Nilai akhir: sama dengan raport, ringkasan, dan halaman Nilai.
        nilai_akhir: r.nilai_dongkrak ?? r.nilai_asli,
      }))
      // Urut kelas lalu nama, sama seperti halaman Nilai dan daftar siswa.
      .sort((a, b) => urutanSiswa(a, b));

    const buffer = await generateNilaiMapel(baris, kelas, mapel, await ambilBatasPredikat());

    // Kelas dan mapel ikut ke nama berkas supaya unduhan beberapa kelas atau
    // mapel tidak saling menimpa. Spasi diganti garis bawah karena nama mapel
    // berispasi, misalnya "Bahasa Indonesia".
    const filename = sanitizeFilename(
      `nilai_kelas_${kelas}_${mapel.replace(/\s+/g, "_")}_ASTS_GANJIL_2026-2027.xlsx`
    );

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("GET /api/export/nilai-mapel:", error);
    return NextResponse.json(
      { ok: false, error: "Gagal membuat file nilai mapel." },
      { status: 500 }
    );
  }
}