import { NextRequest, NextResponse } from "next/server";
import type { InValue } from "@libsql/client";
import { db } from "@/lib/db";
import { urutanSiswa } from "@/lib/urutan";


export interface Siswa {
  id: number;
  nis: string | null;
  nisn: string | null;
  nama: string;
  kelas: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const kelas = searchParams.get("kelas");
    const q = searchParams.get("q")?.trim();

    const where: string[] = [];
    const args: InValue[] = [];

    if (kelas && kelas !== "semua") {
      where.push("kelas = ?");
      args.push(kelas);
    }
    if (q) {
      where.push("LOWER(nama) LIKE ?");
      args.push(`%${q.toLowerCase()}%`);
    }

    const sql = `
      SELECT id, nis, nisn, nama, kelas
      FROM siswa
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    `;

    const result = await db().execute({ sql, args });
    const data = (result.rows as unknown as Siswa[]).sort(urutanSiswa);

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error("GET /api/siswa:", error);
    return NextResponse.json(
      { ok: false, error: "Gagal memuat data siswa." },
      { status: 500 }
    );
  }
}