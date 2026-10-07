# Spesifikasi Fitur & Desain Sistem: Aplikasi Raport dan Dongkrak Nilai ASTS

Dokumen ini adalah **instruksi pembangunan** untuk AI/developer. Bangun aplikasi persis sesuai dokumen ini. Bila ada hal yang tidak tertulis, pilih solusi paling sederhana dan **jangan menambah fitur**.

| | |
|---|---|
| Madrasah | **MTsS MA'ARIF TIENG** |
| Tahun ajaran | **2026/2027** |
| Semester | **GANJIL** |
| Penilaian | **ASTS** (Asesmen Sumatif Tengah Semester) |
| Bahasa antarmuka | Indonesia |
| Pengguna | Satu orang (pemilik), **tanpa login** |

Berkas pendamping: `seed_asts_turso.sql` (skema + data awal). **Jangan mengubah isi data seed.**

---

## 1. Tujuan Aplikasi

Aplikasi web yang **hanya berisi nilai**. Lima kemampuan:

1. Mengedit data siswa (nama, kelas, NIS, NISN).
2. Melihat dan mengedit **nilai asli** per siswa per mapel, beserta nilai dongkrak dan predikat.
3. **Mendongkrak nilai**: satu aturan "rentang → nilai target" untuk semua siswa dan semua mapel, dengan nilai asli tidak pernah berubah.
4. Mengunduh **raport satu siswa** sebagai file Excel.
5. Mengunduh **nilai semua siswa** sebagai satu file Excel, **satu sheet per siswa**, siap cetak.

**Di luar cakupan (jangan dibuat):** login/akun, tambah siswa, hapus siswa, tambah/hapus mapel, absensi, sikap, deskripsi capaian, tanda tangan, nilai selain ASTS, impor dari Excel, multi-semester, multi-madrasah.

---

## 2. Teknologi

| Bagian | Pilihan |
|---|---|
| Framework | **Next.js** (App Router), **TypeScript** |
| Database | **Turso** (libSQL/SQLite) lewat `@libsql/client` |
| Excel | `exceljs`, dijalankan di server (`export const runtime = 'nodejs'`) |
| UI | Bebas; disarankan Tailwind CSS. Desktop-first, tetap terbaca di layar kecil |
| Variabel lingkungan | `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` (hanya dibaca di server, jangan pernah dikirim ke browser) |

**Konstanta aplikasi** (satu berkas `lib/config.ts`, jangan disimpan di database):

```ts
export const NAMA_MADRASAH = "MTsS MA'ARIF TIENG";
export const TAHUN_AJARAN = "2026/2027";
export const SEMESTER = "GANJIL";
```

---

## 3. Desain Database

### 3.1 Tabel dari seed (sudah ada, jangan diubah)

```sql
siswa  (id PK AUTOINCREMENT, nis TEXT UNIQUE NULL, nisn TEXT UNIQUE NULL,
        nama TEXT NOT NULL, kelas TEXT NOT NULL, UNIQUE(nama, kelas))
mapel  (id PK AUTOINCREMENT, nama TEXT NOT NULL, tingkat INTEGER NOT NULL,
        kode TEXT NOT NULL, UNIQUE(nama, tingkat))
nilai  (id PK AUTOINCREMENT,
        siswa_id INTEGER NOT NULL -> siswa(id) ON DELETE CASCADE,
        mapel_id INTEGER NOT NULL -> mapel(id) ON DELETE CASCADE,
        nilai_asli     INTEGER NOT NULL CHECK (0..100),
        nilai_dongkrak INTEGER NULL     CHECK (NULL atau 0..100),
        UNIQUE(siswa_id, mapel_id))
```

