// Uji logika murni (tanpa database): predikat, urutan, nama sheet Excel.
// Jalankan: npm run cek:logic
import {
  BATAS_AWAL,
  batasAtas,
  deskripsiNilai,
  predikat,
  predikatDenganKeterangan,
  predikatLabel,
  type BatasPredikat,
} from "../lib/predikat.ts";
import { validasiBatasPredikat } from "../lib/validasi.ts";
import { hitungRanking, hitungPeringkatSemua, rataKelas } from "../lib/ranking.ts";

/** Batas bawah sebuah predikat, untuk memeriksa rentang tidak bolong. */
function rentangBawahPredikat(p: "A" | "B" | "C" | "D", batas: BatasPredikat): number {
  return p === "D" ? 0 : batas[`min${p}` as "minA" | "minB" | "minC"];
}
import { urutanMapel, urutanSiswa, bisaPindahKelas, URUTAN_KELAS } from "../lib/urutan.ts";
import { namaSheet, sanitizeFilename } from "../lib/nama-sheet.ts";

let gagal = 0;

function cek(nama: string, aktual: unknown, diharapkan: unknown) {
  const ok = JSON.stringify(aktual) === JSON.stringify(diharapkan);
  if (!ok) {
    gagal++;
    console.log(
      `GAGAL  ${nama}\n  aktual    : ${JSON.stringify(aktual)}\n  diharapkan: ${JSON.stringify(diharapkan)}`
    );
  } else {
    console.log(`lulus  ${nama}`);
  }
}

console.log("--- predikat memakai batas bawaan (batas 76/77, 84/85, 92/93) ---");
const b = BATAS_AWAL;
cek("predikat(93) = A", predikat(93, b), "A");
cek("predikat(100) = A", predikat(100, b), "A");
cek("predikat(92) = B", predikat(92, b), "B");
cek("predikat(85) = B", predikat(85, b), "B");
cek("predikat(84) = C", predikat(84, b), "C");
cek("predikat(77) = C", predikat(77, b), "C");
cek("predikat(76) = D", predikat(76, b), "D");
cek("predikat(0) = D", predikat(0, b), "D");

console.log("\n--- keterangan predikat (ditulis di samping hurufnya) ---");
cek("predikatDenganKeterangan(93) = A (Sangat Baik)", predikatDenganKeterangan(predikat(93, b)), "A (Sangat Baik)");
cek("predikatDenganKeterangan(85) = B (Baik)", predikatDenganKeterangan(predikat(85, b)), "B (Baik)");
cek("predikatDenganKeterangan(77) = C (Cukup)", predikatDenganKeterangan(predikat(77, b)), "C (Cukup)");
cek("predikatDenganKeterangan(56) = D (Kurang)", predikatDenganKeterangan(predikat(56, b)), "D (Kurang)");

console.log("\n--- deskripsi nilai memakai batas tuntas ---");
cek("deskripsiNilai(100) = Tuntas", deskripsiNilai(100, b), "Tuntas");
cek("deskripsiNilai(93) = Tuntas", deskripsiNilai(93, b), "Tuntas");
cek("deskripsiNilai(77) = Tuntas (tepat batas)", deskripsiNilai(77, b), "Tuntas");
cek("deskripsiNilai(76) = Belum Tuntas", deskripsiNilai(76, b), "Belum Tuntas");
cek("deskripsiNilai(0) = Belum Tuntas", deskripsiNilai(0, b), "Belum Tuntas");

console.log("\n--- batas predikat kustom mengubah hasil ---");
const kustom: BatasPredikat = { minA: 80, minB: 70, minC: 60, batasTuntas: 60 };
cek("batas kustom: predikat(90) = A", predikat(90, kustom), "A");
cek("batas kustom: predikat(75) = B", predikat(75, kustom), "B");
cek("batas kustom: predikat(65) = C", predikat(65, kustom), "C");
cek("batas kustom: predikat(50) = D", predikat(50, kustom), "D");
// Titik yang sama bisa punya predikat berbeda bila batasnya berbeda.
cek("nilai 77 dengan batas bawaan = C", predikat(77, BATAS_AWAL), "C");
cek("nilai 77 dengan batas kustom = B (di bawah minA 80, di atas minB 70)", predikat(77, kustom), "B");

