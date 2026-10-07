# PRD: Aplikasi Raport & Dongkrak Nilai ASTS

|  |  |
| --- | --- |
| **Madrasah** | MTsS MA'ARIF TIENG |
| **Tahun ajaran** | 2026/2027 |
| **Semester** | GANJIL |
| **Penilaian** | ASTS (Asesmen Sumatif Tengah Semester) |
| **Versi** | Draf 4 |
| **Teknologi** | Next.js, database SQLite (Turso / libSQL) |

> Hal yang belum Anda tetapkan secara eksplisit ditandai **\[ASUMSI\]** dan dikumpulkan di Bagian 9.

## 1. Ringkasan

Aplikasi web untuk satu pengguna (pemilik), **tanpa login**, yang **hanya berisi nilai**. Fungsinya:

1. mengelola data siswa dan nilai ASTS,
2. mendongkrak nilai berdasarkan **satu rentang** yang ditentukan pengguna lewat UI, dengan nilai asli tetap tersimpan,
3. mengunduh **raport per siswa** dalam file Excel, dan
4. mengunduh **semua nilai siswa** dalam satu file Excel, **satu sheet per siswa**, siap cetak.

Nama madrasah, tahun ajaran, dan semester adalah nilai tetap di aplikasi.

## 2. Di Luar Cakupan

Login/akun pengguna, absensi, sikap, deskripsi capaian, tanda tangan, nilai selain ASTS, dan portal siswa/orang tua.

## 3. Data

Dari seed `seed_asts_turso.sql`:

| Tabel | Kolom |
| --- | --- |
| **siswa** | `id`, `nis`, `nisn`, `nama`, `kelas` (7A, 7B, 8A, 8B, 9) |
| **mapel** | `id`, `nama`, `tingkat` (7/8/9), `kode` |
| **nilai** | `id`, `siswa_id`, `mapel_id`, `nilai_asli`, `nilai_dongkrak` |

Dibuat oleh aplikasi (tidak ada di seed): **aturan_dongkrak**, satu baris berisi `nilai_awal`, `nilai_akhir`, `nilai_target`, dan `diterapkan_pada`. Baris ini menyimpan aturan yang sedang berlaku. **\[ASUMSI\]**

- `nis` dan `nisn` bertipe TEXT, boleh kosong dulu, unik bila terisi. Akan Anda berikan nanti.
- `nilai_asli` dan `nilai_dongkrak` berupa **bilangan bulat 0–100**. `nilai_asli` tidak pernah diubah oleh proses dongkrak. `nilai_dongkrak` kosong (NULL) berarti belum didongkrak.
- Isi seed: **128 siswa, 48 mapel (16 mapel × 3 tingkat), 2.048 nilai**, setiap siswa tepat 16 nilai.
- Nilai desimal (124 nilai, semuanya IPS) sudah dibulatkan di seed (mis. 66,6 → 67; 76,59 → 77).
- Mapel yang tidak ada nilainya di Excel sumber diisi **0** (28 nilai pada 13 siswa).

## 4. Fitur

### F1. Siswa

- Daftar siswa dengan filter kelas dan pencarian nama.
- **Form edit siswa:** `nama`, `kelas`, `nis`, `nisn`. NIS dan NISN harus unik bila diisi.

### F2. Nilai

- **Urutan kolom di tampilan: Siswa → Mapel → Nilai Asli → Nilai Dongkrak → Predikat.**
- **Form edit nilai siswa:** mengubah `nilai_asli` per mapel, rentang 0–100.
- Predikat dihitung dari **nilai akhir** = `nilai_dongkrak` bila ada, jika tidak `nilai_asli`.
- Setelah `nilai_asli` diedit, `nilai_dongkrak` baris itu dihitung ulang memakai aturan yang sedang berlaku (bila ada). **\[ASUMSI\]**

### F3. Dongkrak Nilai

Pengguna menentukan **satu aturan** lewat UI:

> Semua nilai asli dari **\[nilai awal\]** sampai **\[nilai akhir\]** diubah menjadi **\[nilai target\]**.

- Berlaku untuk **semua siswa dan semua mapel**.
- Hasil ditulis ke `nilai_dongkrak`. `nilai_asli` tetap.
- Pencocokan memakai `nilai_asli`, inklusif di kedua ujung.
- Contoh: rentang 0–30, target 30 → nilai 12, 25, dan 30 menjadi 30. Nilai 31 ke atas tidak berubah.
- **Menerapkan aturan baru menimpa hasil dongkrak sebelumnya:** seluruh `nilai_dongkrak` dikosongkan lebih dulu, lalu aturan baru dihitung dari `nilai_asli`. Aturan lama tidak ikut berlaku. (Penjelasan dengan contoh ada di Bagian 5.)
- Tombol **Reset dongkrak** mengosongkan seluruh `nilai_dongkrak` dan aturan yang berlaku.
- Layar menampilkan aturan yang sedang berlaku dan jumlah nilai yang terdampak.
- Pratinjau jumlah nilai terdampak sebelum diterapkan, dengan peringatan bahwa hasil dongkrak sebelumnya akan diganti. **\[ASUMSI\]**

### F4. Unduh Raport per Siswa (Excel)