Fakta data awal:
- `kelas` hanya bernilai: `7A`, `7B`, `8A`, `8B`, `9`. `tingkat` = angka pertama kelas.
- 128 siswa (7A: 19, 7B: 18, 8A: 28, 8B: 29, 9: 34), 48 baris `mapel` (16 nama × tingkat 7, 8, 9), **2.048 baris `nilai`**: tepat **16 baris per siswa**, satu untuk tiap mapel sesuai tingkat siswa.
- `nis` dan `nisn` awalnya semua `NULL`.
- `nilai_dongkrak` awalnya semua `NULL`.
- Sebagian `nilai_asli` bernilai `0` (28 baris): mapel yang tidak ada nilainya di sumber. Perlakukan sebagai nilai biasa.

### 3.2 Tabel baru: `aturan_dongkrak` (dibuat oleh migrasi aplikasi)

Menyimpan **satu** aturan yang sedang berlaku. Buat berkas `db/001_aturan_dongkrak.sql` dan skrip `npm run db:migrate`:

```sql
CREATE TABLE IF NOT EXISTS aturan_dongkrak (
  id              INTEGER PRIMARY KEY CHECK (id = 1),   -- selalu 1: hanya satu baris
  nilai_awal      INTEGER NOT NULL CHECK (nilai_awal   BETWEEN 0 AND 100),
  nilai_akhir     INTEGER NOT NULL CHECK (nilai_akhir  BETWEEN 0 AND 100),
  nilai_target    INTEGER NOT NULL CHECK (nilai_target BETWEEN 0 AND 100),
  diterapkan_pada TEXT NOT NULL,                        -- ISO 8601
  CHECK (nilai_awal <= nilai_akhir)
);
```

Tidak ada baris = tidak ada aturan yang berlaku.

### 3.3 Istilah turunan (dihitung, tidak disimpan)

- **Nilai akhir** = `COALESCE(nilai_dongkrak, nilai_asli)`.
- **Predikat** dihitung dari **nilai akhir**:

| Predikat | Nilai akhir |
|---|---|
| A | 93–100 |
| B | 85–92 |
| C | 77–84 |
| D | 0–76 |

```ts
export function predikat(n: number): "A" | "B" | "C" | "D" {
  if (n >= 93) return "A";
  if (n >= 85) return "B";
  if (n >= 77) return "C";
  return "D";
}
```

Satu fungsi ini dipakai di seluruh aplikasi (UI dan Excel).

### 3.4 Urutan mapel (tetap, dipakai di layar dan Excel)

Urut abjad nama mapel, **tidak peka huruf besar/kecil**. Urutkan di kode aplikasi (bukan `ORDER BY` SQLite, karena SQLite membedakan huruf besar/kecil). Hasil yang benar:

1. Akidah Akhlak
2. Al-Quran Hadis
3. Bahasa Arab
4. Bahasa Indonesia
5. Bahasa Inggris
6. Bahasa Jawa
7. Fikih
8. Informatika
9. IPA
10. IPS
11. Ke-NU-an
12. Matematika
13. Pendidikan Pancasila
14. PJOK
15. Sejarah Kebudayaan Islam
16. Seni Budaya

Urutan siswa: `kelas` (7A, 7B, 8A, 8B, 9), lalu `nama` abjad (tidak peka huruf besar/kecil).

---

## 4. Arsitektur dan Struktur Proyek

Semua akses database terjadi di server (Route Handler / Server Component). Browser tidak pernah menyentuh Turso.

```
app/
  layout.tsx              # navigasi: Nilai | Siswa | Dongkrak
  page.tsx                # redirect ke /nilai
  nilai/page.tsx          # F2
  siswa/page.tsx          # F1 daftar
  siswa/[id]/page.tsx     # F1 form edit
  dongkrak/page.tsx       # F3
  api/
    siswa/route.ts                 # GET
    siswa/[id]/route.ts            # GET, PATCH
    nilai/route.ts                 # GET, PATCH
    dongkrak/route.ts              # GET, POST, DELETE
    dongkrak/preview/route.ts      # POST
    export/raport/[siswaId]/route.ts   # GET  -> .xlsx
    export/semua/route.ts              # GET  -> .xlsx
lib/
  db.ts            # createClient dari @libsql/client
  config.ts        # konstanta madrasah
  predikat.ts
  urutan.ts        # urutan mapel & siswa (3.4)
  excel.ts         # fungsi membuat sheet siswa (dipakai F4 dan F5)
  validasi.ts
db/
  001_aturan_dongkrak.sql
```

