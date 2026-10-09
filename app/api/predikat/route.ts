import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ambilBatasPredikat } from "@/lib/predikat-db";
import { BATAS_AWAL, batasAtas, predikat, type BatasPredikat } from "@/lib/predikat";
import { validasiBatasPredikat } from "@/lib/validasi";
import type { InValue } from "@libsql/client";

/** Jumlah nilai akhir per predikat, dipakai untuk pratinjau dan status. */
export interface SebarPredikat {
  A: number;
  B: number;
  C: number;
  D: number;
}

interface NilaiRow {
  nilai_akhir: number;
}

/**
 * Hitung sebaran nilai akhir berdasarkan batas tertentu.
 *
 * Menghitung ulang tiap nilai, bukan menambah penghitung per predikat, supaya
 * batas yang dipratinjau benar-benar dipakai — bukan hanya "prediksi" dari
 * sebaran lama.
 */
export async function sebarNilai(batas: BatasPredikat): Promise<SebarPredikat> {
  const res = await db().execute({
    sql: "SELECT COALESCE(nilai_dongkrak, nilai_asli) AS nilai_akhir FROM nilai",
    args: [],
  });

  const sebar: SebarPredikat = { A: 0, B: 0, C: 0, D: 0 };
  for (const r of res.rows as unknown as NilaiRow[]) {
    sebar[predikat(Number(r.nilai_akhir), batas)] += 1;
  }
  return sebar;
}

/** Batas + rentang tiap predikat, supaya UI tidak menghitung ulang sendiri. */
export function ringkasanBatas(batas: BatasPredikat) {
  return (["A", "B", "C", "D"] as const).map((p) => ({
    predikat: p,
    bawah: p === "D" ? 0 : batas[`min${p}` as "minA" | "minB" | "minC"],
    atas: batasAtas(p, batas),
  }));
}

/** GET /api/predikat — batas yang berlaku + sebaran sekarang. */
export async function GET() {
  try {
    const batas = await ambilBatasPredikat();
    const sebar = await sebarNilai(batas);

    return NextResponse.json({
      ok: true,
      data: {
        batas,
        rentang: ringkasanBatas(batas),
        sebar,
        batasAwal: BATAS_AWAL,
        // Tandai kalau yang berlaku masih bawaan, supaya UI bisa menyodorkan
        // tombol "kembalikan ke awal" hanya saat memang perlu.
        memakaiBawaan:
          batas.minA === BATAS_AWAL.minA &&
          batas.minB === BATAS_AWAL.minB &&
          batas.minC === BATAS_AWAL.minC &&
          batas.batasTuntas === BATAS_AWAL.batasTuntas,
      },
    });
  } catch (error) {
    console.error("GET /api/predikat:", error);
    return NextResponse.json(
      { ok: false, error: "Gagal memuat pengaturan predikat." },
      { status: 500 }
    );
  }
}

/** PUT /api/predikat — menyimpan batas baru. */
export async function PUT(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body JSON tidak valid." }, { status: 400 });
  }

  const parsed = validasiBatasPredikat(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 }
    );
  }

  const { minA, minB, minC, batasTuntas } = parsed.data;

  try {
    const statements: { sql: string; args: InValue[] }[] = [
      {
        sql: `INSERT INTO batas_predikat
                (id, min_a, min_b, min_c, batas_tuntas, diperbarui_pada)
              VALUES (1, ?, ?, ?, ?, ?)
              ON CONFLICT (id) DO UPDATE SET
                min_a = excluded.min_a,
                min_b = excluded.min_b,
                min_c = excluded.min_c,
                batas_tuntas = excluded.batas_tuntas,
                diperbarui_pada = excluded.diperbarui_pada`,
        args: [minA, minB, minC, batasTuntas, new Date().toISOString()],
      },
    ];

    await db().batch(statements, "write");

    const batas: BatasPredikat = { minA, minB, minC, batasTuntas };
    return NextResponse.json({
      ok: true,
      data: { batas, rentang: ringkasanBatas(batas), sebar: await sebarNilai(batas) },
    });
  } catch (error) {
    console.error("PUT /api/predikat:", error);
    return NextResponse.json(
      { ok: false, error: "Gagal menyimpan pengaturan predikat." },
      { status: 500 }
    );
  }
}

/** DELETE /api/predikat — kembalikan ke batas bawaan. */
export async function DELETE() {
  try {
    await db().batch(
      [
        {
          sql: `INSERT INTO batas_predikat
                  (id, min_a, min_b, min_c, batas_tuntas, diperbarui_pada)
                VALUES (1, ?, ?, ?, ?, ?)
                ON CONFLICT (id) DO UPDATE SET
                  min_a = excluded.min_a,
                  min_b = excluded.min_b,
                  min_c = excluded.min_c,
                  batas_tuntas = excluded.batas_tuntas,
                  diperbarui_pada = excluded.diperbarui_pada`,
          args: [
            BATAS_AWAL.minA,
            BATAS_AWAL.minB,
            BATAS_AWAL.minC,
            BATAS_AWAL.batasTuntas,
            new Date().toISOString(),
          ],
        },
      ],
      "write"
    );

    return NextResponse.json({
      ok: true,
      data: {
        batas: BATAS_AWAL,
        rentang: ringkasanBatas(BATAS_AWAL),
        sebar: await sebarNilai(BATAS_AWAL),
      },
    });
  } catch (error) {
    console.error("DELETE /api/predikat:", error);
    return NextResponse.json(
      { ok: false, error: "Gagal mengembalikan pengaturan predikat." },
      { status: 500 }
    );
  }
}