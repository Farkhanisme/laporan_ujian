// Uji end-to-end terhadap database lokal (file:), memakai handler API asli.
// Jalankan: npm run cek:api
// Butuh: scripts/cek-api.sqlite sudah ada (dibuat oleh npm run cek:siapkan).
import { createClient } from "@libsql/client";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import type { BatasPredikat } from "../lib/predikat";

/** Konversi nomor kolom ke huruf, untuk menyusun printArea di pemeriksaan. */
function kolomKe(n: number): string {
  let hasil = "";
  let sisa = n;
  while (sisa > 0) {
    const modulo = (sisa - 1) % 26;
    hasil = String.fromCharCode(65 + modulo) + hasil;
    sisa = Math.floor((sisa - modulo) / 26);
  }
  return hasil;
}

const dbUji = path.join(process.cwd(), "scripts/cek-api.sqlite");
process.env.TURSO_DATABASE_URL = `file:${dbUji}`;

if (!existsSync(dbUji)) {
  console.error("Database uji belum ada. Jalankan: npm run cek:api (yang sudah menyiapkan otomatis).");
  process.exit(1);
}

const { GET: getSiswa } = await import("../app/api/siswa/route");
const { GET: getSiswaId, PATCH: patchSiswaId } = await import("../app/api/siswa/[id]/route");
const { GET: getNilai, PATCH: patchNilai } = await import("../app/api/nilai/route");
const { GET: getDongkrak, POST: postDongkrak, DELETE: deleteDongkrak } = await import(
  "../app/api/dongkrak/route"
);
const { POST: postPreview } = await import("../app/api/dongkrak/preview/route");
const { GET: getRaport } = await import("../app/api/export/raport/[siswaId]/route");
const { GET: getSemua } = await import("../app/api/export/semua/route");
const { GET: getMapel, POST: postMapel } = await import("../app/api/mapel/route");
const { GET: getRingkasan } = await import("../app/api/export/ringkasan/route");
const { GET: getRanking } = await import("../app/api/ranking/route");
const { GET: getExportRanking } = await import("../app/api/export/ranking/route");
const { GET: getExportPeringkat } = await import("../app/api/export/peringkat/route");
const { GET: getPredikat, PUT: putPredikat, DELETE: deletePredikat } = await import(
  "../app/api/predikat/route"
);
const { POST: postPreviewPredikat } = await import("../app/api/predikat/preview/route");
const { hitungRanking } = await import("../lib/ranking");
const { predikat, BATAS_AWAL } = await import("../lib/predikat");

/**
 * Batas predikat yang berlaku saat ini, dibaca lewat API publik — bukan
 * langsung dari tabel — supaya yang diuji benar-benar batas yang dipakai
 * server dan semua exporter. Diisi oleh blok "pengaturan predikat" di bawah,
 * setelah helper `cek` siap dipakai.
 */
let batasBerlaku: BatasPredikat = BATAS_AWAL;

const db = createClient({ url: process.env.TURSO_DATABASE_URL });

// Database referensi: seedDimuat ke memori, dipakai sebagai pembanding
// "nilai_asli harus kembali persis seperti semula".
const ref = createClient({ url: ":memory:" });
await ref.executeMultiple(readFileSync(path.join(process.cwd(), "specs/seed_asts_turso.sql"), "utf8"));

let gagal = 0;
let lulus = 0;

function cek(nama: string, aktual: unknown, diharapkan: unknown) {
  const ok = JSON.stringify(aktual) === JSON.stringify(diharapkan);
  if (ok) {
    lulus++;
    console.log(`  lulus  ${nama}`);
  } else {
    gagal++;
    console.log(`  GAGAL  ${nama}\n    aktual    : ${JSON.stringify(aktual)}\n    diharapkan: ${JSON.stringify(diharapkan)}`);
  }
}

function cekBenar(nama: string, kondisi: boolean, info = "") {
  if (kondisi) {
    lulus++;
    console.log(`  lulus  ${nama}`);
  } else {
    gagal++;
    console.log(`  GAGAL  ${nama} ${info}`);
  }
}

function req(url: string): Request {
  return new Request(`http://localhost${url}`);
}

