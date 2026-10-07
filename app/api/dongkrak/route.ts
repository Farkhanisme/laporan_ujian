import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validasiDongkrak } from "@/lib/validasi";


interface AturanRow {
  id: number;
  nilai_awal: number;
  nilai_akhir: number;
  nilai_target: number;
  diterapkan_pada: string;
}

async function ambilAturan(): Promise<AturanRow | null> {
  const res = await db().execute({
    sql: "SELECT id, nilai_awal, nilai_akhir, nilai_target, diterapkan_pada FROM aturan_dongkrak WHERE id = 1",
    args: [],
  });
  return (res.rows[0] as unknown as AturanRow) ?? null;
}

export async function GET() {
  try {
    const aturan = await ambilAturan();

    let jumlahTerdampak = 0;
    if (aturan) {
      const res = await db().execute({
        sql: "SELECT COUNT(*) AS n FROM nilai WHERE nilai_asli BETWEEN ? AND ?",
        args: [aturan.nilai_awal, aturan.nilai_akhir],
      });
      jumlahTerdampak = Number((res.rows[0] as unknown as { n: number }).n);
    }

    return NextResponse.json({ ok: true, data: { aturan, jumlahTerdampak } });
  } catch (error) {
    console.error("GET /api/dongkrak:", error);
    return NextResponse.json({ ok: false, error: "Gagal memuat aturan dongkrak." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body JSON tidak valid." }, { status: 400 });
  }

  const parsed = validasiDongkrak(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 }
    );
  }

  const { nilai_awal, nilai_akhir, nilai_target } = parsed.data;

  try {
    const sekarang = new Date().toISOString();

    // Satu transaksi: kosongkan hasil lama, hitung ulang dari nilai_asli,
    // lalu simpan aturan yang berlaku.
    await db().batch(
      [
        { sql: "UPDATE nilai SET nilai_dongkrak = NULL", args: [] },
        {
          sql: "UPDATE nilai SET nilai_dongkrak = ? WHERE nilai_asli BETWEEN ? AND ?",
          args: [nilai_target, nilai_awal, nilai_akhir],
        },
        {
          sql: `INSERT INTO aturan_dongkrak (id, nilai_awal, nilai_akhir, nilai_target, diterapkan_pada)
                VALUES (1, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  nilai_awal = excluded.nilai_awal,
                  nilai_akhir = excluded.nilai_akhir,
                  nilai_target = excluded.nilai_target,
                  diterapkan_pada = excluded.diterapkan_pada`,
          args: [nilai_awal, nilai_akhir, nilai_target, sekarang],
        },
      ],
      "write"
    );

    const res = await db().execute({
      sql: "SELECT COUNT(*) AS n FROM nilai WHERE nilai_dongkrak IS NOT NULL",
      args: [],
    });
    const jumlah = Number((res.rows[0] as unknown as { n: number }).n);

    return NextResponse.json({ ok: true, data: { jumlah } });
  } catch (error) {
    console.error("POST /api/dongkrak:", error);
    return NextResponse.json({ ok: false, error: "Gagal menerapkan aturan dongkrak." }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await db().batch(
      [
        { sql: "UPDATE nilai SET nilai_dongkrak = NULL", args: [] },
        { sql: "DELETE FROM aturan_dongkrak", args: [] },
      ],
      "write"
    );

    return NextResponse.json({ ok: true, data: { jumlah: 0 } });
  } catch (error) {
    console.error("DELETE /api/dongkrak:", error);
    return NextResponse.json({ ok: false, error: "Gagal mereset dongkrak." }, { status: 500 });
  }
}