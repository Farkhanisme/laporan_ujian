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