Aturan umum untuk Route Handler:
- Respons JSON: sukses `{ ok: true, data }`, gagal `{ ok: false, error: "pesan bahasa Indonesia" }` dengan kode HTTP yang sesuai (400 validasi, 404 tidak ada, 409 duplikat, 500 lainnya).
- Operasi yang mengubah lebih dari satu baris harus memakai `client.batch([...], "write")` (satu transaksi).
- Validasi masukan di server, walau UI sudah memvalidasi.

---

## 5. Spesifikasi Fitur

### F1. Data Siswa

**Halaman `/siswa`**
- Tabel: No, Nama, Kelas, NIS, NISN, tombol **Edit**.
- Filter kelas (Semua, 7A, 7B, 8A, 8B, 9) dan pencarian nama (berisi teks, tidak peka huruf besar/kecil).
- NIS/NISN kosong ditampilkan sebagai `-`.
- Di atas tabel tampil ringkas: "NIS/NISN belum terisi: N siswa".

**Halaman `/siswa/[id]`: form edit siswa**

| Field | Aturan |
|---|---|
| Nama | Wajib. Dipangkas spasi di awal/akhir; spasi berulang jadi satu. |
| Kelas | Pilihan: 7A, 7B, 8A, 8B, 9. |
| NIS | Opsional. Hanya angka. Kosong disimpan sebagai **`NULL`** (bukan string kosong). |
| NISN | Opsional. Hanya angka. Kosong disimpan sebagai **`NULL`**. |

Catatan: NIS/NISN disimpan sebagai **teks** agar angka 0 di depan tidak hilang. Panjang tidak divalidasi.

Aturan dan kesalahan:
- Kombinasi (nama, kelas) harus unik → 409: "Siswa dengan nama dan kelas tersebut sudah ada."
- NIS atau NISN yang sudah dipakai siswa lain → 409: "NIS sudah dipakai siswa lain." / "NISN sudah dipakai siswa lain."
- **Kelas hanya boleh diganti dalam tingkat yang sama** (7A↔7B, 8A↔8B). Mengganti ke tingkat lain ditolak (400): "Perpindahan antar tingkat tidak didukung karena nilai terikat pada mapel tingkatnya." *(Alasan: baris `nilai` menunjuk mapel per tingkat.)*
- Setelah simpan, kembali ke `/siswa` dengan pesan sukses.

**API**
- `GET /api/siswa?kelas=&q=` → daftar siswa terurut (3.4).
- `GET /api/siswa/:id` → satu siswa.
- `PATCH /api/siswa/:id` body `{ nama, kelas, nis, nisn }`.

### F2. Nilai

**Halaman `/nilai`**

Filter di atas (selalu tampil):
1. **Kelas** (wajib; bawaan kelas pertama, 7A).
2. **Siswa** (opsional; pilihan "Semua siswa di kelas" atau satu siswa dari kelas itu).

**Tabel, urutan kolom wajib:**

| Siswa | Mapel | Nilai Asli | Nilai Dongkrak | Predikat |
|---|---|---|---|---|

- `Nilai Dongkrak` kosong ditampilkan `-`. Sel yang punya nilai dongkrak diberi penanda visual (mis. warna latar).
- `Predikat` dihitung dari nilai akhir (3.3). Beri warna berbeda tiap predikat.
- Urutan baris: siswa (3.4), lalu mapel (3.4).

**Mode "Semua siswa di kelas":** tabel hanya-baca. Tiap siswa ada tautan "Edit nilai" yang memilih siswa itu. Gunakan paginasi atau gulir (sampai 34 siswa × 16 = 544 baris).

