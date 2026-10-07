import { NextRequest, NextResponse } from "next/server";
import type { InValue } from "@libsql/client";
import { db } from "@/lib/db";
import { validasiSiswa } from "@/lib/validasi";
import { bisaPindahKelas } from "@/lib/urutan";


interface SiswaRow {
  id: number;
  nis: string | null;
  nisn: string | null;
  nama: string;
  kelas: string;
}

async function ambilSiswa(id: number): Promise<SiswaRow | null> {
  const res = await db().execute({
    sql: "SELECT id, nis, nisn, nama, kelas FROM siswa WHERE id = ?",
    args: [id],
  });
  return (res.rows[0] as unknown as SiswaRow) ?? null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const siswaId = Number(id);

  if (!Number.isInteger(siswaId)) {
    return NextResponse.json({ ok: false, error: "ID siswa tidak valid." }, { status: 400 });
  }

  try {
    const siswa = await ambilSiswa(siswaId);
    if (!siswa) {
      return NextResponse.json({ ok: false, error: "Siswa tidak ditemukan." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data: siswa });
  } catch (error) {
    console.error("GET /api/siswa/[id]:", error);
    return NextResponse.json({ ok: false, error: "Gagal memuat data siswa." }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const siswaId = Number(id);

  if (!Number.isInteger(siswaId)) {
    return NextResponse.json({ ok: false, error: "ID siswa tidak valid." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body JSON tidak valid." }, { status: 400 });
  }

  const parsed = validasiSiswa(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 }
    );
  }

  const input = parsed.data;

  try {
    const existing = await ambilSiswa(siswaId);
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Siswa tidak ditemukan." }, { status: 404 });
    }

    // Kelas hanya boleh berpindah dalam tingkat yang sama.
    if (input.kelas !== existing.kelas && !bisaPindahKelas(existing.kelas, input.kelas)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Perpindahan antar tingkat tidak didukung karena nilai terikat pada mapel tingkatnya.",
        },
        { status: 400 }
      );
    }

    // (nama, kelas) harus unik.
    const dup = await db().execute({
      sql: "SELECT id FROM siswa WHERE nama = ? AND kelas = ? AND id <> ?",
      args: [input.nama, input.kelas, siswaId],
    });
    if (dup.rows.length > 0) {
      return NextResponse.json(
        { ok: false, error: "Siswa dengan nama dan kelas tersebut sudah ada." },
        { status: 409 }
      );
    }

    // NIS / NISN unik bila terisi.
    if (input.nis !== null) {
      const dupNis = await db().execute({
        sql: "SELECT id FROM siswa WHERE nis = ? AND id <> ?",
        args: [input.nis as InValue, siswaId],
      });
      if (dupNis.rows.length > 0) {
        return NextResponse.json({ ok: false, error: "NIS sudah dipakai siswa lain." }, { status: 409 });
      }
    }

    if (input.nisn !== null) {
      const dupNisn = await db().execute({
        sql: "SELECT id FROM siswa WHERE nisn = ? AND id <> ?",
        args: [input.nisn as InValue, siswaId],
      });
      if (dupNisn.rows.length > 0) {
        return NextResponse.json({ ok: false, error: "NISN sudah dipakai siswa lain." }, { status: 409 });
      }
    }

    await db().execute({
      sql: "UPDATE siswa SET nama = ?, kelas = ?, nis = ?, nisn = ? WHERE id = ?",
      args: [input.nama, input.kelas, input.nis as InValue, input.nisn as InValue, siswaId],
    });

    const updated = await ambilSiswa(siswaId);
    return NextResponse.json({ ok: true, data: updated });
  } catch (error) {
    console.error("PATCH /api/siswa/[id]:", error);
    return NextResponse.json({ ok: false, error: "Gagal menyimpan data siswa." }, { status: 500 });
  }
}