console.log("\n--- batas atas diturunkan dari batas bawah ---");
cek("batas atas A = 100", batasAtas("A", BATAS_AWAL), 100);
cek("batas atas B = minA - 1", batasAtas("B", BATAS_AWAL), 92);
cek("batas atas C = minB - 1", batasAtas("C", BATAS_AWAL), 84);
cek("batas atas D = minC - 1", batasAtas("D", BATAS_AWAL), 76);

console.log("\n--- label ikut mengikuti batas yang berlaku ---");
cek("label A bawaan", predikatLabel("A", BATAS_AWAL), "A (93–100)");
cek("label B bawaan", predikatLabel("B", BATAS_AWAL), "B (85–92)");
cek("label C bawaan", predikatLabel("C", BATAS_AWAL), "C (77–84)");
cek("label D bawaan", predikatLabel("D", BATAS_AWAL), "D (0–76)");
cek("label A kustom", predikatLabel("A", kustom), "A (80–100)");
cek("label D kustom (bawah selalu 0)", predikatLabel("D", kustom), "D (0–59)");

console.log("\n--- rentang tidak pernah bertindih atau bolong ---");
cek("setiap nilai 0..100 selalu punya tepat satu rentang", (() => {
  for (let n = 0; n <= 100; n++) {
    const p = predikat(n, kustom);
    if (n < rentangBawahPredikat(p, kustom) || n > batasAtas(p, kustom)) return false;
  }
  return true;
})(), true);

console.log("\n--- batas tuntas terpisah dari batas C ---");
// Batas tuntas sengaja tidak otomatis ikut minC: guru boleh memilih KKM
// yang berbeda dari batas predikat C.
const kkm = { ...BATAS_AWAL, batasTuntas: 80 };
cek("KKM 80: nilai 80 = Tuntas", deskripsiNilai(80, kkm), "Tuntas");
cek("KKM 80: nilai 79 = Belum Tuntas", deskripsiNilai(79, kkm), "Belum Tuntas");
cek("KKM 80: predikat(79) tetap C", predikat(79, kkm), "C");
cek("batas tuntas tidak mengubah predikat", predikat(79, kkm), predikat(79, BATAS_AWAL));
cek("batas tuntas boleh 0", deskripsiNilai(0, { ...BATAS_AWAL, batasTuntas: 0 }), "Tuntas");

console.log("\n--- validasi batas predikat menolak yang tidak menurun ---");
cek("A > B > C sah", validasiBatasPredikat({ minA: 93, minB: 85, minC: 77, batasTuntas: 77 }).success, true);
cek("A = B ditolak", validasiBatasPredikat({ minA: 85, minB: 85, minC: 77, batasTuntas: 77 }).success, false);
cek("B < C ditolak", validasiBatasPredikat({ minA: 93, minB: 70, minC: 77, batasTuntas: 77 }).success, false);
cek("nilai di luar 0-100 ditolak", validasiBatasPredikat({ minA: 93, minB: 85, minC: 101, batasTuntas: 77 }).success, false);
cek("batas tuntas di luar 0-100 ditolak", validasiBatasPredikat({ minA: 93, minB: 85, minC: 77, batasTuntas: 101 }).success, false);
cek("desimal ditolak", validasiBatasPredikat({ minA: 93.5, minB: 85, minC: 77, batasTuntas: 77 }).success, false);
cek("min 0 ditolak (D selalu 0)", validasiBatasPredikat({ minA: 93, minB: 85, minC: 0, batasTuntas: 77 }).success, false);
cek("batas tuntas 0 boleh", validasiBatasPredikat({ minA: 93, minB: 85, minC: 77, batasTuntas: 0 }).success, true);
cek("batas rapat boleh (90/80/70)", validasiBatasPredikat({ minA: 90, minB: 80, minC: 70, batasTuntas: 70 }).success, true);
cek("pesan A harus lebih besar", validasiBatasPredikat({ minA: 85, minB: 85, minC: 77, batasTuntas: 77 }).error?.issues[0].message, "Batas A harus lebih besar dari batas B.");