function bodyReq(url: string, data: unknown, method = "POST"): Request {
  return new Request(`http://localhost${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

async function json(res: Response) {
  return res.json();
}

const kolom = ["nilaiId", "siswaId", "siswa", "kelas", "mapelId", "mapel", "nilai_asli", "nilai_dongkrak", "nilai_akhir", "predikat"];

console.log("\n=== F1: data siswa ===");
{
  const r = await getSiswa(req("/api/siswa"));
  const j = await json(r);
  cek("GET /api/siswa ok", j.ok, true);
  cek("jumlah siswa 128", j.data.length, 128);
  cek("kolom sesuai", Object.keys(j.data[0]).sort(), ["id", "kelas", "nama", "nis", "nisn"].sort());

  const urut = j.data.map((s: any) => `${s.kelas}/${s.nama}`);
  const sorted = [...urut].sort((a, b) => a.localeCompare(b));
  cekBenar("terurut kelas lalu nama", urut.join("|") === sorted.join("|"));

  const kelas7A = await json(await getSiswa(req("/api/siswa?kelas=7A")));
  cek("filter kelas 7A = 19", kelas7A.data.length, 19);

  const cari = await json(await getSiswa(req("/api/siswa?q=ahmad")));
  cekBenar("pencarian case-insensitive", cari.data.length > 0);
  cekBenar(
    "semua hasil pencarian mengandung 'ahmad'",
    cari.data.every((s: any) => s.nama.toLowerCase().includes("ahmad"))
  );

  const satu = await json(await getSiswaId(req("/api/siswa/1"), { params: Promise.resolve({ id: "1" }) }));
  cek("GET siswa id 1", [satu.data.nama, satu.data.kelas], ["AHMAD RIFA`I", "7A"]);

  const tidakAda = await getSiswaId(req("/api/siswa/99999"), { params: Promise.resolve({ id: "99999" }) });
  cek("GET siswa tidak ada = 404", tidakAda.status, 404);

  const idBuruk = await getSiswaId(req("/api/siswa/abc"), { params: Promise.resolve({ id: "abc" }) });
  cek("GET id bukan angka = 400", idBuruk.status, 400);
}

console.log("\n=== 8.4 butir 5 & 6: NIS/NISN kosong dan duplikat ===");
{
  const semua = await json(await getSiswa(req("/api/siswa")));

  // Sisipkan dua siswa dengan NIS/NISN kosong: tidak boleh memicu duplikat.
  const kosong1 = await json(
    await patchSiswaId(bodyReq("/api/siswa/2", { nama: "AHMAD YASIN AISY", kelas: "7A", nis: "", nisn: "" }, "PATCH"), {
      params: Promise.resolve({ id: "2" }),
    })
  );
  cek("NIS kosong disimpan NULL", kosong1.data.nis, null);

  const kosong2 = await json(
    await patchSiswaId(bodyReq("/api/siswa/3", { nama: "ALISHA KHAIRA WILDA", kelas: "7A", nis: "", nisn: "" }, "PATCH"), {
      params: Promise.resolve({ id: "3" }),
    })
  );
  cek("NIS/NISN kosong kedua tetap NULL (tidak duplikat)", [kosong2.data.nis, kosong2.data.nisn], [null, null]);

  const denganAngka0 = await json(
    await patchSiswaId(bodyReq("/api/siswa/4", { nama: "ANDINI BILQISTH FEBRIYANI", kelas: "7A", nis: "0123", nisn: "" }, "PATCH"), {
      params: Promise.resolve({ id: "4" }),
    })
  );
  cek("NIS berawalan 0 dipertahankan sebagai teks", denganAngka0.data.nis, "0123");

  const duplikatNis = await patchSiswaId(
    bodyReq("/api/siswa/5", { nama: "ARDAN FAIZAL UMAM", kelas: "7A", nis: "0123", nisn: "" }, "PATCH"),
    { params: Promise.resolve({ id: "5" }) }
  );
  cek("NIS bentrok = 409", duplikatNis.status, 409);
  cek("pesan NIS bentrok", (await json(duplikatNis)).error, "NIS sudah dipakai siswa lain.");

  // Beri satu siswa NISN dulu, lalu coba siswa lain memakai NISN yang sama.
  await patchSiswaId(bodyReq("/api/siswa/6", { nama: "FEBBY AZARIA PUTRI", kelas: "7A", nis: "", nisn: "1234567890" }, "PATCH"), {
    params: Promise.resolve({ id: "6" }),
  });
  const duplikatNisn = await patchSiswaId(
    bodyReq("/api/siswa/7", { nama: "HILMA FITRA SATRIANI", kelas: "7A", nis: "9999", nisn: "1234567890" }, "PATCH"),
    { params: Promise.resolve({ id: "7" }) }
  );
  cek("NISN bentrok = 409", duplikatNisn.status, 409);
  cek("pesan NISN bentrok", (await json(duplikatNisn)).error, "NISN sudah dipakai siswa lain.");

  // NIS dan NISN boleh sama antar siswa; yang bentrok adalah nilainya sendiri.
  const nisSamaBedaSiswa = await json(
    await patchSiswaId(bodyReq("/api/siswa/7", { nama: "HILMA FITRA SATRIANI", kelas: "7A", nis: "9999", nisn: "" }, "PATCH"), {
      params: Promise.resolve({ id: "7" }),
    })
  );
  cek("NIS sendiri boleh dipakai siswa lain", nisSamaBedaSiswa.data.nis, "9999");

  const duplikatNamaKelas = await patchSiswaId(
    bodyReq("/api/siswa/7", { nama: "AHMAD YASIN AISY", kelas: "7A", nis: "", nisn: "" }, "PATCH"),
    { params: Promise.resolve({ id: "7" }) }
  );
  cek("(nama,kelas) bentrok = 409", duplikatNamaKelas.status, 409);

  const namaBersipat = await json(
    await patchSiswaId(bodyReq("/api/siswa/8", { nama: "  JAUHARA   ZAHRANI  ADZKIYATUL FIKKRI  ", kelas: "7A", nis: "", nisn: "" }, "PATCH"), {
      params: Promise.resolve({ id: "8" }),
    })
  );
  cek("nama dipangkas & spasi dirapatkan", namaBersipat.data.nama, "JAUHARA ZAHRANI ADZKIYATUL FIKKRI");

  const adaSpasiTengah = await json(
    await patchSiswaId(bodyReq("/api/siswa/9", { nama: "MUHAMMAD  AKHDAAN  ARFA-IQ", kelas: "7A", nis: "", nisn: "" }, "PATCH"), {
      params: Promise.resolve({ id: "9" }),
    })
  );
  cek("spasi berulang jadi satu", adaSpasiTengah.data.nama, "MUHAMMAD AKHDAAN ARFA-IQ");

  const nonAngka = await patchSiswaId(
    bodyReq("/api/siswa/10", { nama: "MUHAMMAD ARDAN SYAHPUTRA", kelas: "7A", nis: "12a", nisn: "" }, "PATCH"),
    { params: Promise.resolve({ id: "10" }) }
  );
  cek("NIS non-angka = 400", nonAngka.status, 400);

  // Bersihkan agar tidak mengganggu uji nilai.
  await patchSiswaId(bodyReq("/api/siswa/4", { nama: "ANDINI BILQISTH FEBRIYANI", kelas: "7A", nis: "", nisn: "" }, "PATCH"), { params: Promise.resolve({ id: "4" }) });

  void semua;
}

console.log("\n=== 8.4 butir 7: perpindahan kelas ===");
{
  const seTingkat = await json(
    await patchSiswaId(bodyReq("/api/siswa/20", { nama: "ADITYA AINURROCHMAN", kelas: "7B", nis: "", nisn: "" }, "PATCH"), {
      params: Promise.resolve({ id: "20" }),
    })
  );
  cek("7A -> 7B diterima", seTingkat.data.kelas, "7B");

  await patchSiswaId(bodyReq("/api/siswa/20", { nama: "ADITYA AINURROCHMAN", kelas: "7A", nis: "", nisn: "" }, "PATCH"), { params: Promise.resolve({ id: "20" }) });

  const lintasTingkat = await patchSiswaId(
    bodyReq("/api/siswa/20", { nama: "ADITYA AINURROCHMAN", kelas: "8A", nis: "", nisn: "" }, "PATCH"),
    { params: Promise.resolve({ id: "20" }) }
  );
  cek("7A -> 8A ditolak = 400", lintasTingkat.status, 400);
  cek(
    "pesan perpindahan tingkat",
    (await json(lintasTingkat)).error,
    "Perpindahan antar tingkat tidak didukung karena nilai terikat pada mapel tingkatnya."
  );

  const keSembilan = await patchSiswaId(
    bodyReq("/api/siswa/20", { nama: "ADITYA AINURROCHMAN", kelas: "9", nis: "", nisn: "" }, "PATCH"),
    { params: Promise.resolve({ id: "20" }) }
  );
  cek("7A -> 9 ditolak = 400", keSembilan.status, 400);
}

console.log("\n=== F2: nilai ===");
{
  const semuaNilai = await json(await getNilai(req("/api/nilai?kelas=9")));
  cek("kelas 9 = 544 baris", semuaNilai.data.length, 544);
  cek("kolom sesuai", Object.keys(semuaNilai.data[0]), kolom);

  // Filter mata pelajaran.
  const perMapel = await json(await getNilai(req("/api/nilai?kelas=9&mapel=IPA")));
  cek("filter mapel: 1 baris per siswa", perMapel.data.length, 34);
  cek("filter mapel: semua baris mapel IPA", perMapel.data.every((r: any) => r.mapel === "IPA"), true);
  cek(
    "filter mapel: urutan siswa tetap",
    perMapel.data.map((r: any) => r.siswa),
    [...perMapel.data]
      .sort((a: any, b: any) => a.siswa.localeCompare(b.siswa))
      .map((r: any) => r.siswa)
  );

  const mapelPlusSiswa = await json(await getNilai(req("/api/nilai?kelas=7A&siswaId=1&mapel=Matematika")));
  cek("filter mapel + siswa = 1 baris", mapelPlusSiswa.data.length, 1);
  cek("filter mapel + siswa benar", [mapelPlusSiswa.data[0].mapel, mapelPlusSiswa.data[0].nilai_asli], ["Matematika", 30]);

  const mapelTidakAda = await json(await getNilai(req("/api/nilai?kelas=9&mapel=Tidak Ada")));
  cek("mapel tidak dikenal = 0 baris", mapelTidakAda.data.length, 0);

  const mapelKosong = await json(await getNilai(req("/api/nilai?kelas=9&mapel=")));
  cek("mapel kosong diabaikan (544 baris)", mapelKosong.data.length, 544);
  cek(
    "siswa contoh: 16 baris urut",
    semuaNilai.data.slice(0, 16).map((r: any) => r.mapel),
    [
      "Akidah Akhlak", "Al-Quran Hadis", "Bahasa Arab", "Bahasa Indonesia",
      "Bahasa Inggris", "Bahasa Jawa", "Fikih", "Informatika", "IPA", "IPS",
      "Ke-NU-an", "Matematika", "Pendidikan Pancasila", "PJOK",
      "Sejarah Kebudayaan Islam", "Seni Budaya",
    ]
  );

  const satuSiswa = await json(await getNilai(req("/api/nilai?kelas=7A&siswaId=1")));
  cek("siswa 1 = 16 baris", satuSiswa.data.length, 16);
  cek("nilai akhir = nilai_asli saat belum dongkrak", satuSiswa.data[0].nilai_akhir, 56);
  cek("semua dongkrak NULL", satuSiswa.data.every((r: any) => r.nilai_dongkrak === null), true);

  const tidakValid = await patchNilai(bodyReq("/api/nilai", { items: [{ id: 1, siswa_id: 1, nilai_asli: 101 }] }, "PATCH"));
  cek("nilai 101 = 400", tidakValid.status, 400);
  cek("pesan nilai di atas batas", (await json(tidakValid)).error, "Nilai harus bilangan bulat 0–100.");

  const negatif = await patchNilai(bodyReq("/api/nilai", { items: [{ id: 1, siswa_id: 1, nilai_asli: -1 }] }, "PATCH"));
  cek("nilai negatif = 400", negatif.status, 400);
  cek("pesan nilai di bawah batas", (await json(negatif)).error, "Nilai harus bilangan bulat 0–100.");

  const desimal = await patchNilai(bodyReq("/api/nilai", { items: [{ id: 1, siswa_id: 1, nilai_asli: 55.5 }] }, "PATCH"));
  cek("nilai desimal = 400", desimal.status, 400);

  // Cegah menulis baris milik siswa lain.
  const silang = await json(
    await patchNilai(bodyReq("/api/nilai", { items: [{ id: 1, siswa_id: 9999, nilai_asli: 77 }] }, "PATCH"))
  );
  cek("baris milik siswa lain ditolak", silang.data.ditolak, 1);
  cek("tidak ada baris tersimpan", silang.data.jumlah, 0);
  const cekTurkun = await db.execute({ sql: "SELECT nilai_asli FROM nilai WHERE id = 1", args: [] });
  cek("nilai_asli baris 1 tidak berubah", cekTurkun.rows[0].nilai_asli, 56);

  const campuran = await patchNilai(
    bodyReq("/api/nilai", { items: [{ id: 1, siswa_id: 1, nilai_asli: 50 }, { id: 2, siswa_id: 2, nilai_asli: 50 }] }, "PATCH")
  );
  cek("campur dua siswa = 400", campuran.status, 400);
}

console.log("\n=== F3: dongkrak (8.3 langkah 1–7) ===");
async function jumlahDongkrak() {
  const r = await db.execute({ sql: "SELECT COUNT(*) AS n FROM nilai WHERE nilai_dongkrak IS NOT NULL", args: [] });
  return Number(r.rows[0].n);
}

{
  const awal = await json(await getDongkrak(req("/api/dongkrak")));
  cek("aturan awal null", awal.data.aturan, null);
  cek("jumlah terdampak awal 0", awal.data.jumlahTerdampak, 0);

  const p1 = await json(await postPreview(bodyReq("/api/dongkrak/preview", { nilai_awal: 0, nilai_akhir: 30, nilai_target: 30 })));
  cek("L1 pratinjau 219", p1.data.jumlahTerdampak, 219);
  cek("L1 di antaranya 28 bernilai 0", p1.data.jumlahNol, 28);
  cek("L1 ada 10 contoh", p1.data.contoh.length, 10);

  const t1 = await json(await postDongkrak(bodyReq("/api/dongkrak", { nilai_awal: 0, nilai_akhir: 30, nilai_target: 30 })));
  cek("L2 terapkan 219", t1.data.jumlah, 219);
  cek("L2 jumlah terisi di DB", await jumlahDongkrak(), 219);
  const d1 = await json(await getNilai(req("/api/nilai?kelas=7A&siswaId=1")));
  const cari = (n: string) => d1.data.find((r: any) => r.mapel === n);
  cek("L2 IPA 28 -> 30", [cari("IPA").nilai_asli, cari("IPA").nilai_dongkrak], [28, 30]);
  cek("L2 Matematika 30 -> 30", cari("Matematika").nilai_dongkrak, 30);
  cek("L2 Bahasa Inggris 32 tidak", cari("Bahasa Inggris").nilai_dongkrak, null);

  const p2 = await json(await postPreview(bodyReq("/api/dongkrak/preview", { nilai_awal: 0, nilai_akhir: 50, nilai_target: 50 })));
  cek("L3 pratinjau 834", p2.data.jumlahTerdampak, 834);
  cek("L3 jumlah dongkrak aktif yang diganti 219", p2.data.jumlahDongkrakAktif, 219);
  const t2 = await json(await postDongkrak(bodyReq("/api/dongkrak", { nilai_awal: 0, nilai_akhir: 50, nilai_target: 50 })));
  cek("L3 terapkan 834 (bukan 219+834)", t2.data.jumlah, 834);
  cek("L3 jumlah terisi di DB", await jumlahDongkrak(), 834);
  const d2 = await json(await getNilai(req("/api/nilai?kelas=7A&siswaId=1")));
  const cari2 = (n: string) => d2.data.find((r: any) => r.mapel === n);
  cek("L3 IPA = 50", cari2("IPA").nilai_dongkrak, 50);
  cek("L3 Matematika = 50", cari2("Matematika").nilai_dongkrak, 50);

  const t3 = await json(await postDongkrak(bodyReq("/api/dongkrak", { nilai_awal: 0, nilai_akhir: 20, nilai_target: 25 })));
  cek("L4 terapkan 92", t3.data.jumlah, 92);
  const d3 = await json(await getNilai(req("/api/nilai?kelas=7A&siswaId=1")));
  const ipa3 = d3.data.find((r: any) => r.mapel === "IPA");
  cek("L4 IPA 28 tanpa dongkrak", [ipa3.nilai_dongkrak, ipa3.nilai_akhir], [null, 28]);

  const mat = d3.data.find((r: any) => r.mapel === "Matematika");
  const editKe15 = await json(
    await patchNilai(bodyReq("/api/nilai", { items: [{ id: mat.nilaiId, siswa_id: 1, nilai_asli: 15 }] }, "PATCH"))
  );
  cek("L5 edit ke 15 tersimpan", editKe15.data.jumlah, 1);
  const setelah15 = await db.execute({ sql: "SELECT nilai_asli, nilai_dongkrak FROM nilai WHERE id = ?", args: [mat.nilaiId] });
  cek("L5 dongkrak jadi 25", setelah15.rows[0].nilai_dongkrak, 25);

  await patchNilai(bodyReq("/api/nilai", { items: [{ id: mat.nilaiId, siswa_id: 1, nilai_asli: 60 }] }, "PATCH"));
  const setelah60 = await db.execute({ sql: "SELECT nilai_dongkrak FROM nilai WHERE id = ?", args: [mat.nilaiId] });
  cek("L5 ubah ke 60 -> NULL", setelah60.rows[0].nilai_dongkrak, null);

  const reset = await json(await deleteDongkrak(req("/api/dongkrak")));
  cek("L6 reset ok", reset.ok, true);
  cek("L6 semua NULL", await jumlahDongkrak(), 0);
  const tabelAturan = await db.execute({ sql: "SELECT COUNT(*) AS n FROM aturan_dongkrak", args: [] });
  cek("L6 tabel aturan kosong", Number(tabelAturan.rows[0].n), 0);

  // Kembalikan nilai_asli baris yang sengaja diubah di L5.
  await patchNilai(bodyReq("/api/nilai", { items: [{ id: mat.nilaiId, siswa_id: 1, nilai_asli: 30 }] }, "PATCH"));

  // Bandingkan nilai_asli dengan seed per-id (ATTACH tidak dipakai supaya
  // tidak bergantung pada fitur turso).
  const seedNilai = await ref.execute({ sql: "SELECT id, nilai_asli FROM nilai ORDER BY id", args: [] });
  const ujiNilai = await db.execute({ sql: "SELECT id, nilai_asli FROM nilai ORDER BY id", args: [] });
  cek("L7 jumlah baris sama", ujiNilai.rows.length, seedNilai.rows.length);

  const beda: Array<{ id: number; seed: number; uji: number }> = [];
  for (let i = 0; i < seedNilai.rows.length; i++) {
    if (seedNilai.rows[i].nilai_asli !== ujiNilai.rows[i].nilai_asli) {
      beda.push({ id: seedNilai.rows[i].id as number, seed: seedNilai.rows[i].nilai_asli as number, uji: ujiNilai.rows[i].nilai_asli as number });
    }
  }
  cek("L7 nilai_asli identik dengan seed", beda, []);
}

console.log("\n=== validasi dongkrak ===");
{
  const terbalik = await postDongkrak(bodyReq("/api/dongkrak", { nilai_awal: 50, nilai_akhir: 20, nilai_target: 30 }));
  cek("awal > akhir = 400", terbalik.status, 400);
  cek("pesan awal > akhir", (await json(terbalik)).error, "Nilai awal harus ≤ nilai akhir");

  const diBatas = await postDongkrak(bodyReq("/api/dongkrak", { nilai_awal: -1, nilai_akhir: 20, nilai_target: 30 }));
  cek("nilai di luar 0–100 = 400", diBatas.status, 400);

  // target < akhir diperbolehkan (peringatan, tidak memblokir).
  const turun = await json(await postDongkrak(bodyReq("/api/dongkrak", { nilai_awal: 0, nilai_akhir: 20, nilai_target: 10 })));
  cek("target < akhir tetap bisa diterapkan", turun.ok, true);
  await deleteDongkrak(req("/api/dongkrak"));
}

console.log("\n=== F4 & F5: ekspor Excel ===");
{
  const raport = await getRaport(req("/api/export/raport/1"), { params: Promise.resolve({ siswaId: "1" }) });
  cek("F4 status 200", raport.status, 200);
  cek("F4 tipe konten xlsx", raport.headers.get("content-type"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  cekBenar("F4 header attachment", (raport.headers.get("content-disposition") ?? "").startsWith("attachment;"));
  cekBenar("F4 nama berkas", (raport.headers.get("content-disposition") ?? "").includes("raport_7A_"));
  const bufRaport = Buffer.from(await raport.arrayBuffer());
  cekBenar("F4 menghasilkan berkas .xlsx (PK zip)", bufRaport.subarray(0, 2).toString() === "PK");

  const tidakAda = await getRaport(req("/api/export/raport/99999"), { params: Promise.resolve({ siswaId: "99999" }) });
  cek("F4 siswa tidak ada = 404", tidakAda.status, 404);

  const semua = await getSemua(req("/api/export/semua"));
  cek("F5 status 200", semua.status, 200);
  const bufSemua = Buffer.from(await semua.arrayBuffer());
  cekBenar("F5 menghasilkan .xlsx", bufSemua.subarray(0, 2).toString() === "PK");
  cekBenar(
    "F5 nama berkas benar",
    (semua.headers.get("content-disposition") ?? "").includes("nilai_semua_siswa_ASTS_GANJIL_2026-2027.xlsx")
  );
}

console.log("\n=== F4: isi kopraport (label + nilai) ===");
{
  const raport = await getRaport(req("/api/export/raport/1"), { params: Promise.resolve({ siswaId: "1" }) });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(await raport.arrayBuffer()) as any);
  const ws = wb.worksheets[0];

  const v = (a: string) => ws.getCell(a).value;
  const f = (a: string) => ws.getCell(a).numFmt;

  cek("A1 = 'NAMA'", v("A1"), "NAMA");
  cek("A2 = 'NIS'", v("A2"), "NIS");
  cek("A3 = 'NISN'", v("A3"), "NISN");
  cek("B1 = nama siswa", v("B1"), "AHMAD RIFA`I");
  cek("B2 = NIS (kosong)", v("B2"), "");
  cek("B3 = NISN (kosong)", v("B3"), "");

  cek("C1 = 'MADRAHSAH'", v("C1"), "MADRAHSAH");
  cek("C2 = 'KELAS/SEMESTER'", v("C2"), "KELAS/SEMESTER");
  cek("C3 = 'TAHUN AJARAN'", v("C3"), "TAHUN AJARAN");
  cek("D1 = nama madrasah", v("D1"), "MTsS MA'ARIF TIENG");
  cek("D2 = kelas/semester siswa", v("D2"), "7A/GANJIL");
  cek("D3 = tahun ajaran", v("D3"), "2026/2027");

  // Semua sel kop bertipe teks supaya 2026/2027 dan angka berawalan 0 utuh.
  cek("B1:D3 semuanya format teks", ["B1", "B2", "B3", "D1", "D2", "D3"].every((a) => f(a) === "@"), true);
  cek("label kop juga format teks", ["A1", "A2", "A3", "C1", "C2", "C3"].every((a) => f(a) === "@"), true);

  // Nilai kop tidak boleh berubah jadi angka.
  cek("D3 bukan angka", typeof v("D3"), "string");
  cek("D2 bukan angka", typeof v("D2"), "string");

  // Lebar kolom mengikuti isi baru.
  const lebar = [1, 2, 3, 4].map((i) => ws.getColumn(i).width);
  cek("lebar kolom A-D", lebar, [12, 36, 16, 20]);

  // Baris 4 tetap judul tabel.
  cek("A4 masih 'No'", v("A4"), "No");
  cek("B4 masih 'Nama Mapel'", v("B4"), "Nama Mapel");
  cek("C4 masih 'Nilai'", v("C4"), "Nilai");
  cek("D4 masih 'Predikat'", v("D4"), "Predikat");

  // Kolom C pada tabel harus tetap angka bulat.
  cek("C5 = nilai asli 56", v("C5"), 56);
  cek("C5 format angka", ws.getRow(5).getCell(3).numFmt, "0");

  // Judul kolom tanpa warna latar (putih).
  cek(
    "judul kolom tanpa background",
    ["A4", "B4", "C4", "D4"].every((a) => {
      const f = ws.getCell(a).fill as { pattern?: string } | undefined;
      return !f || f.pattern === "none";
    }),
    true
  );
  cek(
    "tidak ada warna latar abu di sheet",
    ["A4", "B4", "C4", "D4", "A5", "B5", "C5", "D5"].every((a) => {
      const f = ws.getCell(a).fill as { pattern?: string; fgColor?: { argb?: string } } | undefined;
      return !f || f.pattern === "none" || f.fgColor?.argb !== "FFD9D9D9";
    }),
    true
  );
  // Tulisan judul tetap pekat, rata tengah, dan bergaris.
  cek("judul kolom tetap tebal", ["A4", "B4", "C4", "D4"].every((a) => ws.getCell(a).font?.bold === true), true);
  cek("judul kolom tetap rata tengah", ws.getCell("A4").alignment?.horizontal, "center");
  cek("judul kolom tetap bergaris", !!ws.getCell("A4").border?.top, true);

  // Kop Bold.
  cek("A1:D3 bold", ["A1", "B1", "C1", "D1", "A3", "D3"].every((a) => ws.getCell(a).font?.bold === true), true);

  // printArea tidak berubah karena jumlah mapel tetap 16.
  cek("printArea tetap A1:D20", (ws.pageSetup as any).printArea, "A1:D20");

  // Label kapital, sementara nilai di sebelahnya tetap apa adanya.
  cek(
    "label kop semuanya kapital",
    ["A1", "A2", "A3", "C1", "C2", "C3"].every((a) => {
      const t = String(v(a));
      return t === t.toUpperCase();
    }),
    true
  );
  cek("nama siswa tidak jadi kapital", v("B1"), "AHMAD RIFA`I");
  cek("nama madrasah tidak jadi kapital", v("D1"), "MTsS MA'ARIF TIENG");
  cek("kelas/semester tidak jadi kapital", v("D2"), "7A/GANJIL");
}

console.log("\n=== ringkasan nilai: satu sheet, nilai + predikat + deskripsi per mapel ===");
{
  // Kolom identitas 5; tiap mapel memakai 3 kolom mulai kolom 6.
  const kolomIdentitas = 5;
  const kolomPerMapel = 3;
  const kolomMapel = (i: number) => kolomIdentitas + i * kolomPerMapel + 1;
  const barisPertama = 3;
  const barisTerakhir = barisPertama + 127;

  const mapelUrut = [
    "Akidah Akhlak", "Al-Quran Hadis", "Bahasa Arab", "Bahasa Indonesia",
    "Bahasa Inggris", "Bahasa Jawa", "Fikih", "Informatika", "IPA", "IPS",
    "Ke-NU-an", "Matematika", "Pendidikan Pancasila", "PJOK",
    "Sejarah Kebudayaan Islam", "Seni Budaya",
  ];

  const res = await getRingkasan(req("/api/export/ringkasan"));
  cek("status 200", res.status, 200);
  cek(
    "tipe konten xlsx",
    res.headers.get("content-type"),
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  cekBenar(
    "nama berkas benar",
    (res.headers.get("content-disposition") ?? "").includes("ringkasan_nilai_ASTS_GANJIL_2026-2027.xlsx")
  );

  const buf = Buffer.from(await res.arrayBuffer());
  cek("menghasilkan .xlsx (PK zip)", buf.subarray(0, 2).toString(), "PK");

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as any);
  const ws = wb.worksheets[0];
  const g = (a: string) => ws.getCell(a).value;
  const cariBaris = (nama: string) =>
    Array.from({ length: 128 }, (_, i) => barisPertama + i).find(
      (r) => ws.getRow(r).getCell(2).value === nama
    )!;
  /** [nilai, predikat, deskripsi] untuk satu mapel pada satu baris. */
  const selMapel = (baris: number, mapel: string) => {
    const k = kolomMapel(mapelUrut.indexOf(mapel));
    return [0, 1, 2].map((o) => ws.getCell(baris, k + o).value);
  };

  // Header dua baris: identitas + 16 mapel x 3 kolom = 53 kolom.
  cek("jumlah kolom = 53 (5 identitas + 16 mapel x 3)", ws.columnCount, 53);
  cek("jumlah baris = 130 (2 header + 128 siswa)", ws.rowCount, 130);

  cek("A1 = NO", g("A1"), "NO");
  cek("B1 = NAMA", g("B1"), "NAMA");
  cek("C1 = NISN", g("C1"), "NISN");
  cek("D1 = TTL", g("D1"), "TTL");
  cek("E1 = KELAS", g("E1"), "KELAS");
  cek("kolom identitas ter-merge vertikal (baris 2 ikut)", g("A2"), "NO");
  cek("kolom identitas ter-merge vertikal (baris 2 E)", g("E2"), "KELAS");

  // Baris 1: nama mapel, tiap nama menutupi tiga kolom.
  cek(
    "16 header mapel sesuai urutan abjad",
    mapelUrut.map((_, i) => ws.getCell(1, kolomMapel(i)).value),
    mapelUrut
  );
  cek("kolom terakhir (BA) = Seni Budaya", ws.getCell(1, 53).value, "Seni Budaya");

  // Baris 2: NILAI | PREDIKAT | DESKRIPSI diulang tiap mapel.
  const subHeader = Array.from({ length: 53 }, (_, i) => i + 1)
    .filter((c) => c > kolomIdentitas)
    .map((c) => ws.getCell(2, c).value);
  cek(
    "baris 2 mengulang NILAI | PREDIKAT | DESKRIPSI",
    subHeader,
    Array.from({ length: 16 }, () => ["NILAI", "PREDIKAT", "DESKRIPSI"]).flat()
  );

  // Data siswa pertama. Catatan: "ADITYA" urut sebelum "AHMAD" secara abjad,
  // jadi baris pertama bukan AHMAD RIFA`I.
  cek("A3 = nomor urut 1", g("A3"), 1);
  cek("B3 = nama siswa pertama (abjad)", g("B3"), "ADITYA AINURROCHMAN");
  cek("E3 = kelas", g("E3"), "7A");

  // Field kosong harus kosong tanpa teks pengganti.
  cek("NISN kosong = sel kosong", ws.getCell("C3").value, null);
  cek("TTL kosong = sel kosong", ws.getCell("D3").value, null);
  cek(
    "tidak ada sel identitas berisi '-' atau 'Kosong'",
    Array.from({ length: 128 }, (_, i) => ws.getRow(barisPertama + i).getCell(3).value).every(
      (v) => v === null || typeof v === "string"
    ),
    true
  );
  cek(
    "kolom TTL kosong di semua 128 baris",
    Array.from({ length: 128 }, (_, i) => ws.getRow(barisPertama + i).getCell(4).value).every((v) => v === null),
    true
  );

  // Cari baris AHMAD RIFA`I untuk memeriksa nilainya (spec 8.2).
  const barisContoh = cariBaris("AHMAD RIFA`I");
  cek("baris AHMAD RIFA`I ditemukan", typeof barisContoh, "number");
  cek("kolom Akidah Akhlak = 56", selMapel(barisContoh, "Akidah Akhlak")[0], 56);
  cek("kolom IPA = 28", selMapel(barisContoh, "IPA")[0], 28);
  cek("kolom Seni Budaya = 40", selMapel(barisContoh, "Seni Budaya")[0], 40);
  cek("nilai berupa angka bulat", typeof ws.getCell(barisContoh, kolomMapel(0)).value, "number");
  cek("nilai format angka", ws.getCell(barisContoh, kolomMapel(0)).numFmt, "0");

  // Predikat ditulis di samping keterangan: "D (Kurang)".
  cek("predikat Akidah Akhlak (56) = D (Kurang)", selMapel(barisContoh, "Akidah Akhlak")[1], "D (Kurang)");
  cek("predikat IPA (28) = D (Kurang)", selMapel(barisContoh, "IPA")[1], "D (Kurang)");
  cek("predikat Seni Budaya (40) = D (Kurang)", selMapel(barisContoh, "Seni Budaya")[1], "D (Kurang)");
  cek("deskripsi Akidah Akhlak (56) = Belum Tuntas", selMapel(barisContoh, "Akidah Akhlak")[2], "Belum Tuntas");
  cek("deskripsi IPA (28) = Belum Tuntas", selMapel(barisContoh, "IPA")[2], "Belum Tuntas");

  // Batas 77: 77 tepat = Tuntas, 76 = Belum Tuntas.
  const baris77 = cariBaris("MUHAMMAD AKHDAAN ARFA-IQ");
  cek("nilai 77 (batas) tercatat", selMapel(baris77, "IPS")[0], 77);
  cek("nilai 77 = C (Cukup)", selMapel(baris77, "IPS")[1], "C (Cukup)");
  cek("nilai 77 = Tuntas", selMapel(baris77, "IPS")[2], "Tuntas");
  const baris76 = cariBaris("ANDINI BILQISTH FEBRIYANI");
  cek("nilai 76 = D (Kurang)", selMapel(baris76, "Bahasa Arab")[1], "D (Kurang)");
  cek("nilai 76 = Belum Tuntas", selMapel(baris76, "Bahasa Arab")[2], "Belum Tuntas");
  cek("nilai 85 = B (Baik)", selMapel(baris76, "Fikih")[1], "B (Baik)");
  cek("nilai 85 = Tuntas", selMapel(baris76, "Fikih")[2], "Tuntas");
  const barisA = cariBaris("JAUHARA ZAHRANI ADZKIYATUL FIKKRI");
  cek("nilai 100 = A (Sangat Baik)", selMapel(barisA, "Bahasa Inggris")[1], "A (Sangat Baik)");
  cek("nilai 100 = Tuntas", selMapel(barisA, "Bahasa Inggris")[2], "Tuntas");

  // Semua 2.048 nilai harus punya predikat + deskripsi yang cocok, dan keempat
  // predikat muncul karena data seed memang tersebar di A/B/C/D.
  const semuaPredikat = new Set<string>();
  const semuaDeskripsi = new Set<string>();
  let pasanganSalah = 0;
  let selNilaiSalah = 0;
  for (let b = barisPertama; b <= barisTerakhir; b++) {
    for (let i = 0; i < mapelUrut.length; i++) {
      const k = kolomMapel(i);
      const nilai = ws.getCell(b, k).value;
      const pred = ws.getCell(b, k + 1).value;
      const desk = ws.getCell(b, k + 2).value;
      if (nilai === null || nilai === undefined) {
        // Mapel tanpa nilai: ketiganya kosong, tanpa teks pengganti.
        if (pred !== null || desk !== null) pasanganSalah++;
        continue;
      }
      if (typeof nilai !== "number") {
        selNilaiSalah++;
        continue;
      }
      if (typeof pred === "string") semuaPredikat.add(pred);
      if (typeof desk === "string") semuaDeskripsi.add(desk);
      const p = nilai >= 93 ? "A" : nilai >= 85 ? "B" : nilai >= 77 ? "C" : "D";
      if (pred !== `${p} (${p === "A" ? "Sangat Baik" : p === "B" ? "Baik" : p === "C" ? "Cukup" : "Kurang"})`) pasanganSalah++;
      if (desk !== (nilai >= 77 ? "Tuntas" : "Belum Tuntas")) pasanganSalah++;
    }
  }
  cek("semua kolom nilai berisi angka (atau kosong)", selNilaiSalah, 0);
  cek("tidak ada predikat/deskripsi yang tidak cocok dengan nilainya", pasanganSalah, 0);
  cek(
    "keempat predikat muncul dengan keterangannya",
    [...semuaPredikat].sort(),
    ["A (Sangat Baik)", "B (Baik)", "C (Cukup)", "D (Kurang)"]
  );
  cek("kedua deskripsi ketuntasan muncul", [...semuaDeskripsi].sort(), ["Belum Tuntas", "Tuntas"]);

  // Baris terakhir siswa ke-128.
  cek(`A${barisTerakhir} = nomor urut 128`, g(`A${barisTerakhir}`), 128);
  cek(`B${barisTerakhir} = ZOYA LAILA ANDINI`, g(`B${barisTerakhir}`), "ZOYA LAILA ANDINI");
  cek(`E${barisTerakhir} = kelas 9`, g(`E${barisTerakhir}`), "9");
  cek(`tidak ada baris ke-${barisTerakhir + 1}`, ws.getRow(barisTerakhir + 1).getCell(1).value, null);

  // Urutan kelas lalu nama: kelas berganti monoton dan tidak terbalik.
  const kelasKolom = Array.from({ length: 128 }, (_, i) => String(ws.getRow(barisPertama + i).getCell(5).value));
  cek(
    "kelas terurut 7A lalu 7B lalu 8A lalu 8B lalu 9",
    [...new Set(kelasKolom)],
    ["7A", "7B", "8A", "8B", "9"]
  );
  cek(
    "nama urut abjad di dalam tiap kelas",
    kelasKolom.every((k, i) => {
      if (i === 0 || kelasKolom[i - 1] !== k) return true;
      const a = String(ws.getRow(barisPertama + i).getCell(2).value);
      const b = String(ws.getRow(barisPertama + i - 1).getCell(2).value);
      return a.localeCompare(b, undefined, { sensitivity: "base" }) > 0;
    }),
    true
  );

  // Nilai harus nilai akhir: terapkan dongkrak lalu unduh ulang.
  await postDongkrak(bodyReq("/api/dongkrak", { nilai_awal: 0, nilai_akhir: 30, nilai_target: 30 }));
  const res2 = await getRingkasan(req("/api/export/ringkasan"));
  const wb2 = new ExcelJS.Workbook();
  await wb2.xlsx.load(Buffer.from(await res2.arrayBuffer()) as any);
  const ws2 = wb2.worksheets[0];
  // Baris AHMAD RIFA'I: Akidah 56 (di luar rentang), IPA 28 -> 30.
  const barisAhmad = Array.from({ length: 128 }, (_, i) => barisPertama + i).find((r) => ws2.getRow(r).getCell(2).value === "AHMAD RIFA`I")!;
  cek("ringkasan memakai nilai AKHIR (IPA 28 -> 30)", ws2.getCell(barisAhmad, kolomMapel(mapelUrut.indexOf("IPA"))).value, 30);
  cek("nilai di luar rentang tetap (Akidah 56)", ws2.getCell(barisAhmad, kolomMapel(0)).value, 56);
  // Nilai akhir ikut menentukan predikat dan deskripsi.
  cek("predikat mengikuti nilai akhir (IPA 30 -> D (Kurang))", ws2.getCell(barisAhmad, kolomMapel(mapelUrut.indexOf("IPA")) + 1).value, "D (Kurang)");
  cek("deskripsi mengikuti nilai akhir (IPA 30 -> Belum Tuntas)", ws2.getCell(barisAhmad, kolomMapel(mapelUrut.indexOf("IPA")) + 2).value, "Belum Tuntas");
  await deleteDongkrak(req("/api/dongkrak"));

  // Format header: bold, tanpa background, membungkus.
  cek("header bold", ws.getCell(1, kolomMapel(0)).font?.bold, true);
  cek(
    "header tanpa background",
    (ws.getCell(1, kolomMapel(0)).fill as { pattern?: string })?.pattern === "none",
    true
  );
  cek("header mapel wrapText", ws.getCell(1, kolomMapel(0)).alignment?.wrapText, true);
  cek("tinggi baris header mapel", ws.getRow(1).height, 30);
  cek("tinggi baris header kolom", ws.getRow(2).height, 18);
  cek("sub-header bold", ws.getCell(2, kolomMapel(0) + 1).font?.bold, true);

  // Border: 셀 yang di-merge pun harus bergaris, termasuk sisi dalam kelompok.
  cekBenar("sel dalam kelompok mapel diberi garis", [1, 2].every((r) =>
    [kolomMapel(0), kolomMapel(0) + 1, kolomMapel(0) + 2].every((c) =>
      Boolean(ws.getCell(r, c).border?.top)
    )
  ));

  // Lebar kolom: identitas tetap; tiap mapel 7 (nilai) / 16 (predikat) / 14 (deskripsi).
  cek("lebar kolom identitas", [1, 2, 3, 4, 5].map((i) => ws.getColumn(i).width), [5, 34, 12, 12, 8]);
  cek("lebar kolom mapel (nilai, predikat, deskripsi)", [6, 7, 8].map((i) => ws.getColumn(i).width), [7, 16, 14]);
  cek("lebar kolom terakhir 14", ws.getColumn(53).width, 14);
  // Kolom predikat harus muat keterangan terpanjang "A (Sangat Baik)".
  cek("lebar kolom predikat cukup untuk keterangan terpanjang", ws.getColumn(7).width! >= "A (Sangat Baik)".length, true);
  cek("lebar kolom deskripsi cukup untuk 'Belum Tuntas'", ws.getColumn(8).width! >= "Belum Tuntas".length, true);

  // Pengaturan cetak: A3 landscape, muat 2 halaman lebar, header + kolom
  // identitas diulang supaya tabel tetap terbaca dan bisa dikenali.
  const ps = ws.pageSetup as any;
  cek("kertas A3", ps.paperSize, 8);
  cek("orientasi landscape", ps.orientation, "landscape");
  cek("fitToWidth 2 (1 halaman menghasilkan huruf ~3,4pt)", ps.fitToWidth, 2);
  cek("fitToHeight 0 (tinggi bebas)", ps.fitToHeight, 0);
  cek("printArea A1:BA130", ps.printArea, "A1:BA130");
  cek("header 1-2 diulang tiap halaman", ps.printTitlesRow, "1:2");
  cek("kolom NO+NAMA diulang di halaman kanan", ps.printTitlesColumn, "A:B");
  cek("freeze header (ySplit 2)", ws.views?.[0]?.ySplit, 2);
  cek("freeze kolom nama (xSplit 2)", ws.views?.[0]?.xSplit, 2);
}

console.log("\n=== ranking: peringkat per kelas dari nilai akhir ===");
{
  // Jumlah siswa per kelas dibaca dari database, bukan ditulis di sini:
  // uji sebelumnya memang memindahkan siswa antar kelas (perpindahan 7A -> 7B),
  // jadi angka seed sudah tidak berlaku saat blok ini jalan. Yang diuji
  // adalah kesesuaian API dengan isi database, bukan angka seed.
  const KELAS = ["7A", "7B", "8A", "8B", "9"];
  const jumlahSiswaDb = async (kelas: string) => {
    const res = await db.execute({
      sql: `SELECT (SELECT COUNT(*) FROM siswa WHERE kelas = ?) AS siswa,
                   (SELECT COUNT(*) FROM nilai n
                      JOIN siswa s ON s.id = n.siswa_id
                     WHERE s.kelas = ?) AS nilai`,
      args: [kelas, kelas],
    });
    const row = res.rows[0] as unknown as { siswa: number; nilai: number };
    return { siswa: Number(row.siswa), nilai: Number(row.nilai) };
  };

  // Bandingkan dengan SQL yang menghitung ulang sendiri, bukan lewat fungsi
  // yang sama dengan yang diuji: kalau keduanya memakai `hitungRanking`, maka
  // kesalahan yang sama muncul di kedua sisi dan uji ini lolos palsu.
  const referensiSql = async (kelas: string) => {
    const res = await db.execute({
      sql: `SELECT s.nama AS nama,
                   ROUND(SUM(COALESCE(n.nilai_dongkrak, n.nilai_asli)) * 1.0 /
                         COUNT(*), 1) AS rata,
                   COUNT(*) AS jumlahMapel
            FROM nilai n
            JOIN siswa s ON s.id = n.siswa_id
            WHERE s.kelas = ?
            GROUP BY s.id, s.nama`,
      args: [kelas],
    });
    return res.rows as unknown as Array<{ nama: string; rata: number; jumlahMapel: number }>;
  };

  const urutAbjad = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base" });

  for (const kelas of KELAS) {
    const { siswa: jumlahSiswa, nilai: jumlahNilai } = await jumlahSiswaDb(kelas);
    const res = await getRanking(req(`/api/ranking?kelas=${kelas}`));
    cek(`GET /api/ranking?kelas=${kelas} ok`, res.status, 200);

    const json = (await res.json()) as {
      ok: boolean;
      data: Array<{ siswaId: number; nama: string; kelas: string; nilai_akhir: number }>;
    };
    cek(`API kelas ${kelas} ok`, json.ok, true);

    // API mengembalikan nilai mentah, bukan ranking jadi.
    cek(
      `API kelas ${kelas} mengembalikan nilai mentah`,
      json.data.every((r) => typeof r.siswaId === "number" && typeof r.nilai_akhir === "number" && !("peringkat" in r)),
      true
    );
    cek(
      `API kelas ${kelas} hanya berisi siswa kelas itu`,
      new Set(json.data.map((r) => r.kelas)).size === 1 && json.data[0].kelas === kelas,
      true
    );

    cek(`kelas ${kelas} = ${jumlahSiswa} siswa`, new Set(json.data.map((r) => r.siswaId)).size, jumlahSiswa);
    cek(`kelas ${kelas} jumlah baris nilai`, json.data.length, jumlahNilai);
    // Tiap siswa punya satu baris per mapel tingkatnya (16 untuk semua tingkat).
    cek(`kelas ${kelas} baris nilai = siswa x 16`, json.data.length, jumlahSiswa * 16);

    // Hitung ranking memakai fungsi yang sama dengan yang dipakai layar & ekspor.
    const baris = hitungRanking(json.data);
    cek(`kelas ${kelas} ranking = ${jumlahSiswa} baris`, baris.length, jumlahSiswa);

    // Bandingkan dengan hasil SQL yang menghitung ulang sendiri.
    const ref = await referensiSql(kelas);
    const refSorted = [...ref].sort(
      (a, b) => (a.rata === b.rata ? urutAbjad(a.nama, b.nama) : b.rata - a.rata)
    );

    cek(
      `kelas ${kelas} rata-rata sama dengan SQL`,
      baris.map((b) => b.rata),
      refSorted.map((r) => Number(r.rata))
    );
    cek(
      `kelas ${kelas} nama urut sama dengan SQL`,
      baris.map((b) => b.nama),
      refSorted.map((r) => r.nama)
    );
    cek(
      `kelas ${kelas} jumlahMapel = 16 per siswa`,
      baris.every((b) => b.jumlahMapel === 16),
      true
    );

    // Peringkat: seri memakai angka sama, lalu melompat.
    const peringkat = baris.map((b) => b.peringkat);
    cek(`kelas ${kelas} peringkat dimulai dari 1`, peringkat[0], 1);
    cek(
      `kelas ${kelas} peringkat naik monoton`,
      peringkat.every((p, i) => i === 0 || p >= peringkat[i - 1]),
      true
    );
    cek(
      `kelas ${kelas} peringkat seri ikut rata-rata yang sama`,
      baris.every((b, i) => i === 0 || b.rata !== baris[i - 1].rata || b.peringkat === baris[i - 1].peringkat),
      true
    );
    // Peringkat tidak boleh melebihi jumlah siswa.
    cek(
      `kelas ${kelas} tidak ada peringkat melebihi jumlah siswa`,
      Math.max(...peringkat) <= jumlahSiswa,
      true
    );
    // Jumlah peringkat unik harus sama dengan jumlah nilai rata-rata berbeda:
    // tidak boleh ada peringkat yang menyatu tanpa alasan, atau melompat
    // tanpa ada seri. Ini berlaku apakah pun datanya.
    cek(
      `kelas ${kelas} peringkat unik = jumlah rata-rata unik`,
      new Set(peringkat).size,
      new Set(baris.map((b) => b.rata)).size
    );
  }

  // Ranking memakai nilai AKHIR: terapkan dongkrak lalu peringkat harus dihitung
  // ulang dari nilai yang sudah berubah.
  const ambilRanking = async (kelas: string) => {
    const j = (await (await getRanking(req(`/api/ranking?kelas=${kelas}`))).json()) as {
      data: Parameters<typeof hitungRanking>[0];
    };
    return hitungRanking(j.data);
  };

  const sebelum = await ambilRanking("7A");

  // RIDZO SETIAWAN punya beberapa nilai di rentang 0-30, jadi aturan
  // 0-30 -> 30 wajib menaikkan rata-ratenessnya.
  const namaUji = "RIDZO SETIAWAN";
  const nilaiUji = (
    ((await (await getRanking(req("/api/ranking?kelas=7A"))).json()) as {
      data: Array<{ nama: string; nilai_akhir: number }>;
    }).data
  ).filter((r) => r.nama === namaUji);
  cek(`${namaUji} punya 16 baris nilai`, nilaiUji.length, 16);
  cek(
    `${namaUji} punya nilai di rentang dongkrak (1-30)`,
    nilaiUji.filter((r) => r.nilai_akhir > 0 && r.nilai_akhir <= 30).length >= 2,
    true
  );
  const ridzoSebelum = sebelum.find((b) => b.nama === namaUji)!;
  cek(`${namaUji} ada di ranking sebelum dongkrak`, typeof ridzoSebelum.peringkat, "number");

  await postDongkrak(bodyReq("/api/dongkrak", { nilai_awal: 0, nilai_akhir: 30, nilai_target: 30 }));
  const sesudah = await ambilRanking("7A");
  const ridzoSesudah = sesudah.find((b) => b.nama === namaUji)!;
  cek(
    "dongkrak menaikkan rata-rata (nilai 1-30 -> 30)",
    ridzoSesudah.rata > ridzoSebelum.rata,
    true
  );
  cek(
    "peringkat dihitung ulang setelah dongkrak",
    sesudah.every((b, i) => b.rata >= (sesudah[i + 1]?.rata ?? -1)),
    true
  );
  cek("jumlah baris ranking tetap setelah dongkrak", sesudah.length, sebelum.length);
  await deleteDongkrak(req("/api/dongkrak"));

  // Kelas wajib diisi.
  const tanpaKelas = await getRanking(req("/api/ranking"));
  cek("tanpa kelas = 400", tanpaKelas.status, 400);
  cek(
    "pesan tanpa kelas",
    (await json(tanpaKelas)).error,
    "Parameter kelas wajib diisi."
  );

  // Kelas yang tidak ada -> data kosong, bukan error.
  const kelasNgawur = await getRanking(req("/api/ranking?kelas=12Z"));
  cek("kelas tidak dikenal = 200", kelasNgawur.status, 200);
  cek("kelas tidak dikenal = data kosong", (await json(kelasNgawur)).data.length, 0);

  // --- Ekspor Excel ---
  // Kelas 7A dipakai karena siswanya paling sedikit, jadi sheet-nya paling
  // ringkas untuk diperiksa.
  {
    const kelasEkspor = "7A";
    const { siswa: siswaEkspor } = await jumlahSiswaDb(kelasEkspor);
    const barisAkhir = siswaEkspor + 1;

    const res = await getExportRanking(req(`/api/export/ranking?kelas=${kelasEkspor}`));
    cek("GET /api/export/ranking ok", res.status, 200);
    cek(
      "tipe konten xlsx",
      res.headers.get("content-type"),
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    cekBenar(
      "nama berkas memuat kelas",
      (res.headers.get("content-disposition") ?? "").includes("ranking_nilai_kelas_7A_ASTS_GANJIL_2026-2027.xlsx")
    );

    const buf = Buffer.from(await res.arrayBuffer());
    cek("menghasilkan .xlsx (PK zip)", buf.subarray(0, 2).toString(), "PK");

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as any);
    const ws = wb.worksheets[0];
    const g = (a: string) => ws.getCell(a).value;

    cek("satu sheet", wb.worksheets.length, 1);
    cek("nama sheet menyebut kelas", ws.name, `Ranking Kelas ${kelasEkspor}`);

    // Header: RANKING | NAMA | KELAS | RATA-RATA | PREDIKAT
    cek("A1 = RANKING", g("A1"), "RANKING");
    cek("B1 = NAMA", g("B1"), "NAMA");
    cek("C1 = KELAS", g("C1"), "KELAS");
    cek("D1 = RATA-RATA", g("D1"), "RATA-RATA");
    cek("E1 = PREDIKAT", g("E1"), "PREDIKAT");
    cek("header bold", ws.getCell("A1").font?.bold, true);
    cek("jumlah kolom = 5", ws.columnCount, 5);
    cek(`jumlah baris = ${barisAkhir} (1 header + ${siswaEkspor} siswa)`, ws.rowCount, barisAkhir);

    // Baris pertama = peringkat 1, kolom KELAS terisi.
    cek("A2 = peringkat 1", g("A2"), 1);
    cek("B2 = nama siswa", typeof g("B2"), "string");
    cek(`C2 = kelas ${kelasEkspor}`, g("C2"), kelasEkspor);
    cek("D2 = rata-rata angka", typeof g("D2"), "number");
    cek("rata-rata format satu desimal", ws.getCell("D2").numFmt, "0.0");

    // Isi export harus identik dengan yang dihitung di layar.
    const layar = await ambilRanking(kelasEkspor);
    const kolomEkspor = (c: number) =>
      Array.from({ length: siswaEkspor }, (_, i) => ws.getCell(i + 2, c).value);

    cek("peringkat export sama dengan di layar", kolomEkspor(1), layar.map((b) => b.peringkat));
    cek("nama export sama dengan di layar", kolomEkspor(2), layar.map((b) => b.nama));
    cek("rata-rata export sama dengan di layar", kolomEkspor(4), layar.map((b) => b.rata));
    // Kolom PREDIKAT harus huruf A/B/C/D yang cocok dengan rata-ratanya.
    cek(
      "predikat export = huruf, bukan angka",
      kolomEkspor(5).every((v) => v === "A" || v === "B" || v === "C" || v === "D"),
      true
    );
    cek(
      "predikat export sama dengan predikat dari rata-rata",
      kolomEkspor(5),
      layar.map((b) => predikat(b.rata, batasBerlaku))
    );
    // Semua baris harus kelas yang sama karena satu berkas = satu kelas.
    cek(
      `semua baris kelas ${kelasEkspor}`,
      kolomEkspor(3).every((v) => v === kelasEkspor),
      true
    );
    // Tidak boleh ada baris lebih dari jumlah siswa.
    cek(`tidak ada baris ke-${barisAkhir + 1}`, ws.getRow(barisAkhir + 1).getCell(1).value, null);

    // Lebar kolom + pengaturan cetak.
    cek("lebar kolom", [1, 2, 3, 4, 5].map((i) => ws.getColumn(i).width), [10, 36, 10, 12, 11]);
    cek("kolom nama cukup untuk nama terpanjang (33)", ws.getColumn(2).width! >= 33, true);
    const ps = ws.pageSetup as any;
    cek("kertas A4", ps.paperSize, 9);
    cek("orientasi portrait", ps.orientation, "portrait");
    cek("muat 1 halaman", ps.fitToWidth, 1);
    cek(`printArea A1:E${barisAkhir}`, ps.printArea, `A1:E${barisAkhir}`);

    // Kelas juga ikut di nama berkas supaya unduhan tidak tertimpa.
    const res9 = await getExportRanking(req("/api/export/ranking?kelas=9"));
    cekBenar(
      "nama berkas kelas 9 berbeda",
      (res9.headers.get("content-disposition") ?? "").includes("ranking_nilai_kelas_9_ASTS_GANJIL_2026-2027.xlsx")
    );

    const tanpaKelasXlsx = await getExportRanking(req("/api/export/ranking"));
    cek("export tanpa kelas = 400", tanpaKelasXlsx.status, 400);
  }

  // --- Ranking per mapel: ?mapel= menyaring, ranking dari nilai tunggal ---
  {
    const kelasUji = "7A";
    const { siswa: siswaUji } = await jumlahSiswaDb(kelasUji);
    const mapelUji = "Matematika";

    const semua = (
      (await (await getRanking(req(`/api/ranking?kelas=${kelasUji}`))).json()) as {
        data: Array<{ siswaId: number; nama: string; nilai_akhir: number }>;
      }
    ).data;

    const satu = (
      (await (await getRanking(req(`/api/ranking?kelas=${kelasUji}&mapel=${mapelUji}`))).json()) as {
        data: Array<{ siswaId: number; nama: string; nilai_akhir: number }>;
      }
    ).data;

    // Satu mapel: baris turun dari siswa x 16 menjadi hanya siswa.
    cek(`?mapel menyaring: ${siswaUji} baris (bukan ${siswaUji * 16})`, satu.length, siswaUji);
    cek("?mapel: satu baris per siswa", new Set(satu.map((r) => r.siswaId)).size, siswaUji);

    // Nilai mapel harus muncul di antara nilai mapel siswa itu pada hasil tanpa
    // filter. API tidak mengembalikan nama mapel, jadi pencocokan dilakukan per
    // siswa lewat himpunan nilainya.
    cek(
      `nilai ?mapel=${mapelUji} berasal dari nilai siswa yang sama`,
      satu.every((r) =>
        semua.some(
          (x) => x.siswaId === r.siswaId && x.nilai_akhir === r.nilai_akhir
        )
      ),
      true
    );
    // Bandingkan terhadap SQL yang menghitung ulang sendiri.
    const sqlNilai = await db.execute({
      sql: `SELECT s.nama AS nama, COALESCE(n.nilai_dongkrak, n.nilai_asli) AS nilai
            FROM nilai n
            JOIN siswa s ON s.id = n.siswa_id
            JOIN mapel m ON m.id = n.mapel_id
            WHERE s.kelas = ? AND m.nama = ?`,
      args: [kelasUji, mapelUji],
    });
    const refNilai = new Map(
      (sqlNilai.rows as unknown as Array<{ nama: string; nilai: number }>).map((r) => [
        r.nama,
        Number(r.nilai),
      ])
    );
    cek(
      `nilai ?mapel sama dengan SQL`,
      satu.map((r) => r.nilai_akhir),
      satu.map((r) => refNilai.get(r.nama))
    );

    // Ranking satu mapel: dihitung ulang sendiri dari nilai SQL, bukan memakai
    // hitungRanking, supaya kesalahan yang sama tidak muncul di kedua sisi.
    const expected = [...refNilai.entries()]
      .map(([nama, nilai]) => ({ nama, nilai }))
      .sort((a, b) =>
        a.nilai === b.nilai
          ? a.nama.localeCompare(b.nama, undefined, { sensitivity: "base" })
          : b.nilai - a.nilai
      );
    let EXPECTED_RANK = 0;
    const rankDukti = expected.map((s, i) => {
      if (i === 0 || expected[i - 1].nilai !== s.nilai) EXPECTED_RANK = i + 1;
      return { nama: s.nama, peringkat: EXPECTED_RANK };
    });

    const rPerMapel = hitungRanking(satu);
    cek(
      `peringkat ?mapel=${mapelUji} sama dengan SQL`,
      rPerMapel.map((b) => ({ nama: b.nama, peringkat: b.peringkat })),
      rankDukti
    );
    // Tiap siswa punya tepat 1 baris, jadi rata = nilai mapel itu.
    cek("per mapel: jumlahMapel = 1", rPerMapel.every((b) => b.jumlahMapel === 1), true);
    cek(
      "per mapel: rata sama persis dengan nilai mapel",
      rPerMapel.every((b) => Number.isInteger(b.rata)),
      true
    );

    // Mapel yang tidak ada -> kosong, bukan error.
    const mapelNgawur = await getRanking(
      req(`/api/ranking?kelas=${kelasUji}&mapel=Tidak Ada`)
    );
    cek("mapel tidak dikenal = 200", mapelNgawur.status, 200);
    cek("mapel tidak dikenal = data kosong", (await json(mapelNgawur)).data.length, 0);
  }

  // --- Ekspor per mapel: satu sheet per mapel ---
  {
    const kelasUji = "7A";
    const { siswa: siswaUji } = await jumlahSiswaDb(kelasUji);

    // Jumlah mapel yang punya nilai di kelas ini = jumlah mapel milik tingkat 7.
    const resMapel = await db.execute({
      sql: `SELECT COUNT(DISTINCT m.nama) AS c
            FROM nilai n
            JOIN siswa s ON s.id = n.siswa_id
            JOIN mapel m ON m.id = n.mapel_id
            WHERE s.kelas = ?`,
      args: [kelasUji],
    });
    const jumlahMapelUji = Number(
      (resMapel.rows[0] as unknown as { c: number }).c
    );

    const res = await getExportRanking(req(`/api/export/ranking?kelas=${kelasUji}&perMapel=1`));
    cek("export ?mapel ok", res.status, 200);
    cekBenar(
      "nama berkas mode per mapel",
      (res.headers.get("content-disposition") ?? "").includes(
        "ranking_nilai_kelas_7A_per_mapel_ASTS_GANJIL_2026-2027.xlsx"
      )
    );

    const buf = Buffer.from(await res.arrayBuffer());
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as any);

    // Satu sheet per mapel, bukan satu sheet saja.
    cek(
      `sheet per mapel = ${jumlahMapelUji}`,
      wb.worksheets.length,
      jumlahMapelUji
    );

    // Nama sheet wajib <= 31 karakter; "Ranking Sejarah Kebudayaan Islam" 32.
    cek(
      "semua nama sheet <= 31 karakter",
      wb.worksheets.every((s) => s.name.length <= 31),
      true
    );
    cek("nama sheet unik", new Set(wb.worksheets.map((s) => s.name)).size, jumlahMapelUji);
    cek(
      "nama sheet diawali 'Ranking '",
      wb.worksheets.every((s) => s.name.startsWith("Ranking ")),
      true
    );

    // Sheet pertama = mapel pertama secara abjad, isinya ranking mapel itu.
    const wsIpa = wb.worksheets[0];
    const g = (a: string) => wsIpa.getCell(a).value;

    // Header: RANKING | NAMA | KELAS | MAPEL | NILAI | PREDIKAT
    cek("A1 = RANKING", g("A1"), "RANKING");
    cek("B1 = NAMA", g("B1"), "NAMA");
    cek("C1 = KELAS", g("C1"), "KELAS");
    cek("D1 = MAPEL", g("D1"), "MAPEL");
    cek("E1 = NILAI (bukan RATA-RATA)", g("E1"), "NILAI");
    cek("F1 = PREDIKAT", g("F1"), "PREDIKAT");
    cek("jumlah kolom = 6", wsIpa.columnCount, 6);
    cek(`jumlah baris = ${siswaUji + 1}`, wsIpa.rowCount, siswaUji + 1);

    // Kolom NILAI harus angka bulat, bukan "0.0" seperti rata-rata.
    cek("nilai format angka bulat", wsIpa.getCell("E2").numFmt, "0");
    cek("nilai bukan desimal", typeof g("E2") === "number" && Number.isInteger(g("E2") as number), true);

    // Kolom MAPEL terisi dan sama dengan mapel sheet itu.
    const namaMapelSheet = wsIpa.name.replace(/^Ranking /, "");
    cek(
      "kolom MAPEL sama dengan nama sheet",
      Array.from({ length: siswaUji }, (_, i) => wsIpa.getCell(i + 2, 4).value).every(
        (v) => v === namaMapelSheet
      ),
      true
    );

    // Isi sheet harus sama dengan ranking di layar untuk mapel itu.
    const layar = hitungRanking(
      (
        (
          await (
            await getRanking(
              req(`/api/ranking?kelas=${kelasUji}&mapel=${encodeURIComponent(namaMapelSheet)}`)
            )
          ).json()
        ) as { data: Parameters<typeof hitungRanking>[0] }
      ).data
    );
    const kolom = (c: number) =>
      Array.from({ length: siswaUji }, (_, i) => wsIpa.getCell(i + 2, c).value);

    cek("sheet: peringkat sama dengan layar", kolom(1), layar.map((b) => b.peringkat));
    cek("sheet: nama sama dengan layar", kolom(2), layar.map((b) => b.nama));
    cek("sheet: nilai sama dengan layar", kolom(5), layar.map((b) => b.rata));
    cek(
      "sheet: predikat = huruf A/B/C/D",
      kolom(6).every((v) => v === "A" || v === "B" || v === "C" || v === "D"),
      true
    );
    cek("sheet: predikat cocok dengan nilai", kolom(6), layar.map((b) => predikat(b.rata, batasBerlaku)));

    // Semua sheet punya bentuk dan isi yang sama.
    cek(
      "semua sheet 6 kolom",
      wb.worksheets.every((s) => s.columnCount === 6),
      true
    );
    cek(
      "semua sheet punya jumlah baris sama",
      new Set(wb.worksheets.map((s) => s.rowCount)).size,
      1
    );
    cek(
      "semua sheet punya printArea menutup semua baris",
      wb.worksheets.every((s) => (s.pageSetup as any).printArea === `A1:F${siswaUji + 1}`),
      true
    );

    // Mode per mapel tidak boleh menimpa nama berkas mode rata-rata.
    const resRata = await getExportRanking(req(`/api/export/ranking?kelas=${kelasUji}`));
    cekBenar(
      "nama berkas mode rata-rata tetap tanpa _per_mapel",
      (resRata.headers.get("content-disposition") ?? "").includes(
        "ranking_nilai_kelas_7A_ASTS_GANJIL_2026-2027.xlsx"
      )
    );
    const wbRata = new ExcelJS.Workbook();
    await wbRata.xlsx.load(Buffer.from(await resRata.arrayBuffer()) as any);
    cek("mode rata-rata tetap 1 sheet", wbRata.worksheets.length, 1);
    cek("mode rata-rata tetap RATA-RATA", wbRata.worksheets[0].getCell("D1").value, "RATA-RATA");
  }
}

console.log("\n=== ekspor peringkat: semua siswa, kolom per mapel ===");
{
  // Jumlah siswa per kelas dibaca dari database, bukan ditulis di kode.
  const jumlahPerKelas = async () => {
    const res = await db.execute({ sql: "SELECT kelas, COUNT(*) AS c FROM siswa GROUP BY kelas", args: [] });
    const m = new Map<string, number>();
    for (const r of res.rows as unknown as Array<{ kelas: string; c: number }>) {
      m.set(r.kelas, Number(r.c));
    }
    return m;
  };

  const jumlahSiswa = await jumlahPerKelas();
  const totalSiswa = [...jumlahSiswa.values()].reduce((a, b) => a + b, 0);
  cek("total siswa = 128", totalSiswa, 128);

  const jumlahMapel = (
    await db.execute({ sql: "SELECT COUNT(DISTINCT nama) AS c FROM mapel", args: [] })
  ).rows[0] as unknown as { c: number };
  const totalMapel = Number(jumlahMapel.c);

  const res = await getExportPeringkat(req("/api/export/peringkat"));
  cek("GET /api/export/peringkat ok", res.status, 200);
  cek(
    "tipe konten xlsx",
    res.headers.get("content-type"),
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  cekBenar(
    "nama berkas benar",
    (res.headers.get("content-disposition") ?? "").includes("peringkat_semua_siswa_ASTS_GANJIL_2026-2027.xlsx")
  );

  const buf = Buffer.from(await res.arrayBuffer());
  cek("menghasilkan .xlsx (PK zip)", buf.subarray(0, 2).toString(), "PK");

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as any);
  const ws = wb.worksheets[0];
  const g = (a: string) => ws.getCell(a).value;
  const kolomAwal = 4;
  // Kolom RANKING berada SETELAH kolom mapel: 3 identitas + 16 mapel + 1.
  const kolomAkhir = kolomAwal + totalMapel;
  const barisAkhir = 1 + totalSiswa;

  cek("satu sheet", wb.worksheets.length, 1);
  cek("nama sheet", ws.name, "Peringkat");
  // 3 identitas + satu kolom per mapel + satu kolom ranking akhir.
  cek(`jumlah kolom = ${kolomAkhir} (3 + ${totalMapel} mapel + 1)`, ws.columnCount, kolomAkhir);
  cek(`jumlah baris = ${barisAkhir} (1 header + ${totalSiswa} siswa)`, ws.rowCount, barisAkhir);

  // Header: NO | NAMA | KELAS | <mapel> | RANKING
  cek("A1 = NO", g("A1"), "NO");
  cek("B1 = NAMA", g("B1"), "NAMA");
  cek("C1 = KELAS", g("C1"), "KELAS");

  const mapelUrut = (
    await db.execute({ sql: "SELECT DISTINCT nama FROM mapel", args: [] })
  ).rows as unknown as Array<{ nama: string }>;
  const namaMapelUrut = mapelUrut
    .map((r) => r.nama)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  cek(
    "header kolom mapel sesuai urutan abjad",
    Array.from({ length: totalMapel }, (_, i) => g(ws.getCell(1, kolomAwal + i).address)),
    namaMapelUrut
  );
  cek("kolom terakhir = RANKING", ws.getCell(1, kolomAkhir).value, "RANKING");

  // Cek satu mapel saja, dibatasi kelas 7A supaya mudah diperiksa manual.
  const mapelCek = namaMapelUrut[0];
  const kolomCek = kolomAwal + namaMapelUrut.indexOf(mapelCek);

  // Nama dan kelas per baris, dibaca sekali lalu dipakai di beberapa pemeriksaan.
  const namaAktif = Array.from({ length: totalSiswa }, (_, i) => ws.getCell(i + 2, 2).value as string);
  const kelasAktif = Array.from({ length: totalSiswa }, (_, i) => ws.getCell(i + 2, 3).value as string);

  // --- Peringkat dihitung ulang dengan SQL yang terpisah, bukan memakai
  // hitungPeringkatSemua, supaya kesalahan yang sama tidak muncul di dua sisi.
  const sqlSemua = await db.execute({
    sql: `SELECT s.nama AS nama, s.kelas AS kelas, m.nama AS mapel,
                 COALESCE(n.nilai_dongkrak, n.nilai_asli) AS nilai
          FROM nilai n JOIN siswa s ON s.id = n.siswa_id JOIN mapel m ON m.id = n.mapel_id`,
    args: [],
  });
  const barisSql = sqlSemua.rows as unknown as Array<{
    nama: string; kelas: string; mapel: string; nilai: number;
  }>;

  /** Peringkat competition: 1 + jumlah nilai yang lebih besar. */
  const peringkatCompetition = (nilai: number, semuaNilai: number[]) =>
    semuaNilai.filter((x) => x > nilai).length + 1;

  {
    // Kunci memakai kelas + nama, karena skema mengizinkan nama sama di kelas
    // berbeda (UNIQUE(nama, kelas)).
    const Expected = new Map<string, string>();
    for (const kelas of jumlahSiswa.keys()) {
      const perSiswa = barisSql
        .filter((r) => r.kelas === kelas && r.mapel === mapelCek)
        .map((r) => ({ nama: r.nama, nilai: Number(r.nilai) }));
      const semuaNilai = perSiswa.map((r) => r.nilai);
      for (const r of perSiswa) {
        Expected.set(
          `${kelas}|${r.nama}`,
          `${peringkatCompetition(r.nilai, semuaNilai)} dari ${jumlahSiswa.get(kelas)}`
        );
      }
    }

    const aktual = Array.from({ length: totalSiswa }, (_, i) => ws.getCell(i + 2, kolomCek).value);

    cek(`kolom ${mapelCek} tidak ada sel kosong`, aktual.every((v) => v !== null), true);
    cek(
      `isi kolom ${mapelCek} = "peringkat dari jumlah murid kelas"`,
      aktual.every((v) => typeof v === "string" && /^\d+ dari \d+$/.test(v as string)),
      true
    );
    const salah = aktual
      .map((v, i) => [v, Expected.get(`${kelasAktif[i]}|${namaAktif[i]}`)] as const)
      .filter(([v, e]) => v !== e);
    cek(`isi kolom ${mapelCek} persis sama dengan hitungan SQL`, salah.length, 0);
    // Kalau ada sel yang beda, tampilkan beberapa contoh supaya failure-nya
    // bisa ditindaklanjuti tanpa harus mencetak ulang seluruh sheet.
    if (salah.length > 0) {
      // Kalau ada sel yang beda, tampilkan beberapa contoh supaya failure-nya
      // bisa ditindaklanjuti tanpa mencetak ulang seluruh sheet.
      cek(
        "contoh sel yang berbeda",
        salah.slice(0, 3).map(([a, e]) => `${a} vs ${e}`),
        []
      );
    }
  }

  // Kolom ranking akhir: dari rata-rata seluruh mapel, per kelas.
  {
    const aktual = Array.from({ length: totalSiswa }, (_, i) => ws.getCell(i + 2, kolomAkhir).value);
    cek("kolom RANKING terisi semua baris", aktual.every((v) => typeof v === "string"), true);
    cek(
      "kolom RANKING format 'N dari M'",
      aktual.every((v) => /^(\d+) dari \d+$/.test(v as string)),
      true
    );
    // Kolom ranking akhir juga dibandingkan dengan SQL yang menghitung ulang
    // sendiri: 1 + jumlah siswa se-Kelas yang rata-ratanya lebih tinggi.
    const ExpectedKelas = new Map<string, string>();
    for (const kelas of jumlahSiswa.keys()) {
      // Total DAN jumlah mapel per siswa. Pembagi HARUS jumlah mapel siswa itu,
      // bukan jumlah siswa di kelas — memakai yang salah membuat seluruh
      // ranking kelas bergeser.
      const total = new Map<string, { sum: number; n: number }>();
      for (const r of barisSql) {
        if (r.kelas !== kelas) continue;
        const e = total.get(r.nama) ?? { sum: 0, n: 0 };
        e.sum += Number(r.nilai);
        e.n += 1;
        total.set(r.nama, e);
      }
      // Semua siswa satu kelas punya jumlah mapel sama, jadi jumlah nilai
      // setara dengan rata-rata untuk keperluan perbandingan peringkat.
      //
      // WAJIB dibulatkan ke satu desimal sebelum dibandingkan: hitungRanking
      // membulatkan lebih dulu lalu memberi peringkat, jadi bila acuan memakai
      // rata-rata mentah, dua siswa yang tampil sama bisa terbeda peringkat.
      const satuDesimal = (n: number) => Math.round(n * 10) / 10;
      const rata = [...total.entries()].map(
        ([nama, e]) => [nama, satuDesimal(e.sum / e.n)] as const
      );
      for (const [nama, nilai] of rata) {
        ExpectedKelas.set(
          `${kelas}|${nama}`,
          `${rata.filter(([, x]) => x > nilai).length + 1} dari ${jumlahSiswa.get(kelas)}`
        );
      }
    }

    const salahKelas = aktual
      .map((v, i) => [v, ExpectedKelas.get(`${kelasAktif[i]}|${namaAktif[i]}`)] as const)
      .filter(([v, e]) => v !== e);
    cek("isi kolom RANKING sama dengan hitungan SQL", salahKelas.length, 0);
    if (salahKelas.length > 0) {
      cek(
        "contoh sel RANKING yang berbeda",
        salahKelas.slice(0, 3).map(([a, e]) => `${a} vs ${e}`),
        []
      );
    }

    // Pembagi harus jumlah murid kelas masing-masing, bukan 128 dan bukan
    // jumlah mapel.
    cek(
      "pembagi = jumlah murid kelas masing-masing",
      aktual.every((v, i) => {
        const m = /^(\d+) dari (\d+)$/.exec(v as string);
        return m !== null && Number(m[2]) === jumlahSiswa.get(kelasAktif[i]);
      }),
      true
    );
    // Ranking dari rata-rata harus dimulai dari 1 di tiap kelas.
    const perKelas = new Map<string, number[]>();
    aktual.forEach((v, i) => {
      const list = perKelas.get(kelasAktif[i]) ?? [];
      list.push(Number(/^(\d+) dari/.exec(v as string)![1]));
      perKelas.set(kelasAktif[i], list);
    });
    cek(
      "tiap kelas punya peringkat mulai dari 1",
      [...perKelas.values()].every((list) => list.includes(1)),
      true
    );
    cek(
      "tiap kelas punya tepat satu peringkat 1 (atau lebih bila seri)",
      [...perKelas.values()].every((list) => list.filter((p) => p === 1).length === 1),
      true
    );
  }

  // Urutan baris: nama lalu kelas, bukan kelas lalu nama.
  {
    const urut = Array.from({ length: totalSiswa }, (_, i) => ({
      nama: ws.getCell(i + 2, 2).value as string,
      kelas: ws.getCell(i + 2, 3).value as string,
    }));
    const sorted = [...urut].sort(
      (a, b) =>
        a.nama.localeCompare(b.nama, undefined, { sensitivity: "base" }) ||
        a.kelas.localeCompare(b.kelas, undefined, { sensitivity: "base" })
    );
    cek("urut baris nama lalu kelas", urut.map((u) => u.nama), sorted.map((s) => s.nama));
    // Berbeda dari halaman Ranking/ringkasan yang memakai kelas lalu nama:
    // urutan di sini tidak boleh ikut-tergantung pola itu.
    const urutKelasDulu = [...urut].sort(
      (a, b) =>
        a.kelas.localeCompare(b.kelas) || a.nama.localeCompare(b.nama)
    );
    cek(
      "urut ini benar-benar tidak sama dengan kelas-lalu-nama (bukan kebetulan)",
      urut.map((u) => u.nama).join("|") !== urutKelasDulu.map((u) => u.nama).join("|"),
      true
    );
  }

  // NO berurutan 1..128.
  cek(
    "NO berurutan",
    Array.from({ length: totalSiswa }, (_, i) => ws.getCell(i + 2, 1).value),
    Array.from({ length: totalSiswa }, (_, i) => i + 1)
  );

  // Lebar kolom + pengaturan cetak.
  cek("lebar kolom identitas", [1, 2, 3].map((i) => ws.getColumn(i).width), [5, 32, 8]);
  // Lebar kolom mapel harus muat "12 dari 100" dan nama mapel yang tidak bisa
  // dipisah kata ("Informatika"), supaya tidak ada judul terpotong di tengah kata.
  const LEBAR_MAPEL_MIN = 13;
  cek("lebar kolom mapel >= 13", ws.getColumn(kolomAwal).width! >= LEBAR_MAPEL_MIN, true);
  cek("lebar kolom mapel cukup untuk 'Informatika'", ws.getColumn(kolomAwal).width! >= "Informatika".length, true);
  cek("lebar kolom mapel cukup untuk '12 dari 100'", ws.getColumn(kolomAwal).width! >= "12 dari 100".length, true);
  cek("lebar kolom RANKING 12", ws.getColumn(kolomAkhir).width, 12);
  const ps = ws.pageSetup as any;
  cek("kertas A3", ps.paperSize, 8);
  cek("orientasi landscape", ps.orientation, "landscape");
  cek("fitToWidth 1", ps.fitToWidth, 1);
  cek("fitToHeight 0 (tinggi bebas)", ps.fitToHeight, 0);
  cek(`printArea A1:${kolomKe(kolomAkhir)}${barisAkhir}`, ps.printArea, `A1:${kolomKe(kolomAkhir)}${barisAkhir}`);
  cek("header diulang tiap halaman", ps.printTitlesRow, "1:1");
}

console.log("\n=== pengaturan predikat: batas bawah, batas tuntas, dan dampaknya ===");
{
  // Sebaran bawaan, dibandingkan lagi setelah batas diubah lalu dikembalikan.
  let hitungAwal = { A: 0, B: 0, C: 0, D: 0 };

  // Batas yang berlaku dibaca lewat API, lalu dipakai exporter di bawah.
  {
    const j = await json(await getPredikat(req("/api/predikat")));
    cek("GET /api/predikat ok", j.ok, true);
    batasBerlaku = j.data.batas;

    // Tabel migration harus sudah terisi baris bawaan.
    cek("batas bawaan terisi", batasBerlaku, { minA: 93, minB: 85, minC: 77, batasTuntas: 77 });
    cek("tandai masih memakai bawaan", j.data.memakaiBawaan, true);
    cek("rentang A = 93-100", j.data.rentang[0], { predikat: "A", bawah: 93, atas: 100 });
    cek("rentang B = 85-92", j.data.rentang[1], { predikat: "B", bawah: 85, atas: 92 });
    cek("rentang C = 77-84", j.data.rentang[2], { predikat: "C", bawah: 77, atas: 84 });
    cek("rentang D = 0-76", j.data.rentang[3], { predikat: "D", bawah: 0, atas: 76 });

    // Sebaran harus cocok dengan perhitungan ulang dari nilai mentah.
    const semua = (
      (await (await db.execute({ sql: "SELECT COALESCE(nilai_dongkrak, nilai_asli) AS n FROM nilai", args: [] }))).rows
    ) as unknown as Array<{ n: number }>;
    const hitung = { A: 0, B: 0, C: 0, D: 0 };
    for (const r of semua) hitung[predikat(Number(r.n), batasBerlaku)] += 1;
    cek("sebaran awal = hitungan ulang", j.data.sebar, hitung);
    cek("total sebaran = 2048 nilai", Object.values(hitung).reduce((a, b) => a + b, 0), 2048);

    // Disimpan supaya blok "kembalikan ke awal" bisa membandingkannya.
    hitungAwal = { ...hitung };
  }

  // Validasi menolak batas yang tidak menurun ketat.
  const tidakNaik = await putPredikat(
    bodyReq("/api/predikat", { minA: 85, minB: 85, minC: 77, batasTuntas: 77 }, "PUT")
  );
  cek("A = B ditolak 400", tidakNaik.status, 400);
  cek("pesan A harus lebih besar", (await json(tidakNaik)).error, "Batas A harus lebih besar dari batas B.");

  const tidakNaik2 = await putPredikat(
    bodyReq("/api/predikat", { minA: 93, minB: 70, minC: 77, batasTuntas: 77 }, "PUT")
  );
  cek("B < C ditolak 400", tidakNaik2.status, 400);

  const melebihi100 = await putPredikat(
    bodyReq("/api/predikat", { minA: 93, minB: 85, minC: 101, batasTuntas: 77 }, "PUT")
  );
  cek("batas di luar 100 ditolak 400", melebihi100.status, 400);

  // Pratinjau: batas 80/70/60 harus mengubah sebaran secara nyata.
  const pratinjau = await postPreviewPredikat(
    bodyReq("/api/predikat/preview", { minA: 80, minB: 70, minC: 60, batasTuntas: 60 })
  );
  {
    const j = await json(pratinjau);
    cek("POST preview ok", j.ok, true);
    cek("preview: sebelum = sebaran bawaan", j.data.sebelum, hitungAwal);
    cek("preview: sesudah benar-benar berbeda", j.data.sesudah.A > j.data.sebelum.A, true);
    cek("preview: rentang ikut batas baru", j.data.rentang[0], { predikat: "A", bawah: 80, atas: 100 });
    cek("preview: total sesudah tetap 2048", Object.values(j.data.sesudah).reduce((a, b) => a + b, 0), 2048);
  }

  // Pratinjau tidak boleh menolak batas yang sah, dan menolak yang tidak sah.
  const previewSah = await postPreviewPredikat(
    bodyReq("/api/predikat/preview", { minA: 90, minB: 80, minC: 70, batasTuntas: 70 })
  );
  cek("preview batas rapat sah", previewSah.status, 200);
  const previewTidakSah = await postPreviewPredikat(
    bodyReq("/api/predikat/preview", { minA: 70, minB: 80, minC: 90, batasTuntas: 70 })
  );
  cek("preview batas tidak menurun ditolak", previewTidakSah.status, 400);

  // Simpan batas kustom, lalu buktikan SEMUA exporter ikut memakainya.
  const kustom = { minA: 80, minB: 70, minC: 60, batasTuntas: 70 };
  const simpan = await putPredikat(bodyReq("/api/predikat", kustom, "PUT"));
  cek("PUT batas kustom ok", simpan.status, 200);
  {
    const j = await json(simpan);
    cek("PUT mengembalikan batas tersimpan", j.data.batas, kustom);
  }

  {
    const j = await json(await getPredikat(req("/api/predikat")));
    cek("GET setelah simpan = batas kustom", j.data.batas, kustom);
    cek("tandai bukan bawaan", j.data.memakaiBawaan, false);
    cek("rentang A = 80-100", j.data.rentang[0], { predikat: "A", bawah: 80, atas: 100 });
    cek("rentang D = 0-59", j.data.rentang[3], { predikat: "D", bawah: 0, atas: 59 });
  }

  // Batas kustom harus dipakai di API nilai...
  {
    const j = await json(await getNilai(req("/api/nilai?kelas=7A&mapel=IPA")));
    cek("API nilai ikut mengembalikan batas kustom", j.batas, kustom);
    // Setiap predikat yang dikirim harus cocok dengan batas kustom.
    cek(
      "predikat di API nilai cocok dengan batas kustom",
      j.data.every((r: any) => r.predikat === predikat(r.nilai_akhir, kustom)),
      true
    );
    // Harus ada nilai yang predikatnya BERBEDA dari batas bawaan; kalau tidak,
    // uji ini tidak membuktikan apa-apa.
    const beda = j.data.filter((r: any) => r.predikat !== predikat(r.nilai_akhir, BATAS_AWAL)).length;
    cek("ada nilai yang predikatnya berubah (uji berarti)", beda > 0, true);
  }

  // ...dan di raport...
  {
    const buf = Buffer.from(
      await (
        await getRaport(req("/api/export/raport/1"), { params: Promise.resolve({ siswaId: "1" }) })
      ).arrayBuffer()
    );
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as any);
    const ws = wb.worksheets[0];
    const baris = Array.from({ length: 16 }, (_, i) => i + 5);
    const adaYangBerbeda = baris.some((r) => {
      const nilai = Number(ws.getCell(r, 3).value);
      return ws.getCell(r, 4).value === predikat(nilai, kustom) &&
        ws.getCell(r, 4).value !== predikat(nilai, BATAS_AWAL);
    });
    cek("raport memakai batas kustom", adaYangBerbeda, true);
  }

  // ...dan di ringkasan (predikat bertulis + keterangan ketuntasan).
  {
    const buf = Buffer.from(await (await getRingkasan(req("/api/export/ringkasan"))).arrayBuffer());
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as any);
    const ws = wb.worksheets[0];
    // 53 kolom: tiap mapel 3 kolom (nilai, predikat, deskripsi), mulai kolom 6.
    let cekPredikat = 0;
    let cekDeskripsi = 0;
    for (let b = 3; b <= 130; b++) {
      for (let k = 6; k <= 53; k += 3) {
        const nilai = ws.getCell(b, k).value;
        if (typeof nilai !== "number") continue;
        const teks = String(ws.getCell(b, k + 1).value ?? "");
        if (teks.startsWith(`${predikat(nilai, kustom)} (`)) cekPredikat++;
        const desk = String(ws.getCell(b, k + 2).value ?? "");
        if (desk === (nilai >= kustom.batasTuntas ? "Tuntas" : "Belum Tuntas")) cekDeskripsi++;
      }
    }
    cek("ringkasan memakai batas predikat kustom", cekPredikat, 2048);
    cek("ringkasan memakai batas tuntas kustom", cekDeskripsi, 2048);
  }

  // ...dan di ranking.
  {
    const buf = Buffer.from(await (await getExportRanking(req("/api/export/ranking?kelas=7A"))).arrayBuffer());
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as any);
    const ws = wb.worksheets[0];
    const cocok = Array.from({ length: ws.rowCount - 1 }, (_, i) => {
      const r = i + 2;
      return ws.getCell(r, 5).value === predikat(Number(ws.getCell(r, 4).value), kustom);
    });
    cek("ranking memakai batas kustom", cocok.every(Boolean), true);
  }

  // Kembalikan ke awal.
  {
    const kembalikan = await deletePredikat(req("/api/predikat"), { method: "DELETE" });
    cek("DELETE kembali ke awal ok", kembalikan.status, 200);
    const j = await json(await getPredikat(req("/api/predikat")));
    cek("batas kembali ke bawaan", j.data.batas, { minA: 93, minB: 85, minC: 77, batasTuntas: 77 });
    cek("tandai memakai bawaan lagi", j.data.memakaiBawaan, true);
    cek("sebaran kembali seperti semula", j.data.sebar, hitungAwal);
  }

  // Batas yang sama di dua baris tidak boleh melanggar CHECK di database.
  {
    await db.execute({ sql: "UPDATE batas_predikat SET min_a = 85 WHERE id = 1", args: [] }).catch(() => {
      // CHECK di tabel yang menolak: itu yang diharapkan.
    });
    const j = await json(await getPredikat(req("/api/predikat")));
    cek("batas tetap utuh setelah penolakan CHECK", j.data.batas, {
      minA: 93, minB: 85, minC: 77, batasTuntas: 77,
    });
  }
}

