// Menjalankan migrasi database (idempotent).
// Pakai: npm run db:migrate
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@libsql/client";
import { envWajib } from "./env.mts";

const { url, authToken } = envWajib();
const db = createClient({ url, authToken });
const dir = path.join(process.cwd(), "db");

const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();

for (const file of files) {
  const sql = await readFile(path.join(dir, file), "utf8");
  await db.executeMultiple(sql);
  console.log(`OK  ${file}`);
}

console.log("Migrasi selesai.");