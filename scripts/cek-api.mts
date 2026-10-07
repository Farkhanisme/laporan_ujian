// Uji end-to-end terhadap database lokal (file:), memakai handler API asli.
// Jalankan: npm run cek:api
// Butuh: scripts/cek-api.sqlite sudah ada (dibuat oleh npm run cek:siapkan).
import { createClient } from "@libsql/client";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";

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