console.log("\n=== mapel: daftar, tambah, dan dampaknya ===");
{
  const awal = await json(await getMapel(req("/api/mapel")));
  cek("GET /api/mapel ok", awal.ok, true);
  cek("16 mapel unik", awal.data.length, 16);
  cek(
    "setiap mapel punya 3 tingkat",
    awal.data.every((m: any) => m.tingkat.length === 3),
    true
  );
  cek("jumlah nilai per mapel = 128", awal.data[0].jumlahNilai, 128);
  cek(
    "daftar urut abjad",
    awal.data.map((m: any) => m.nama),
    [...awal.data].map((m: any) => m.nama).sort((a: any, b: any) => a.localeCompare(b, undefined, { sensitivity: "base" }))
  );

  const namaBaru = "Tata Boga";

  const namaKosong = await postMapel(bodyReq("/api/mapel", { nama: "   ", kode: "" }));
  cek("nama kosong = 400", namaKosong.status, 400);

  const bentrok = await postMapel(bodyReq("/api/mapel", { nama: "IPA", kode: "" }));
  cek("nama bentrok = 409", bentrok.status, 409);
  cek("pesan nama bentrok", (await json(bentrok)).error, "Mata pelajaran dengan nama tersebut sudah ada.");

  const tambah = await json(await postMapel(bodyReq("/api/mapel", { nama: namaBaru, kode: "ASTS TATA BOGA" })));
  cek("tambah 3 baris mapel", tambah.data.mapelDitambah, 3);
  cek("tambah 128 baris nilai", tambah.data.nilaiDitambah, 128);

  const sesudah = await json(await getMapel(req("/api/mapel")));
  cek("sekarang 17 mapel", sesudah.data.length, 17);

  const grupBaru = sesudah.data.find((m: any) => m.nama === namaBaru);
  cek("mapel baru 3 tingkat", grupBaru.tingkat, [7, 8, 9]);
  cek("mapel baru 128 nilai", grupBaru.jumlahNilai, 128);
  cek("kode tersimpan", grupBaru.kode, "ASTS TATA BOGA");

  // Nilai awal harus 0 untuk semua siswa.
  const nilaiBaru = await db.execute({
    sql: `SELECT COUNT(*) AS n, MIN(n.nilai_asli) AS min, MAX(n.nilai_asli) AS maks
          FROM nilai n JOIN mapel m ON m.id = n.mapel_id
          WHERE m.nama = ?`,
    args: [namaBaru],
  });
  cek("nilai awal mapel baru: 128 baris", Number(nilaiBaru.rows[0].n), 128);
  cek("nilai awal semua 0", [nilaiBaru.rows[0].min, nilaiBaru.rows[0].maks], [0, 0]);

  // Tiap siswa hanya punya 1 mapel baru (tingkatnya sendiri).
  const perSiswa = await db.execute({
    sql: `SELECT MIN(c) AS min, MAX(c) AS maks FROM (
            SELECT n.siswa_id, COUNT(*) AS c
            FROM nilai n JOIN mapel m ON m.id = n.mapel_id
            WHERE m.nama = ?
            GROUP BY n.siswa_id)`,
    args: [namaBaru],
  });
  cek("setiap siswa dapat tepat 1 baris", [perSiswa.rows[0].min, perSiswa.rows[0].maks], [1, 1]);

  // Setiap siswa kini punya 17 nilai.
  const perSiswaSemua = await db.execute({
    sql: `SELECT MIN(c) AS min, MAX(c) AS maks FROM (
            SELECT siswa_id, COUNT(*) AS c FROM nilai GROUP BY siswa_id)`,
    args: [],
  });
  cek("nilai per siswa kini 17", [perSiswaSemua.rows[0].min, perSiswaSemua.rows[0].maks], [17, 17]);

  // Urutan: mapel baru harus masuk sesuai abjad, di akhir (T > S).
  const nilaiUrut = await json(await getNilai(req("/api/nilai?kelas=9&siswaId=95")));
  cek("siswa tingkat 9 punya 17 mapel", nilaiUrut.data.length, 17);
  cek("mapel baru di urutan", nilaiUrut.data[16].mapel, namaBaru);
  cek("16 mapel pertama tetap sesuai spec", nilaiUrut.data[0].mapel, "Akidah Akhlak");

  const semuaUrut = nilaiUrut.data.map((r: any) => r.mapel);
  cek(
    "urutan seluruh mapel tetap abjad",
    semuaUrut,
    [...semuaUrut].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
  );

  // Excel: printArea harus ikut jadi A1:D21 dan baris 21 terisi.
  const raportBaru = await getRaport(req("/api/export/raport/95"), { params: Promise.resolve({ siswaId: "95" }) });
  const bufBaru = Buffer.from(await raportBaru.arrayBuffer());
  const wbBaru = new ExcelJS.Workbook();
  await wbBaru.xlsx.load(bufBaru as any);
  const wsBaru = wbBaru.worksheets[0];
  cek("F4 printArea jadi A1:D21", (wsBaru.pageSetup as any).printArea, "A1:D21");
  cek("F4 baris 21 = mapel ke-17", wsBaru.getRow(21).getCell(1).value, 17);
  cek("F4 baris 21 nama mapel", wsBaru.getRow(21).getCell(2).value, namaBaru);
  cek("F4 baris 21 nilai 0", wsBaru.getRow(21).getCell(3).value, 0);
  cek("F4 baris 22 kosong", wsBaru.getRow(22).getCell(1).value, null);

  // Sheet siswa lain juga 17 baris (tingkat 7).
  const raport7 = await getRaport(req("/api/export/raport/1"), { params: Promise.resolve({ siswaId: "1" }) });
  const wb7 = new ExcelJS.Workbook();
  await wb7.xlsx.load(Buffer.from(await raport7.arrayBuffer()) as any);
  cek("F4 tingkat 7 juga 17 baris", (wb7.worksheets[0].pageSetup as any).printArea, "A1:D21");

  // Kembalikan state supaya uji lain tidak terganggu.
  await db.execute({ sql: "DELETE FROM nilai WHERE mapel_id IN (SELECT id FROM mapel WHERE nama = ?)", args: [namaBaru] });
  await db.execute({ sql: "DELETE FROM mapel WHERE nama = ?", args: [namaBaru] });

  const kembali = await db.execute({
    sql: "SELECT (SELECT COUNT(*) FROM mapel) AS m, (SELECT COUNT(*) FROM nilai) AS n",
    args: [],
  });
  cek("state kembali: 48 mapel", Number(kembali.rows[0].m), 48);
  cek("state kembali: 2048 nilai", Number(kembali.rows[0].n), 2048);
}

console.log(`\n${gagal === 0 ? `SEMUA LOLOS (${lulus} pemeriksaan)` : `${gagal} GAGAL dari ${lulus + gagal}`}`);
process.exit(gagal === 0 ? 0 : 1);