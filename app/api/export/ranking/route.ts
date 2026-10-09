import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hitungRanking, type BarisNilai } from "@/lib/ranking";
import {
  generateRanking,
  generateRankingSemuaMapel,
  type SheetRankingMapel,
} from "@/lib/excel-ranking";
import { sanitizeFilename } from "@/lib/nama-sheet";
import { urutanMapel } from "@/lib/urutan";

interface JoinedRow {
  siswaId: number;
  nama: string;
  kelas: string;
  mapel: string;
  nilai_dongkrak: number | null;
  nilai_asli: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const kelas = searchParams.get("kelas")?.trim();

    if (!kelas) {
      return NextResponse.json(
        { ok: false, error: "Parameter kelas wajib diisi." },
        { status: 400 }
      );
    }

    // Ranking per mapel memakai parameter `perMapel=1`, bukan `mapel=IPA`.
    // Alasannya: mode ini sengaja menghasilkan SATU SHEET PER MAPEL, jadi nama
    // mapel yang sedang dipilih di layar tidak boleh ikut menyaring data.
    // Kalau memakai `mapel=`, Excel hanya berisi satu sheet — persis kebalikan
    // dari yang dibutuhkan.
    const perMapelDiminta = searchParams.get("perMapel") === "1";

    const result = await db().execute({
      sql: `SELECT s.id AS siswaId,
                   s.nama,
                   s.kelas,
                   m.nama AS mapel,
                   n.nilai_asli,
                   n.nilai_dongkrak
            FROM nilai n
            JOIN siswa s ON s.id = n.siswa_id
            JOIN mapel m ON m.id = n.mapel_id
            WHERE s.kelas = ?`,
      args: [kelas],
    });

    // Satu query untuk seluruh kelas. Nilai dikelompokkan per mapel sekali
    // saja, lalu kedua mode memakai kelompok yang sama — tidak ada nilai yang
    // dihitung dua kali dengan cara berbeda.
    const perMapel = new Map<string, BarisNilai[]>();
    for (const r of result.rows as unknown as JoinedRow[]) {
      const nilai = r.nilai_dongkrak ?? r.nilai_asli;
      let list = perMapel.get(r.mapel);
      if (!list) {
        list = [];
        perMapel.set(r.mapel, list);
      }
      list.push({
        siswaId: r.siswaId,
        nama: r.nama,
        kelas: r.kelas,
        nilai_akhir: nilai,
      });
    }

    let buffer: Buffer;
    let filename: string;

    if (perMapelDiminta) {
      // Mode per mapel: satu sheet untuk SETIAP mapel yang ada nilainya di
      // kelas ini, masing-masing berisi ranking siswa pada mapel itu. Nama
      // berkas memakai `_per_mapel` supaya tidak menimpa mode rata-rata.
      const daftar: SheetRankingMapel[] = [...perMapel.entries()]
        // Urut abjad, sama seperti urutan kolom mapel di seluruh aplikasi.
        .sort((a, b) => urutanMapel(a[0], b[0]))
        .map(([namaMapel, baris]) => ({
          mapel: namaMapel,
          baris: hitungRanking(baris),
        }));

      buffer = await generateRankingSemuaMapel(daftar, kelas);
      filename = `ranking_nilai_kelas_${kelas}_per_mapel_ASTS_GANJIL_2026-2027.xlsx`;
    } else {
      // Mode rata-rata: satu sheet, ranking dari seluruh mapel.
      const semuaBaris = [...perMapel.values()].flat();
      buffer = await generateRanking(hitungRanking(semuaBaris), kelas);
      filename = `ranking_nilai_kelas_${kelas}_ASTS_GANJIL_2026-2027.xlsx`;
    }

    // Kelas ikut ke nama berkas supaya unduhan beberapa kelas tidak tertimpa.
    const filenameAman = sanitizeFilename(filename);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filenameAman}"`,
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