Satu file `.xlsx` per siswa dengan tata letak:

| Sel | Isi |
| --- | --- |
| A1 | Nama siswa |
| A2 | NIS |
| A3 | NISN |
| B1 | MTsS MA'ARIF TIENG |
| B2 | Kelas dan semester, contoh: `8A/GANJIL` |
| B3 | Tahun ajaran `2026/2027` |
| Baris 4 | Judul kolom: **No**, **Nama Mapel**, **Nilai**, **Predikat** (kolom A–D) |
| Baris 5 dst. | Satu baris per mapel (16 baris), urut abjad nama mapel |

- Kolom Nilai = nilai akhir.
- Mapel tanpa nilai tampil 0, predikat D.

### F5. Unduh Semua Nilai Siswa (Excel, siap cetak)

Satu tombol mengunduh **satu file `.xlsx` berisi satu sheet per siswa** (128 sheet), karena nilai siswa akan dicetak.

- **Isi tiap sheet sama persis dengan F4** (tata letak A1–A3, B1–B3, baris 4 dan seterusnya).
- Urutan sheet: kelas (7A, 7B, 8A, 8B, 9), lalu nama siswa urut abjad. **\[ASUMSI\]**
- Nama sheet = nama siswa. Excel membatasi nama sheet maksimal 31 karakter: nama yang lebih panjang dipotong menjadi 31 karakter (saat ini ada 1 nama, 33 karakter), dan bila bentrok ditambah nomor. **\[ASUMSI\]**
- Pengaturan cetak tiap sheet: kertas A4, orientasi tegak, **muat satu halaman** (fit to 1 page wide), sehingga satu siswa = satu lembar. **\[ASUMSI\]**

## 5. Penjelasan: Aturan Dongkrak Baru Menimpa yang Lama

Hanya ada **satu aturan berlaku** pada satu waktu. Setiap kali Anda menekan Terapkan, aplikasi:

1. mengosongkan semua `nilai_dongkrak` yang ada,
2. menghitung ulang dari `nilai_asli` memakai aturan baru saja.

**Contoh** (nilai asli: Budi 20, Ani 28, Citra 45, Dedi 60):

| Langkah | Budi | Ani | Citra | Dedi |
| --- | --- | --- | --- | --- |
| Nilai asli | 20 | 28 | 45 | 60 |
| Aturan 1: 0–30 → 30 | **30** | **30** | 45 | 60 |
| Aturan 2: 0–50 → 50 (menimpa) | **50** | **50** | **50** | 60 |
| Aturan 3: 0–20 → 25 (menimpa) | **25** | **28** | 45 | 60 |

Pada baris Aturan 3, nilai Ani kembali ke 28 (nilai asli), bukan tetap 30 dari Aturan 1. Hasil aturan sebelumnya hilang sepenuhnya.

**Bedanya dengan "ditumpuk":** bila aturan ditumpuk, Aturan 2 akan bekerja di atas hasil Aturan 1 (nilai yang sudah 30 dihitung sebagai 30, bukan 28). Dengan cara menimpa, hasil akhir selalu dapat diprediksi dari dua hal saja: **nilai asli + satu aturan yang tampil di layar**. Risiko mendongkrak dua kali tanpa sengaja tidak ada.

## 6. Aturan Predikat

| Predikat | Rentang |
| --- | --- |
| A | 93–100 |
| B | 85–92 |
| C | 77–84 |
| D | 0–76 |

## 7. Teknologi (usulan)

- **Next.js** (App Router) untuk UI dan API.
- **Turso** lewat `@libsql/client`, memakai skema dari seed.
- Pembuatan file Excel di sisi server dengan `exceljs`, termasuk pengaturan cetak per sheet.

## 8. Kriteria Penerimaan

1. Setelah dongkrak diterapkan lalu di-reset, semua `nilai_asli` identik dengan sebelum proses.
2. Menerapkan aturan kedua menghasilkan nilai dongkrak yang **identik** dengan menerapkan aturan kedua itu saja pada data baru (tidak ada sisa aturan pertama).
3. Jumlah nilai terdampak di pratinjau sama dengan jumlah nilai yang berubah setelah diterapkan.
4. Predikat sesuai Bagian 6.
5. File raport (F4) dan tiap sheet di F5 mengikuti tata letak yang sama (A1–A3, B1–B3, judul di baris 4), dan B2 berbentuk `8A/GANJIL`.
6. File F5 berisi 128 sheet, masing-masing 16 mapel, dan tiap sheet tercetak di satu halaman A4.
7. NIS/NISN yang sudah dipakai siswa lain ditolak.

## 9. Catatan dan Asumsi yang Belum Dikonfirmasi

- Rentang dongkrak yang mencakup 0 (mis. 0–30) juga menaikkan 28 nilai pengisi (mapel tanpa nilai) ke nilai target.
- Pada nilai asli saat ini: 1.696 nilai berpredikat D (83%), 213 C, 115 B, 24 A dari 2.048 nilai.
- Asumsi baru: aturan aktif disimpan di tabel `aturan_dongkrak`; urutan sheet F5; penamaan sheet; pengaturan cetak A4 tegak muat satu halaman.