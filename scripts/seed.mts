// Mengisi database dengan skema + data awal, tanpa Turso CLI.
// Pakai: npm run db:seed
//
// PERINGATAN: berkas seed diawali DROP TABLE IF EXISTS, jadi perintah ini
// MENGHAPUS seluruh data yang ada (nilai asli yang sudah diedit, NIS/NISN
// yang sudah diisi). Jalankan hanya saat mulai dari nol.
import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { envWajib } from "./env.mts";

const { url, authToken } = envWajib();
const seed = path.join(process.cwd(), "specs/seed_asts_turso.sql");

console.log(`Target : ${url.replace(/\/\/[^@]*@/, "//***@")}`);
console.log(`Seed   : specs/seed_asts_turso.sql`);

// Konfirmasi bila database sudah berisi data, supaya tidak ada yang
// terhaps tanpa sadar.
const cek = createClient({ url, authToken });
try {
  const ada = await cek.execute({
    sql: "SELECT name FROM sqlite_master WHERE type='table' AND name='siswa'",
    args: [],
  });
  if (ada.rows.length > 0) {
    const n = await cek.execute({ sql: "SELECT COUNT(*) AS n FROM siswa", args: [] });
    const isi = Number(n.rows[0].n);
    if (isi > 0 && !process.argv.includes("--force")) {
      console.error(`\nDatabase sudah berisi ${isi} siswa.`);
      console.error("Menjalankan seed akan MENGHAPUS semua data itu.");
      console.error("Paksa dengan: npm run db:seed -- --force\n");
      process.exit(1);
    }
    if (isi > 0) {
      console.log(`Paksa: mengabaikan ${isi} siswa yang ada.`);
    }
  }
} catch {
  // Database belum ada / belum punya tabel apa pun — lanjutkan saja.
}

const db = createClient({ url, authToken });
await db.executeMultiple(readFileSync(seed, "utf8"));

const hasil = await db.execute({
  sql: `SELECT (SELECT COUNT(*) FROM siswa)  AS siswa,
               (SELECT COUNT(*) FROM mapel)  AS mapel,
               (SELECT COUNT(*) FROM nilai)  AS nilai`,
  args: [],
});

const { siswa, mapel, nilai } = hasil.rows[0] as Record<string, number>;

console.log(`\nSeed selesai: ${siswa} siswa, ${mapel} mapel, ${nilai} nilai.`);

if (siswa !== 128 || mapel !== 48 || nilai !== 2048) {
  console.error("Peringatan: jumlah baris tidak sesuai seed yang diharapkan (128/48/2048).");
  process.exit(1);
}

console.log("Langkah berikutnya: npm run db:migrate");