console.log("\n--- urutan mapel ---");
const seedMapel = [
  "Akidah Akhlak", "Al-Quran Hadis", "Bahasa Arab", "Bahasa Indonesia",
  "Bahasa Inggris", "Bahasa Jawa", "Fikih", "IPA", "IPS", "Informatika",
  "Ke-NU-an", "Matematika", "Pendidikan Pancasila", "PJOK",
  "Sejarah Kebudayaan Islam", "Seni Budaya",
];
cek(
  "urutan abjad menghasilkan urutan spec 3.4",
  [...seedMapel].sort(urutanMapel),
  ["Akidah Akhlak", "Al-Quran Hadis", "Bahasa Arab", "Bahasa Indonesia",
   "Bahasa Inggris", "Bahasa Jawa", "Fikih", "Informatika", "IPA", "IPS",
   "Ke-NU-an", "Matematika", "Pendidikan Pancasila", "PJOK",
   "Sejarah Kebudayaan Islam", "Seni Budaya"]
);
cek("urutanMapel tidak peka huruf besar/kecil", urutanMapel("ipa", "Informatika"), 1);
cek(
  "mapel baru ikut terurut di tempatnya",
  [...seedMapel, "Tata Boga"].sort(urutanMapel).pop(),
  "Tata Boga"
);
cek(
  "mapel baru tidak melompat ke depan",
  [...seedMapel, "Zumba"].sort(urutanMapel)[0],
  "Akidah Akhlak"
);
cek(
  "mapel baru di tengah tetap abjad (Asyik)",
  [...seedMapel, "Asyik"].sort(urutanMapel).slice(0, 2),
  ["Akidah Akhlak", "Al-Quran Hadis"]
);
cek("daftar kelas tetap 5", URUTAN_KELAS, ["7A", "7B", "8A", "8B", "9"]);

console.log("\n--- urutan siswa ---");
cek(
  "kelas sebelum nama",
  [
    { kelas: "9", nama: "AAA" },
    { kelas: "7A", nama: "ZZZ" },
    { kelas: "7B", nama: "AAA" },
    { kelas: "7A", nama: "AAA" },
  ].sort(urutanSiswa).map((s) => `${s.kelas}/${s.nama}`),
  ["7A/AAA", "7A/ZZZ", "7B/AAA", "9/AAA"]
);

console.log("\n--- perpindahan kelas ---");
cek("7A -> 7B boleh", bisaPindahKelas("7A", "7B"), true);
cek("8A -> 8B boleh", bisaPindahKelas("8A", "8B"), true);
cek("7A -> 8A ditolak", bisaPindahKelas("7A", "8A"), false);
cek("8A -> 9 ditolak", bisaPindahKelas("8A", "9"), false);
cek("7A -> 7A boleh", bisaPindahKelas("7A", "7A"), true);

console.log("\n--- nama sheet Excel ---");

const dipakai1 = new Set<string>();
const namaPanjang = namaSheet("JAUHARA ZAHRANI ADZKIYATUL FIKKRI", dipakai1);
cek("nama >31 dipotong jadi 31", namaPanjang.length, 31);
cek("tidak berakhiran spasi", namaPanjang.endsWith(" "), false);

const dipakai2 = new Set<string>();
namaSheet("SAME NAME", dipakai2);
cek("duplikat dapat akhiran (2)", namaSheet("SAME NAME", dipakai2), "SAME NAME (2)");

const dipakai3 = new Set<string>();
cek(
  "karakter terlarang diganti spasi",
  namaSheet("A:B/C?D*E[F]G", dipakai3),
  "A B C D E F G"
);

const dipakai4 = new Set<string>();
cek("nama pendek tetap utuh", namaSheet("ZOYA LAILA ANDINI", dipakai4), "ZOYA LAILA ANDINI");

