import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { urutanMapel, TINGKAT } from "@/lib/urutan";
import { validasiMapelBaru } from "@/lib/validasi";
import type { InValue } from "@libsql/client";

export interface Mapel {
  id: number;
  nama: string;
  tingkat: number;
  kode: string;
}

/** Mapel unik berdasarkan nama (dikelompokkan lintas tingkat). */
export interface MapelGrup {
  nama: string;
  kode: string;
  tingkat: number[];
  jumlahNilai: number;
}

export async function GET() {
  try {
    const res = await db().execute({
      sql: `SELECT m.nama AS nama, m.kode AS kode, m.tingkat AS tingkat,
                   COUNT(n.id) AS jumlahNilai
            FROM mapel m
            LEFT JOIN nilai n ON n.mapel_id = m.id
            GROUP BY m.nama, m.kode, m.tingkat
            ORDER BY m.nama`,
      args: [],
    });

    const rows = res.rows as unknown as Array<{
      nama: string;
      kode: string;
      tingkat: number;
      jumlahNilai: number;
    }>;

    // Kelompokkan baris per nama supaya UI bisa menampilkan satu baris mapel
    // walau di database ada satu baris per tingkat.
    const grup = new Map<string, MapelGrup>();
    for (const r of rows) {
      let g = grup.get(r.nama);
      if (!g) {
        g = { nama: r.nama, kode: r.kode, tingkat: [], jumlahNilai: 0 };
        grup.set(r.nama, g);
      }
      g.tingkat.push(r.tingkat);
      g.jumlahNilai += Number(r.jumlahNilai);
    }

    const data = [...grup.values()]
      .map((g) => ({
        ...g,
        tingkat: [...g.tingkat].sort((a, b) => a - b),
      }))
      .sort((a, b) => urutanMapel(a.nama, b.nama));

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error("GET /api/mapel:", error);
    return NextResponse.json({ ok: false, error: "Gagal memuat data mapel." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body JSON tidak valid." }, { status: 400 });
  }

  const parsed = validasiMapelBaru(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 }
    );
  }

  const { nama, kode } = parsed.data;

  try {
    // Nama sudah dipakai di tingkat mana pun?
    const bentrok = await db().execute({
      sql: "SELECT tingkat FROM mapel WHERE LOWER(nama) = LOWER(?)",
      args: [nama],
    });
    if (bentrok.rows.length > 0) {
      return NextResponse.json(
        { ok: false, error: "Mata pelajaran dengan nama tersebut sudah ada." },
        { status: 409 }
      );
    }

    // Satu transaksi: 3 baris mapel (satu per tingkat) + 1 baris nilai
    // untuk setiap siswa, semuanya atomik.
    const statements: { sql: string; args: InValue[] }[] = [];

    for (const tingkat of TINGKAT) {
      statements.push({
        sql: "INSERT INTO mapel (nama, tingkat, kode) VALUES (?, ?, ?)",
        args: [nama, tingkat, kode || `${nama} TINGKAT ${tingkat}`.toUpperCase().slice(0, 60)],
      });
    }

    statements.push({
      sql: `INSERT INTO nilai (siswa_id, mapel_id, nilai_asli)
            SELECT s.id, m.id, 0
            FROM siswa s
            JOIN mapel m
              ON m.tingkat = CAST(SUBSTR(s.kelas, 1, 1) AS INTEGER)
             AND LOWER(m.nama) = LOWER(?)
            WHERE NOT EXISTS (
              SELECT 1 FROM nilai n WHERE n.siswa_id = s.id AND n.mapel_id = m.id
            )`,
      args: [nama],
    });

    await db().batch(statements, "write");

    const hasil = await db().execute({
      sql: `SELECT (SELECT COUNT(*) FROM mapel WHERE LOWER(nama) = LOWER(?)) AS mapel,
                   (SELECT COUNT(*) FROM nilai n
                      JOIN mapel m ON m.id = n.mapel_id
                     WHERE LOWER(m.nama) = LOWER(?)) AS nilai`,
      args: [nama, nama],
    });

    const row = hasil.rows[0] as unknown as { mapel: number; nilai: number };

    return NextResponse.json({
      ok: true,
      data: {
        nama,
        mapelDitambah: Number(row.mapel),
        nilaiDitambah: Number(row.nilai),
      },
    });
  } catch (error) {
    console.error("POST /api/mapel:", error);
    return NextResponse.json({ ok: false, error: "Gagal menambah mata pelajaran." }, { status: 500 });
  }
}