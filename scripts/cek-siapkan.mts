// Menyiapkan database uji lokal (file:) dari seed + migrasi.
// Dijalankan otomatis oleh npm run cek:api.
import { rmSync, copyFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";

const target = path.join(process.cwd(), "scripts/cek-api.sqlite");
const seed = path.join(process.cwd(), "specs/seed_asts_turso.sql");

if (!existsSync(seed)) {
  console.error(`Seed tidak ditemukan: ${seed}`);
  process.exit(1);
}

mkdirSync(path.dirname(target), { recursive: true });
rmSync(target, { force: true });
rmSync(`${target}-wal`, { force: true });
rmSync(`${target}-shm`, { force: true });

// Salin supaya file seed asli tidak ikut berubah bila ada yang menulis.
copyFileSync(seed, `${target}.seed.sql`);

const db = createClient({ url: `file:${target}` });
const { readFileSync } = await import("node:fs");

await db.executeMultiple(readFileSync(`${target}.seed.sql`, "utf8"));

for (const f of (await import("node:fs")).readdirSync(path.join(process.cwd(), "db"))) {
  if (!f.endsWith(".sql")) continue;
  await db.executeMultiple(readFileSync(path.join(process.cwd(), "db", f), "utf8"));
}

rmSync(`${target}.seed.sql`, { force: true });

const n = await db.execute({ sql: "SELECT (SELECT COUNT(*) FROM siswa) AS s, (SELECT COUNT(*) FROM nilai) AS n", args: [] });
console.log(`Database uji siap: ${n.rows[0].s} siswa, ${n.rows[0].n} nilai, tabel aturan_dongkrak dibuat.`);