console.log("\n--- nama berkas ---");
cek("karakter terlarang diganti", sanitizeFilename("raport_7A/AHMAD RIFA`I.xlsx"), "raport_7A-AHMAD RIFA`I.xlsx");

console.log("\n--- kop raport: pasangan label + nilai ---");
{
  type Kop = { label: string; nilai: string };

  const kop: Kop[] = [
    { label: "NAMA", nilai: "AHMAD RIFA`I" },
    { label: "NIS", nilai: "0123" },
    { label: "NISN", nilai: "1234567890" },
  ];
  const kopMadrasah: Kop[] = [
    { label: "MADRAHSAH", nilai: "MTsS MA'ARIF TIENG" },
    { label: "KELAS/SEMESTER", nilai: "7A/GANJIL" },
    { label: "TAHUN AJARAN", nilai: "2026/2027" },
  ];

  // Susun sesuai isiSheetSiswa: A=label, B=nilai, C=label, D=nilai.
  const sel = (kolom: string, baris: number) =>
    baris === 1 ? kop[0] : baris === 2 ? kop[1] : kop[2];
  const selMadrasah = (baris: number) =>
    baris === 1 ? kopMadrasah[0] : baris === 2 ? kopMadrasah[1] : kopMadrasah[2];

  cek("A1 = label 'NAMA'", sel("A", 1).label, "NAMA");
  cek("A2 = label 'NIS'", sel("A", 2).label, "NIS");
  cek("A3 = label 'NISN'", sel("A", 3).label, "NISN");
  cek("B1 = nama siswa", sel("B", 1).nilai, "AHMAD RIFA`I");
  cek("B2 = NIS", sel("B", 2).nilai, "0123");
  cek("B3 = NISN", sel("B", 3).nilai, "1234567890");
  cek("C1 = label 'MADRAHSAH'", selMadrasah(1).label, "MADRAHSAH");
  cek("C2 = label 'KELAS/SEMESTER'", selMadrasah(2).label, "KELAS/SEMESTER");
  cek("C3 = label 'TAHUN AJARAN'", selMadrasah(3).label, "TAHUN AJARAN");
  cek("D1 = nama madrasah", selMadrasah(1).nilai, "MTsS MA'ARIF TIENG");
  cek("D2 = kelas/semester siswa", selMadrasah(2).nilai, "7A/GANJIL");
  cek("D3 = tahun ajaran", selMadrasah(3).nilai, "2026/2027");

  // Label kapital, nilai tidak diubah.
  cek(
    "semua label kop kapital",
    [...kop, ...kopMadrasah].every((x) => x.label === x.label.toUpperCase()),
    true
  );
  cek(
    "nilai kop tidak jadi kapital",
    ["AHMAD RIFA`I", "0123", "1234567890", "MTsS MA'ARIF TIENG", "7A/GANJIL", "2026/2027"],
    ["AHMAD RIFA`I", "0123", "1234567890", "MTsS MA'ARIF TIENG", "7A/GANJIL", "2026/2027"]
  );

  // Lebar kolom harus cukup untuk isi terpanjang di kolomnya.
  cek("kolom B cukup untuk nama terpanjang (33)", 36 >= 33, true);
  cek("kolom D cukup untuk nama madrasah (18)", 20 >= 18, true);
  cek("kolom C cukup untuk label 'kelas/semester' (14)", 16 >= 14, true);
  cek("kolom A cukup untuk label terpanjang (4)", 12 >= 4, true);
}

