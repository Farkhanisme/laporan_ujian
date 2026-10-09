import { NextRequest, NextResponse } from "next/server";
import { ambilBatasPredikat } from "@/lib/predikat-db";
import type { BatasPredikat } from "@/lib/predikat";
import { ringkasanBatas, sebarNilai } from "../route";
import { validasiBatasPredikat } from "@/lib/validasi";

/**
 * POST /api/predikat/preview
 *
 * Seberapa banyak nilai yang akan jatuh ke tiap predikat JIKA batas tersebut
 * disimpan. Batas dikirim dari peramban dan divalidasi ulang di server, jadi
 * angka yang dipratinjau persis sama dengan yang akan disimpan.
 */
export async function POST(request: NextRequest) {
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

  try {
    const batasSaatIni = await ambilBatasPredikat();
    const batasBaru: BatasPredikat = parsed.data;

    return NextResponse.json({
      ok: true,
      data: {
        rentang: ringkasanBatas(batasBaru),
        // Kedua sebaran ditampilkan berdampingan supaya guru bisa langsung
        // melihat berapa nilai yang berpindah predikat.
        sebelum: await sebarNilai(batasSaatIni),
        sesudah: await sebarNilai(batasBaru),
      },
    });
  } catch (error) {
    console.error("POST /api/predikat/preview:", error);
    return NextResponse.json(
      { ok: false, error: "Gagal membuat pratinjau." },
      { status: 500 }
    );
  }
}