**Mode satu siswa (form edit nilai siswa):**
- 16 baris mapel. Kolom **Nilai Asli** berupa input angka (min 0, maks 100, hanya bilangan bulat).
- Tombol **Simpan** (satu tombol untuk seluruh 16 baris) dan **Batal**.
- Tombol **Unduh Raport** (F4) untuk siswa itu.
- Setelah simpan, tabel menampilkan nilai terbaru (nilai dongkrak dan predikat ikut berubah).

**Aturan simpan nilai**
- Nilai asli harus bilangan bulat 0–100. Selain itu → 400: "Nilai harus bilangan bulat 0–100."
- Server menyimpan `nilai_asli`, lalu **menghitung ulang `nilai_dongkrak` untuk baris yang diubah** memakai aturan berlaku (F3):
  - bila ada aturan dan `nilai_awal ≤ nilai_asli ≤ nilai_akhir` → `nilai_dongkrak = nilai_target`;
  - selain itu → `nilai_dongkrak = NULL`.
- Bila tidak ada aturan, `nilai_dongkrak` tidak disentuh (tetap `NULL`).

**Tombol di header halaman:** **Unduh Semua Nilai** (F5).

**API**
- `GET /api/nilai?kelas=7A&siswaId=` → baris `{ nilaiId, siswaId, siswa, kelas, mapelId, mapel, nilai_asli, nilai_dongkrak, nilai_akhir, predikat }`.
- `PATCH /api/nilai` body `{ items: [{ id, nilai_asli }] }` (dalam satu transaksi). `id` = `nilai.id`.

### F3. Dongkrak Nilai

**Konsep.** Satu aturan:

> Semua nilai asli dari **[nilai awal]** sampai **[nilai akhir]** (inklusif) diubah menjadi **[nilai target]**.

Berlaku untuk **semua siswa dan semua mapel**. Hasil ditulis ke `nilai_dongkrak`; `nilai_asli` **tidak pernah** diubah oleh proses ini.

**Menerapkan aturan baru menimpa yang lama.** Hanya satu aturan berlaku. Saat Terapkan, dalam **satu transaksi**:

```sql
UPDATE nilai SET nilai_dongkrak = NULL;                              -- 1. hapus hasil lama
UPDATE nilai SET nilai_dongkrak = :target
 WHERE nilai_asli BETWEEN :awal AND :akhir;                          -- 2. hitung dari nilai_asli
INSERT INTO aturan_dongkrak (id, nilai_awal, nilai_akhir, nilai_target, diterapkan_pada)
VALUES (1, :awal, :akhir, :target, :sekarang)
ON CONFLICT(id) DO UPDATE SET nilai_awal=excluded.nilai_awal, nilai_akhir=excluded.nilai_akhir,
  nilai_target=excluded.nilai_target, diterapkan_pada=excluded.diterapkan_pada;  -- 3. simpan aturan
```

Pencocokan **selalu terhadap `nilai_asli`**, tidak pernah terhadap hasil dongkrak sebelumnya.

**Halaman `/dongkrak`**
1. **Kartu "Aturan yang sedang berlaku"**: tampil "Nilai [awal]–[akhir] diubah menjadi [target]", waktu diterapkan, dan jumlah nilai terdampak. Bila tidak ada: "Belum ada aturan dongkrak."
2. **Form aturan baru**: tiga input angka bulat 0–100: Nilai awal, Nilai akhir, Nilai target.
3. Tombol **Pratinjau**. Menampilkan:
   - jumlah nilai yang akan terdampak (dari 2.048),
   - berapa di antaranya bernilai 0 (informasi: bisa jadi mapel tanpa nilai),
   - jumlah hasil dongkrak yang sedang ada dan akan **diganti**,
   - 10 contoh baris (siswa, mapel, nilai asli → target).
4. Tombol **Terapkan** (aktif setelah pratinjau). Menampilkan dialog konfirmasi: "Menerapkan aturan ini akan **menghapus hasil dongkrak sebelumnya** (N nilai) dan menggantinya dengan aturan baru. Lanjutkan?"
5. Tombol **Reset dongkrak** (nonaktif bila tidak ada aturan), dengan dialog konfirmasi. Efek:
   ```sql
   UPDATE nilai SET nilai_dongkrak = NULL;
   DELETE FROM aturan_dongkrak;
   ```

