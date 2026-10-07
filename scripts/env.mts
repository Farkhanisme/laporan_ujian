import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Memuat TURSO_DATABASE_URL / TURSO_AUTH_TOKEN dari .env.local supaya skrip
 * bisa dijalankan tanpa menyetel env secara manual.
 */
export function muatEnv(): void {
  for (const nama of [".env.local", ".env"]) {
    const file = path.join(process.cwd(), nama);
    if (existsSync(file) && !process.env.TURSO_DATABASE_URL) {
      process.loadEnvFile(file);
      return;
    }
  }
}

export function envWajib(): { url: string; authToken?: string } {
  muatEnv();

  const url = process.env.TURSO_DATABASE_URL;
  if (!url) {
    console.error("TURSO_DATABASE_URL belum diset.");
    console.error("Salin .env.example menjadi .env.local lalu isi nilainya.");
    process.exit(1);
  }

  return { url, authToken: process.env.TURSO_AUTH_TOKEN };
}