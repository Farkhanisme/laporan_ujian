import { createClient, type Client, type InValue } from "@libsql/client";

let client: Client | null = null;

/**
 * Klien Turso dibuat secara lazy: build Next.js tetap bisa jalan tanpa
 * TURSO_DATABASE_URL terisi, dan token tidak pernah ikut ke browser.
 */
export function db(): Client {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL;
    if (!url) {
      throw new Error("TURSO_DATABASE_URL tidak diset");
    }
    client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  }
  return client;
}

export type { InValue };