**Validasi**
- Ketiga nilai bilangan bulat 0–100, `nilai_awal ≤ nilai_akhir`. Selain itu → 400 dengan pesan jelas.
- **Peringatan (tidak memblokir)** bila `nilai_target < nilai_akhir`: "Nilai target lebih kecil dari batas akhir rentang; sebagian nilai bisa turun." *(asumsi: tidak diblokir)*

**API**
- `GET /api/dongkrak` → `{ aturan | null, jumlahTerdampak }`.
- `POST /api/dongkrak/preview` body `{ awal, akhir, target }` → statistik dan 10 contoh (tanpa mengubah data).
- `POST /api/dongkrak` body `{ awal, akhir, target }` → menerapkan; mengembalikan jumlah baris terdampak.
- `DELETE /api/dongkrak` → reset.

### F4. Unduh Raport per Siswa (Excel)

Tombol **Unduh Raport** di halaman `/nilai` (mode satu siswa) dan di tiap baris `/siswa`.

`GET /api/export/raport/:siswaId` → file `.xlsx` berisi **satu sheet**.

**Tata letak sheet (WAJIB persis):**

| Sel | Isi |
|---|---|
| **A1** | Nama siswa |
| **A2** | NIS (kosong bila `NULL`) |
| **A3** | NISN (kosong bila `NULL`) |
| **B1** | `MTsS MA'ARIF TIENG` |
| **B2** | `{kelas}/GANJIL`, contoh `8A/GANJIL`, `9/GANJIL` (tanpa kata "Kelas", tanpa strip) |
| **B3** | `2026/2027` |
| **A4** | `No` |
| **B4** | `Nama Mapel` |
| **C4** | `Nilai` |
| **D4** | `Predikat` |
| **A5:D20** | 16 baris mapel urut 3.4: No (1–16), Nama Mapel, **nilai akhir**, predikat |

Aturan format:
- `NIS`, `NISN`, `B2`, `B3` ditulis sebagai **teks** (format sel `@`) agar `2026/2027` dan angka 0 di depan tidak berubah. Jangan pernah memakai angka/tanggal.
- Kolom Nilai berisi **angka bulat** (tanpa desimal). Predikat berupa teks (A/B/C/D).
- Lebar kolom: **A ≈ 38**, **B ≈ 34**, **C ≈ 10**, **D ≈ 10**. *(Kolom A harus lebar karena A1 berisi nama siswa; nama terpanjang 33 karakter, dan B1 berisi teks sehingga nama tidak boleh meluap.)*
- Baris 1–3 huruf tebal. Baris 4 (judul) huruf tebal, rata tengah, latar abu-abu muda. Tabel A4:D20 diberi garis tepi. Kolom A (No), C, D rata tengah dalam tabel.

**Pengaturan cetak** (wajib, karena akan dicetak): kertas **A4**, orientasi **tegak**, area cetak **A1:D20**, **muat 1 halaman** (`fitToPage`, lebar 1, tinggi 1), margin sedang, rata tengah horizontal.

```ts
ws.pageSetup = {
  paperSize: 9,                // A4
  orientation: "portrait",
  fitToPage: true, fitToWidth: 1, fitToHeight: 1,
  printArea: "A1:D20",
  horizontalCentered: true,
};
```

Nama berkas unduhan: `raport_{kelas}_{nama}.xlsx` (hapus karakter yang tidak valid untuk nama berkas). Header `Content-Disposition: attachment`.

### F5. Unduh Semua Nilai Siswa (Excel, siap cetak)

Tombol **Unduh Semua Nilai** di header `/nilai`. `GET /api/export/semua` → **satu file `.xlsx`** berisi **128 sheet, satu sheet per siswa**.