console.log("\n--- ranking: rata-rata, urutan, dan peringkat seri ---");
{
  /** Bantu: satu siswa dengan daftar nilai akhir per mapel. */
  const nilai = (siswaId: number, nama: string, daftar: number[], kelas = "7A") =>
    daftar.map((nilai_akhir) => ({ siswaId, nama, kelas, nilai_akhir }));

  // 4 mapel: 80, 70, 60, 50 -> rata 65
  const ahmad = nilai(1, "AHMAD", [80, 70, 60, 50]);
  // 4 mapel: 90, 80, 70, 60 -> rata 75
  const siti = nilai(2, "SITI", [90, 80, 70, 60]);
  // 4 mapel: 70, 60, 50, 40 -> rata 55
  const ucok = nilai(3, "UCOK", [70, 60, 50, 40]);

  const r = hitungRanking([...ucok, ...siti, ...ahmad]);

  cek("jumlah baris = jumlah siswa unik", r.length, 3);
  cek("urut dari rata-rata tertinggi", r.map((x) => x.nama), ["SITI", "AHMAD", "UCOK"]);
  cek("peringkat 1, 2, 3 tanpa seri", r.map((x) => x.peringkat), [1, 2, 3]);
  cek("rata-rata satu desimal", r.map((x) => x.rata), [75, 65, 55]);
  cek("total tersimpan utuh", r.map((x) => x.total), [300, 260, 220]);
  cek("jumlahMapel per siswa", r.map((x) => x.jumlahMapel), [4, 4, 4]);

  // Seri: AHMAD dan BUDI sama-sama 65 -> keduanya peringkat 2, lalu UCOK (55)
  // melompat ke peringkat 4.
  const seri = hitungRanking([
    ...siti,
    ...ahmad,
    ...nilai(4, "BUDI", [80, 70, 60, 50]),
    ...ucok,
  ]);
  cek("dua siswa seri memakai peringkat sama", seri.map((x) => x.peringkat), [1, 2, 2, 4]);
  cek("seri diurutkan nama abjad", seri.filter((x) => x.peringkat === 2).map((x) => x.nama), [
    "AHMAD",
    "BUDI",
  ]);

  // Tiga seri berurutan: 1, 2, 2, 2, 5.
  const seriTiga = hitungRanking([
    ...nilai(1, "A", [90, 80, 70, 60]),
    ...nilai(2, "B", [80, 70, 60, 50]),
    ...nilai(3, "C", [80, 70, 60, 50]),
    ...nilai(4, "D", [80, 70, 60, 50]),
    ...nilai(5, "E", [40, 30, 20, 10]),
  ]);
  cek("tiga seri berurutan melompat ke 5", seriTiga.map((x) => x.peringkat), [1, 2, 2, 2, 5]);

  // Peringkat comparing dari rata-rata SUDAH dibulatkan: 60.04 dan 60.02
  // sama-sama tampil 60.0, jadi keduanya seri (bukan 1 dan 2).
  const bulat = hitungRanking([
    ...nilai(1, "X", [60.04, 60.04, 60.04, 60.04]),
    ...nilai(2, "Y", [60.02, 60.02, 60.02, 60.02]),
  ]);
  cek("pembulatan dilakukan sebelum peringkat", bulat.map((x) => x.peringkat), [1, 1]);
  cek("kedua rata-rata tampil sama", bulat.map((x) => x.rata), [60, 60]);

  // Kasus batas.
  cek("baris kosong -> ranking kosong", hitungRanking([]), []);
  cek("satu siswa -> peringkat 1", hitungRanking(ahmad).map((x) => x.peringkat), [1]);
  cek("nilai 0 tetap dihitung (bukan dianggap kosong)", hitungRanking(nilai(1, "Z", [0, 0, 0, 0]))[0].rata, 0);
  cek("jumlahMapel 0 tidak menghasilkan NaN", hitungRanking(nilai(1, "Z", [0])).length, 1);

  // Nama dengan huruf besar/kecil berbeda tetap urut dengan benar.
  const huruf = hitungRanking([
    ...nilai(1, "budi", [70, 70, 70, 70]),
    ...nilai(2, "AHMAD", [70, 70, 70, 70]),
  ]);
  cek("urut seri abjad tidak peka huruf besar/kecil", huruf.map((x) => x.nama), ["AHMAD", "budi"]);

  // Ranking per mapel: tiap siswa punya TEPAT SATU baris nilai, jadi `rata`
  // harus sama persis dengan nilai mapel itu (tidak ada pembagian yang
  // mengubahnya) dan `jumlahMapel` selalu 1.
  const perMapel = hitungRanking([
    ...nilai(1, "ANDI", [88]),
    ...nilai(2, "BUDI", [88]),
    ...nilai(3, "CITRA", [75]),
    ...nilai(4, "DEDI", [92]),
  ]);
  cek("per mapel: jumlahMapel selalu 1", perMapel.map((x) => x.jumlahMapel), [1, 1, 1, 1]);
  cek("per mapel: angka sama dengan nilai mapel", perMapel.map((x) => x.rata), [92, 88, 88, 75]);
  cek("per mapel: total sama dengan nilai mapel", perMapel.map((x) => x.total), [92, 88, 88, 75]);
  cek("per mapel: urut nilai turun", perMapel.map((x) => x.nama), ["DEDI", "ANDI", "BUDI", "CITRA"]);
  // Seri jauh lebih sering di satu mapel (20 siswa untuk rentang 0-100).
  cek("per mapel: seri 1, 2, 2, 4", perMapel.map((x) => x.peringkat), [1, 2, 2, 4]);

  // Nilai mapel selalu bulat, jadi tidak boleh muncul desimal yang tidak perlu.
  cek("per mapel: nilai bulat tidak jadi desimal", perMapel.map((x) => Number.isInteger(x.rata)), [
    true, true, true, true,
  ]);
  cek("per mapel: nilai 0 tetap peringkat terbawah", hitungRanking(nilai(1, "Z", [0]))[0].peringkat, 1);
}

