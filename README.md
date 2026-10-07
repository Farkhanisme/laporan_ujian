# Aplikasi Raport & Dongkrak Nilai ASTS

**MTsS MA'ARIF TIENG** · Tahun ajaran 2026/2027 · Semester GANJIL

Aplikasi web untuk satu pengguna (pemilik), **tanpa login**, yang hanya berisi nilai ASTS:
mengelola data siswa, mendongkrak nilai lewat satu aturan rentang → target, mengunduh raport
per siswa, dan mengunduh semua nilai dalam satu file Excel (satu sheet per siswa).

## Teknologi

| Bagian | Pilihan |
|---|---|
| Framework | Next.js (App Router), TypeScript |
| Database | Turso (libSQL/SQLite) via `@libsql/client` |
| Excel | `exceljs`, di server |
| UI | Tailwind CSS + shadcn/ui |
| Validasi | Zod |

## Menyiapkan

### 1. Install dependensi

```bash
npm install
```

### 2. Isi variabel lingkungan

```bash
cp .env.example .env.local
```

Isi `TURSO_DATABASE_URL` dan `TURSO_AUTH_TOKEN`. Jangan pernah memakai awalan `NEXT_PUBLIC_` —
token hanya dibaca di server.

Berkas yang sama dibaca otomatis oleh `db:seed` dan `db:migrate`, jadi env tidak perlu
diset ulang untuk menjalankan skrip tersebut.

Untuk Vercel: Settings → Environment Variables, tambahkan `TURSO_DATABASE_URL` dan
`TURSO_AUTH_TOKEN` (tanpa `NEXT_PUBLIC_`). Seed dan migrasi cukup dijalankan satu kali
dari komputer lokal — Vercel hanya butuh dua variabel itu.

### 3. Jalankan seed (data awal)

```bash
npm run db:seed
```

Membaca `specs/seed_asts_turso.sql` dan mengirimnya ke database memakai `@libsql/client`
— **tidak perlu Turso CLI**. Skrip memverifikasi hasilnya dan berhenti dengan pesan jelas
bila jumlahnya bukan 128 siswa / 48 mapel / 2.048 nilai.

> Seed diawali `DROP TABLE IF EXISTS`, jadi menjalankannya akan **menghapus semua data yang
> ada**. Bila database sudah berisi siswa, skrip menolak jalan dan meminta `--force`:
> ```bash
> npm run db:seed -- --force
> ```

### 4. Jalankan migrasi

```bash
npm run db:migrate
```

Membuat tabel `aturan_dongkrak`. Aman dijalankan berulang kali.

### 5. Jalankan aplikasi

```bash
npm run dev
```

## Skrip

| Perintah | Kegunaan |
|---|---|
| `npm run dev` | Server pengembangan |
| `npm run build` | Build produksi |
| `npm run start` | Menjalankan hasil build |
| `npm run db:seed` | Mengisi database dari `specs/seed_asts_turso.sql` (menghapus data lama) |
| `npm run db:migrate` | Menjalankan berkas SQL di `db/` |
| `npm run lint` | ESLint |
| `npm run cek:logic` | Uji logika murni: predikat, urutan mapel & siswa, nama sheet, perpindahan kelas |
| `npm run cek:api` | Uji end-to-end handler API terhadap database lokal dari seed (80 pemeriksaan) |
| `npm run cek:siapkan` | Menyiapkan ulang `scripts/cek-api.sqlite` dari seed + migrasi |

`cek:api` membuat salinan database uji sendiri di `scripts/cek-api.sqlite`, jadi tidak
pernah menyentuh database Turso Anda.

## Konsep penting

**Nilai akhir** = `COALESCE(nilai_dongkrak, nilai_asli)`. Predikat dihitung dari nilai akhir:

| Predikat | Nilai akhir |
|---|---|
| A | 93–100 |
| B | 85–92 |
| C | 77–84 |
| D | 0–76 |

**Aturan dongkrak.** Hanya satu aturan berlaku pada satu waktu:

> Semua nilai asli dari [awal] sampai [akhir] (inklusif) diubah menjadi [target].

Menerapkan aturan baru **menimpa** yang lama: seluruh `nilai_dongkrak` dikosongkan lebih dulu,
lalu dihitung ulang dari `nilai_asli`. `nilai_asli` tidak pernah diubah oleh proses ini.

## Keamanan

Aplikasi ini **tanpa login**. Siapa pun yang bisa membuka alamatnya dapat mengubah nilai.
Karena itu jalankan secara lokal, atau di balik perlindungan jaringan/password di tingkat
hosting. Jangan dipublikasikan terbuka.