- **Isi setiap sheet identik dengan F4** (tata letak, format, dan pengaturan cetak yang sama). Gunakan satu fungsi `buatSheetSiswa(workbook, siswa, nilaiRows)` di `lib/excel.ts` untuk F4 dan F5.
- Urutan sheet: kelas (7A, 7B, 8A, 8B, 9), lalu nama siswa abjad.
- **Nama sheet = nama siswa**, dengan aturan Excel:
  - maksimal **31 karakter** (potong; saat ini 1 nama, `JAUHARA ZAHRANI ADZKIYATUL FIKKRI`, 33 karakter);
  - tidak boleh mengandung `: \ / ? * [ ]` (ganti dengan spasi);
  - harus unik tanpa membedakan huruf besar/kecil; bila bentrok setelah dipotong, tambahkan ` (2)`, ` (3)`, … sambil tetap ≤ 31 karakter;
  - setelah dipotong, **hapus spasi di ujung nama** sebelum menambahkan akhiran (agar tidak muncul spasi ganda sebelum ` (2)`).

```ts
function namaSheet(nama: string, dipakai: Set<string>): string {
  const dasar = nama.replace(/[:\\/?*\[\]]/g, " ").trim();
  let s = dasar.slice(0, 31).trimEnd();
  for (let i = 2; dipakai.has(s.toLowerCase()); i++) {
    const akhiran = ` (${i})`;
    s = dasar.slice(0, 31 - akhiran.length).trimEnd() + akhiran;
  }
  dipakai.add(s.toLowerCase());
  return s;
}
```
- Ambil semua data dengan **satu** query (join `siswa`, `nilai`, `mapel`), bukan satu query per siswa.
- Nama berkas: `nilai_semua_siswa_ASTS_GANJIL_2026-2027.xlsx`.

---

## 6. Antarmuka (ringkas)

- **Navigasi atas:** Nilai, Siswa, Dongkrak. Judul aplikasi: "Raport ASTS — MTsS MA'ARIF TIENG · 2026/2027 · GANJIL".
- Semua teks dalam bahasa Indonesia. Pesan sukses/gagal tampil sebagai notifikasi singkat.
- Tombol berbahaya (Terapkan, Reset) selalu lewat dialog konfirmasi.
- Tampilkan keadaan memuat dan keadaan kosong pada setiap tabel.

---

## 7. Catatan Keamanan dan Penerapan

- Aplikasi **tanpa login** (sesuai permintaan). Siapa pun yang bisa membuka alamatnya dapat **mengubah nilai**. Karena itu jalankan secara **lokal**, atau di balik perlindungan jaringan/penyedia hosting (mis. password proteksi di tingkat hosting). Jangan dipublikasikan terbuka.
- Token Turso hanya di variabel lingkungan sisi server. Jangan memakai awalan `NEXT_PUBLIC_`.
- Semua kueri memakai parameter (`?`/`:nama`), tidak boleh menggabungkan string masukan ke SQL.

---

## 8. Data Uji dan Kriteria Penerimaan

Gunakan seed asli. Semua angka di bawah dihitung dari seed.

### 8.1 Data awal
| Pemeriksaan | Hasil yang benar |
|---|---|
| Jumlah siswa / mapel / nilai | 128 / 48 / 2.048 |
| Siswa per kelas | 7A 19, 7B 18, 8A 28, 8B 29, 9 34 |
| Nilai per siswa | 16 untuk semua siswa |
| Predikat dari nilai asli (belum dongkrak) | A 24, B 115, C 213, D 1.696 |
| Nilai asli bernilai 0 | 28 |
| Nilai asli paling kecil / besar | 0 / 100 |

### 8.2 Siswa contoh: `AHMAD RIFA`I`, kelas 7A (id 1)

