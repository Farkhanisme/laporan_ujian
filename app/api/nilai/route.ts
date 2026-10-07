import { NextRequest, NextResponse } from "next/server";
import type { InValue } from "@libsql/client";
import { db } from "@/lib/db";
import { validasiNilaiBatch } from "@/lib/validasi";
import { predikat } from "@/lib/predikat";
import { urutanSiswa, urutanMapel } from "@/lib/urutan";


export interface NilaiApiRow {
  nilaiId: number;
  siswaId: number;
  siswa: string;
  kelas: string;
  mapelId: number;
  mapel: string;
  nilai_asli: number;
  nilai_dongkrak: number | null;
  nilai_akhir: number;
  predikat: string;
}

interface RawRow {
  nilaiId: number;
  siswaId: number;
  siswa: string;
  kelas: string;
  mapelId: number;
  mapel: string;
  nilai_asli: number;
  nilai_dongkrak: number | null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const kelas = searchParams.get("kelas");
    const siswaId = searchParams.get("siswaId");
    const mapel = searchParams.get("mapel")?.trim();

    const where: string[] = [];
    const args: InValue[] = [];

    if (kelas && kelas !== "semua") {
      where.push("s.kelas = ?");
      args.push(kelas);
    }
    if (siswaId) {
      where.push("s.id = ?");
      args.push(Number(siswaId));
    }
    if (mapel) {
      where.push("m.nama = ?");
      args.push(mapel);
    }

    const sql = `
      SELECT n.id          AS nilaiId,
             s.id          AS siswaId,
             s.nama        AS siswa,
             s.kelas       AS kelas,
             m.id          AS mapelId,
             m.nama        AS mapel,
             n.nilai_asli  AS nilai_asli,
             n.nilai_dongkrak AS nilai_dongkrak
      FROM nilai n
      JOIN siswa s ON s.id = n.siswa_id
      JOIN mapel m ON m.id = n.mapel_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    `;

    const result = await db().execute({ sql, args });
    const raw = result.rows as unknown as RawRow[];

    const data: NilaiApiRow[] = raw
      .map((r) => {
        const nilai_akhir = r.nilai_dongkrak ?? r.nilai_asli;
        return {
          ...r,
          nilai_akhir,
          predikat: predikat(nilai_akhir),
        };
      })
      .sort((a, b) => {
        const kelasCmp = urutanSiswa({ kelas: a.kelas, nama: a.siswa }, { kelas: b.kelas, nama: b.siswa });
        if (kelasCmp !== 0) return kelasCmp;
        return urutanMapel(a.mapel, b.mapel);
      });

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error("GET /api/nilai:", error);
    return NextResponse.json({ ok: false, error: "Gagal memuat data nilai." }, { status: 500 });
  }
}

interface AturanRow {
  nilai_awal: number;
  nilai_akhir: number;
  nilai_target: number;
}

async function ambilAturan(): Promise<AturanRow | null> {
  const res = await db().execute({
    sql: "SELECT nilai_awal, nilai_akhir, nilai_target FROM aturan_dongkrak WHERE id = 1",
    args: [],
  });
  return (res.rows[0] as unknown as AturanRow) ?? null;
}

export async function PATCH(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body JSON tidak valid." }, { status: 400 });
  }

  const parsed = validasiNilaiBatch(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 }
    );
  }

  const { items } = parsed.data;

  try {
    // Semua baris harus milik siswa yang sama; ini yang menentukan param
    // UPDATE sehingga tidak ada cara menulis nilai baris siswa lain.
    const siswaIds = [...new Set(items.map((i) => i.siswa_id))];
    if (siswaIds.length !== 1) {
      return NextResponse.json(
        { ok: false, error: "Semua nilai harus berasal dari satu siswa." },
        { status: 400 }
      );
    }
    const siswaId = siswaIds[0];

    const aturan = await ambilAturan();

    // Satu transaksi: simpan nilai_asli lalu hitung ulang nilai_dongkrak
    // untuk baris yang berubah. `AND siswa_id = ?` menjaga agar update hanya
    // menyentuh baris milik siswa tersebut.
    const statements: { sql: string; args: InValue[] }[] = items.map((item) => {
      const nilaiDongkrak =
        aturan && item.nilai_asli >= aturan.nilai_awal && item.nilai_asli <= aturan.nilai_akhir
          ? aturan.nilai_target
          : null;

      return {
        sql: "UPDATE nilai SET nilai_asli = ?, nilai_dongkrak = ? WHERE id = ? AND siswa_id = ?",
        args: [item.nilai_asli, nilaiDongkrak, item.id, siswaId],
      };
    });

    await db().batch(statements, "write");

    // Laporkan kalau ada baris yang tidak cocok (id tidak milik siswa ini),
    // supaya UI bisa memberi tahu alih-alih diam-diam gagal.
    const sisa = await db().execute({
      sql: `SELECT COUNT(*) AS n FROM nilai WHERE siswa_id = ? AND id IN (${items
        .map(() => "?")
        .join(", ")})`,
      args: [siswaId, ...items.map((i) => i.id)],
    });
    const jumlahCocok = Number((sisa.rows[0] as unknown as { n: number }).n);
    const jumlahDitolak = items.length - jumlahCocok;

    return NextResponse.json({
      ok: true,
      data: { jumlah: jumlahCocok, ditolak: jumlahDitolak },
    });
  } catch (error) {
    console.error("PATCH /api/nilai:", error);
    return NextResponse.json({ ok: false, error: "Gagal menyimpan nilai." }, { status: 500 });
  }
}