-- Batas bawah tiap predikat, bisa diubah pengguna dari halaman Pengaturan
-- Predikat. Pola satu baris (id = 1) mengikuti tabel aturan_dongkrak.
--
-- Hanya batas bawah yang disimpan. Batas atas diturunkan dari predikat di atasnya
-- (lihat lib/predikat.ts), jadi tidak mungkin ada celah atau tumpang tindih.
CREATE TABLE IF NOT EXISTS batas_predikat (
  id             INTEGER PRIMARY KEY CHECK (id = 1),
  min_a          INTEGER NOT NULL CHECK (min_a BETWEEN 1 AND 100),
  min_b          INTEGER NOT NULL CHECK (min_b BETWEEN 1 AND 100),
  min_c          INTEGER NOT NULL CHECK (min_c BETWEEN 1 AND 100),
  batas_tuntas   INTEGER NOT NULL CHECK (batas_tuntas BETWEEN 0 AND 100),
  diperbarui_pada TEXT NOT NULL,
  -- Batas harus menurun ketat: A > B > C. Nilai 0 selalu milik D, jadi tidak
  -- disimpan. Cek ini yang mencegah tersimpan rentang yang tumpang tindih.
  CHECK (min_a > min_b AND min_b > min_c)
);

-- Baris bawaan supaya aplikasi langsung memakai ketentuan awal walau tabel baru
-- saja dibuat. OR IGNORE: kalau baris sudah ada, jangan ditimpa.
INSERT OR IGNORE INTO batas_predikat
  (id, min_a, min_b, min_c, batas_tuntas, diperbarui_pada)
VALUES (1, 93, 85, 77, 77, '1970-01-01T00:00:00.000Z');