| No | Mapel | Nilai asli | Predikat |
|---|---|---|---|
| 1 | Akidah Akhlak | 56 | D |
| 2 | Al-Quran Hadis | 60 | D |
| 3 | Bahasa Arab | 64 | D |
| 4 | Bahasa Indonesia | 72 | D |
| 5 | Bahasa Inggris | 32 | D |
| 6 | Bahasa Jawa | 55 | D |
| 7 | Fikih | 50 | D |
| 8 | Informatika | 48 | D |
| 9 | IPA | 28 | D |
| 10 | IPS | 70 | D |
| 11 | Ke-NU-an | 60 | D |
| 12 | Matematika | 30 | D |
| 13 | Pendidikan Pancasila | 44 | D |
| 14 | PJOK | 56 | D |
| 15 | Sejarah Kebudayaan Islam | 56 | D |
| 16 | Seni Budaya | 40 | D |

File raport siswa ini: `A1 = AHMAD RIFA`I`, `B1 = MTsS MA'ARIF TIENG`, `B2 = 7A/GANJIL`, `B3 = 2026/2027`, baris 5 = `1 | Akidah Akhlak | 56 | D`.

### 8.3 Uji dongkrak (urutan harus dijalankan berurutan)

| Langkah | Aksi | Hasil yang benar |
|---|---|---|
| 1 | Pratinjau 0–30 → 30 | 219 nilai terdampak (28 di antaranya bernilai 0) |
| 2 | Terapkan 0–30 → 30 | `nilai_dongkrak` terisi di 219 baris. Siswa contoh: **IPA 28 → 30** dan **Matematika 30 → 30** terdampak; Bahasa Inggris 32 **tidak**. |
| 3 | Terapkan 0–50 → 50 | `nilai_dongkrak` terisi di **834** baris (bukan 219 + 834): hasil langkah 2 terhapus. Siswa contoh: IPA = 50, Matematika = 50. |
| 4 | Terapkan 0–20 → 25 | Terisi di **92** baris. IPA siswa contoh (28) kembali **tanpa** dongkrak (tampil `-`, nilai akhir 28). |
| 5 | Edit `nilai_asli` salah satu baris dari 30 menjadi 15 (aturan 0–20 → 25 aktif) | `nilai_dongkrak` baris itu menjadi **25**. Ubah lagi ke 60 → `nilai_dongkrak` kembali `NULL`. |
| 6 | Reset dongkrak | Semua `nilai_dongkrak` = `NULL`, tabel `aturan_dongkrak` kosong |
| 7 | Bandingkan semua `nilai_asli` dengan seed | **Identik** (kecuali baris yang sengaja diedit di langkah 5) |

### 8.4 Daftar centang penerimaan
1. Urutan kolom tabel nilai: Siswa, Mapel, Nilai Asli, Nilai Dongkrak, Predikat.
2. Predikat sesuai 3.3 pada batas 76/77, 84/85, 92/93.
3. Raport (F4) mengikuti tata letak sel persis, `B2` berbentuk `7A/GANJIL`, tanpa kata "Kelas" dan tanpa strip.
4. File F5 berisi **128 sheet**; setiap sheet identik dengan F4 untuk siswa tersebut; tiap sheet tercetak **1 halaman A4**; tidak ada nama sheet > 31 karakter atau duplikat.
5. NIS/NISN kosong tersimpan `NULL`, dan dua siswa dengan NIS/NISN kosong **tidak** memicu error duplikat.
6. NIS/NISN yang sudah dipakai siswa lain ditolak dengan pesan 409.
7. Mengubah kelas ke tingkat lain ditolak; 7A ↔ 7B diterima.
8. Semua uji 8.3 lulus.
9. Aplikasi berjalan dengan `npm run dev` setelah: seed dijalankan, `npm run db:migrate`, dan variabel lingkungan diisi.

---

## 9. Cara Menyiapkan Database

```bash
turso db shell <nama-db> < seed_asts_turso.sql      # skema + data (menimpa tabel siswa, mapel, nilai)
npm run db:migrate                                    # membuat tabel aturan_dongkrak
```

Seed diawali `DROP TABLE IF EXISTS`, jadi menjalankannya ulang **menghapus semua perubahan** (nilai asli yang diedit, NIS/NISN yang diisi). Jangan menjalankan ulang setelah aplikasi dipakai, kecuali memang ingin mengulang dari awal.
