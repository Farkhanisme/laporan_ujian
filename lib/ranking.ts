/**
 * Peringkat siswa dalam satu kelas.
 *
 * Logika ini murni: tidak menyentuh database, sehingga bisa diuji tanpa
 * database (lihat `scripts/cek-logic.mts`). Halaman ranking dan ekspor Excel
 * sama-sama memanggil `hitungRanking`, jadi tidak ada dua tempat yang bisa
 * menghitung peringkat berbeda.
 */

/** Satu nilai akhir siswa pada satu mata pelajaran. */
export interface BarisNilai {
  siswaId: number;
  nama: string;
  kelas: string;
  nilai_akhir: number;
}

export interface BarisRanking {
  peringkat: number;
  siswaId: number;
  nama: string;
  kelas: string;
  /** Berapa mapel yang ikut dirata-ratakan. */
  jumlahMapel: number;
  total: number;
  /** Rata-rata satu desimal; angka inilah yang tampil dan yang jadi dasar peringkat. */
  rata: number;
}

/** Bulatkan ke satu desimal, cara yang sama dengan statistik halaman Nilai. */
function satuDesimal(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Susun peringkat dari baris nilai mentah.
 *
 * Keputusan yang perlu diketahui pembaca:
 * - Nilai akhir = `COALESCE(nilai_dongkrak, nilai_asli)` sudah dihitung
 *   sebelum fungsi ini dipanggil, supaya tidak ada dua definisi "nilai akhir".
 * - Peringkat comparing dari `rata` yang SUDAH dibulatkan satu desimal. Kalau
 *   dibulatkan setelah peringkat dihitung, dua siswa bisa tampil dengan angka
 *   sama tetapi punya peringkat berbeda — yang membingungkan pembaca.
 * - Nilai sama mendapat peringkat sama, dan peringkat berikutnya melompat
 *   (1, 2, 2, 4). Baris yang seri diurutkan nama abjad supaya urutannya
 *   stabil dan bisa diprediksi.
 * - Fungsi ini tidak memisahkan kelas; pemisahan dilakukan pemanggil lewat
 *   filter query, sehingga "peringkat 1" selalu berarti peringkat 1 di dalam
 *   kelas yang sedang ditampilkan.
 */
export function hitungRanking(rows: BarisNilai[]): BarisRanking[] {
  const perSiswa = new Map<number, { nama: string; kelas: string; total: number; jumlahMapel: number }>();

  for (const r of rows) {
    let s = perSiswa.get(r.siswaId);
    if (!s) {
      s = { nama: r.nama, kelas: r.kelas, total: 0, jumlahMapel: 0 };
      perSiswa.set(r.siswaId, s);
    }
    s.total += r.nilai_akhir;
    s.jumlahMapel += 1;
  }

  const urut = [...perSiswa.entries()]
    .map(([siswaId, s]) => ({
      siswaId,
      nama: s.nama,
      kelas: s.kelas,
      jumlahMapel: s.jumlahMapel,
      total: s.total,
      rata: satuDesimal(s.jumlahMapel === 0 ? 0 : s.total / s.jumlahMapel),
    }))
    .sort((a, b) => {
      // Rata-rata turun; seri dipecah nama abjad.
      if (a.rata !== b.rata) return b.rata - a.rata;
      return a.nama.localeCompare(b.nama, undefined, { sensitivity: "base" });
    });

  let peringkatTerakhir = 0;

  return urut.map((s, i) => {
    // Peringkat comparing: baris dengan rata sama memakai peringkat yang
    // sama, dan peringkat berikutnya melompat sebanyak jumlah baris seri.
    if (i === 0 || urut[i - 1].rata !== s.rata) {
      peringkatTerakhir = i + 1;
    }
    return { ...s, peringkat: peringkatTerakhir };
  });
}

/** Rata-rata seluruh kelas, satu desimal; 0 bila tidak ada data. */
export function rataKelas(baris: BarisRanking[]): number {
  if (baris.length === 0) return 0;
  const total = baris.reduce((jumlah, b) => jumlah + b.rata, 0);
  return satuDesimal(total / baris.length);
}

/** Baris nilai yang tahu nama mapelnya, untuk peringkat per mapel. */
export interface BarisNilaiLengkap extends BarisNilai {
  mapel: string;
}

export interface BarisPeringkat {
  nama: string;
  kelas: string;
  /** Peringkat dari rata-rata seluruh mapel, dibandingkan antar siswa se-Kelas. */
  rankingKelas: number;
  /** Peringkat pada tiap mapel; mapel tanpa nilai untuk siswa ini tidak ada. */
  rankingMapel: Map<string, number>;
}

/**
 * Peringkat kelas dan peringkat per mapel untuk seluruh siswa.
 *
 * Tidak ada algoritma peringkat baru di sini: `hitungRanking` yang sama
 * dipakai halaman Ranking dan ekspor Excel juga dipakai dua kali, hanya
 * dengan pengelompokan berbeda —
 *   - dikelompokkan per kelas       -> peringkat dari rata-rata
 *   - dikelompokkan per kelas+mapel -> peringkat dari nilai tunggal
 *
 * "Dari N" diambil dari jumlah siswa unik di kelas tersebut, dihitung sekali
 * per kelas. Bukan jumlah seluruh siswa, dan bukan jumlah mapel.
 */
export function hitungPeringkatSemua(rows: BarisNilaiLengkap[]): BarisPeringkat[] {
  // Pengelompokan per (kelas, mapel), sekaligus peta siswaId -> mapel supaya
  // pencocokan nanti O(1), bukan memindai ulang daftar tiap baris.
  const perKelasMapel = new Map<string, BarisNilai[]>();
  const mapelSiswa = new Map<string, Map<number, string>>();
  for (const r of rows) {
    const kunci = `${r.kelas}\u0000${r.mapel}`;
    let list = perKelasMapel.get(kunci);
    if (!list) {
      list = [];
      perKelasMapel.set(kunci, list);
      mapelSiswa.set(kunci, new Map());
    }
    list.push(r);
    mapelSiswa.get(kunci)!.set(r.siswaId, r.mapel);
  }

  const rankingMapel = new Map<number, Map<string, number>>();
  for (const [kunci, list] of perKelasMapel) {
    const petaMapel = mapelSiswa.get(kunci)!;
    for (const b of hitungRanking(list)) {
      let perMapel = rankingMapel.get(b.siswaId);
      if (!perMapel) {
        perMapel = new Map();
        rankingMapel.set(b.siswaId, perMapel);
      }
      perMapel.set(petaMapel.get(b.siswaId)!, b.peringkat);
    }
  }

  // Pengelompokan per kelas untuk peringkat dari rata-rata.
  const perKelas = new Map<string, BarisNilai[]>();
  for (const r of rows) {
    let list = perKelas.get(r.kelas);
    if (!list) {
      list = [];
      perKelas.set(r.kelas, list);
    }
    list.push(r);
  }

  const hasil: BarisPeringkat[] = [];
  for (const list of perKelas.values()) {
    for (const b of hitungRanking(list)) {
      hasil.push({
        nama: b.nama,
        kelas: b.kelas,
        rankingKelas: b.peringkat,
        rankingMapel: rankingMapel.get(b.siswaId) ?? new Map(),
      });
    }
  }

  // Urutan "nama lalu kelas", berlawanan dengan urutanSiswa yang dipakai
  // halaman lain (kelas lalu nama). Sengaja dipisah supaya halaman Ranking dan
  // file Ringkasan tidak ikut berubah.
  return hasil.sort(
    (a, b) =>
      a.nama.localeCompare(b.nama, undefined, { sensitivity: "base" }) ||
      a.kelas.localeCompare(b.kelas, undefined, { sensitivity: "base" })
  );
}