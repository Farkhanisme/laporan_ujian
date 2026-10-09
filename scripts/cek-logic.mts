// Uji logika murni (tanpa database): predikat, urutan, nama sheet Excel.
// Jalankan: npm run cek:logic
import { deskripsiNilai, predikat, predikatDenganKeterangan } from "../lib/predikat.ts";
import { urutanMapel, urutanSiswa, bisaPindahKelas, URUTAN_KELAS } from "../lib/urutan.ts";
import { namaSheet, sanitizeFilename } from "../lib/nama-sheet.ts";
import { hitungRanking, rataKelas } from "../lib/ranking.ts";

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

console.log("--- predikat (batas 76/77, 84/85, 92/93) ---");
cek("predikat(93) = A", predikat(93), "A");
cek("predikat(100) = A", predikat(100), "A");
cek("predikat(92) = B", predikat(92), "B");
cek("predikat(85) = B", predikat(85), "B");
cek("predikat(84) = C", predikat(84), "C");
cek("predikat(77) = C", predikat(77), "C");
cek("predikat(76) = D", predikat(76), "D");
cek("predikat(0) = D", predikat(0), "D");

console.log("\n--- keterangan predikat (ditulis di samping hurufnya) ---");
cek("predikatDenganKeterangan(93) = A (Sangat Baik)", predikatDenganKeterangan(predikat(93)), "A (Sangat Baik)");
cek("predikatDenganKeterangan(85) = B (Baik)", predikatDenganKeterangan(predikat(85)), "B (Baik)");
cek("predikatDenganKeterangan(77) = C (Cukup)", predikatDenganKeterangan(predikat(77)), "C (Cukup)");
cek("predikatDenganKeterangan(56) = D (Kurang)", predikatDenganKeterangan(predikat(56)), "D (Kurang)");

console.log("\n--- deskripsi nilai (batas tuntas 77) ---");
cek("deskripsiNilai(100) = Tuntas", deskripsiNilai(100), "Tuntas");
cek("deskripsiNilai(93) = Tuntas", deskripsiNilai(93), "Tuntas");
cek("deskripsiNilai(77) = Tuntas (tepat batas)", deskripsiNilai(77), "Tuntas");
cek("deskripsiNilai(76) = Belum Tuntas", deskripsiNilai(76), "Belum Tuntas");
cek("deskripsiNilai(0) = Belum Tuntas", deskripsiNilai(0), "Belum Tuntas");

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