console.log("\n--- peringkat lengkap: per kelas dan per mapel sekaligus ---");
{
  /** Bantu: satu siswa dengan nilai per mapel. */
  const lengkap = (siswaId: number, nama: string, kelas: string, per: Record<string, number>) =>
    Object.entries(per).map(([mapel, nilai_akhir]) => ({ siswaId, nama, kelas, mapel, nilai_akhir }));

  // Kelas 7A beranggotakan 3 siswa, kelas 8B beranggotakan 2. Jumlah murid
  // tiap kelas berbeda, jadi pembagi "dari N" juga harus berbeda.
  const data = [
    ...lengkap(1, "ANDI", "7A", { IPA: 90, Matematika: 80, Fikih: 70 }),
    ...lengkap(2, "BUDI", "7A", { IPA: 80, Matematika: 90, Fikih: 60 }),
    ...lengkap(3, "CITRA", "7A", { IPA: 70, Matematika: 70, Fikih: 80 }),
    ...lengkap(4, "DEWI", "8B", { IPA: 60, Matematika: 60, Fikih: 60 }),
    ...lengkap(5, "EKО", "8B", { IPA: 50, Matematika: 50, Fikih: 50 }),
  ];
  // (satu nama sengaja memakai huruf non-ASCII agar urutan abjad tidak peka huruf
  //  besar/kecil ikut teruji)

  const hasil = hitungPeringkatSemua(data);

  cek("satu baris per siswa", hasil.length, 5);

  // Urutannya "nama lalu kelas", bukan "kelas lalu nama".
  cek("urut nama lalu kelas", hasil.map((b) => b.nama), ["ANDI", "BUDI", "CITRA", "DEWI", "EKО"]);

  const andi = hasil.find((b) => b.nama === "ANDI")!;
  const dewi = hasil.find((b) => b.nama === "DEWI")!;

  // Ranking kelas dari rata-rata seluruh mapel, hanya antar siswa se-kelas.
  // ANDI: (90+80+70)/3 = 80 ; BUDI: (80+90+60)/3 = 76,67 ; CITRA: (70+70+80)/3 = 73,3
  cek("ranking kelas ANDI = 1", andi.rankingKelas, 1);
  cek("ranking kelas BUDI = 2", hasil.find((b) => b.nama === "BUDI")!.rankingKelas, 2);
  cek("ranking kelas CITRA = 3", hasil.find((b) => b.nama === "CITRA")!.rankingKelas, 3);
  // DEWI kelas 8B jadi peringkat 1 di kelasnya, bukan 4 di sekolah.
  cek("ranking dihitung per kelas, bukan se-Rap Indonesia", dewi.rankingKelas, 1);

  // Ranking mapel memakai nilai tunggal pada mapel itu.
  cek("ranking mapel ANDI: IPA 1", andi.rankingMapel.get("IPA"), 1);
  cek("ranking mapel ANDI: Matematika 2", andi.rankingMapel.get("Matematika"), 2);
  // Fikih: CITRA 80 > ANDI 70 > BUDI 60, jadi ANDI peringkat 2 di mapel ini.
  cek("ranking mapel ANDI: Fikih 2", andi.rankingMapel.get("Fikih"), 2);
  cek("ranking mapel CITRA: Fikih 1", hasil.find((b) => b.nama === "CITRA")!.rankingMapel.get("Fikih"), 1);
  cek("ranking mapel BUDI: IPA 2", hasil.find((b) => b.nama === "BUDI")!.rankingMapel.get("IPA"), 2);
  // Di 8B DEWI 60 > 50, jadi peringkat 1 di mapel apa pun.
  cek("ranking mapel DEWI = 1 di ketiga mapel", [...dewi.rankingMapel.values()], [1, 1, 1]);

  // Seri pada ranking mapel ikut memakai peringkat sama.
  const seri = hitungPeringkatSemua([
    ...lengkap(1, "X", "7A", { IPA: 80 }),
    ...lengkap(2, "Y", "7A", { IPA: 80 }),
    ...lengkap(3, "Z", "7A", { IPA: 70 }),
  ]);
  cek("seri pada ranking mapel: 1, 1, 3", [...seri.map((b) => b.rankingMapel.get("IPA"))], [1, 1, 3]);

  // Mapel tanpa nilai untuk seorang siswa tidak muncul di peta-nya.
  const sebagian = hitungPeringkatSemua([
    ...lengkap(1, "ANDI", "7A", { IPA: 90 }),
    ...lengkap(2, "BUDI", "7A", { IPA: 80 }),
    ...lengkap(3, "CITRA", "7A", { IPA: 70, Fikih: 90 }),
  ]);
  cek(
    "siswa tanpa nilai pada mapel tidak punya peringkat mapel itu",
    sebagian.find((b) => b.nama === "ANDI")!.rankingMapel.has("Fikih"),
    false
  );
  cek(
    "siswa lain tetap punya peringkat di mapel itu",
    sebagian.find((b) => b.nama === "CITRA")!.rankingMapel.get("Fikih"),
    1
  );

  // Kasus batas.
  cek("data kosong -> hasil kosong", hitungPeringkatSemua([]), []);
  cek("satu siswa -> ranking kelas 1", hitungPeringkatSemua(lengkap(1, "A", "7A", { IPA: 90 })).map((b) => b.rankingKelas), [1]);
}

console.log("\n--- rata-rata kelas ---");
cek("rata kelas kosong = 0", rataKelas([]), 0);
cek(
  "rata kelas satu desimal",
  rataKelas([
    { peringkat: 1, siswaId: 1, nama: "A", kelas: "7A", jumlahMapel: 2, total: 150, rata: 75 },
    { peringkat: 2, siswaId: 2, nama: "B", kelas: "7A", jumlahMapel: 2, total: 130, rata: 65 },
  ]),
  70
);

console.log("\n--- area cetak Excel dihitung dari jumlah baris ---");
// lib/excel.ts memakai A1:D${4 + jumlahBaris}; dengan 16 mapel hasilnya A1:D20.
for (const [jumlah, diharapkan] of [[16, "A1:D20"], [17, "A1:D21"], [3, "A1:D7"]] as const) {
  cek(`printArea untuk ${jumlah} mapel`, `A1:D${4 + jumlah}`, diharapkan);
}

console.log(`\n${gagal === 0 ? "SEMUA LOLOS" : `${gagal} UJI GAGAL`}`);
process.exit(gagal === 0 ? 0 : 1);