CREATE TABLE IF NOT EXISTS aturan_dongkrak (
  id              INTEGER PRIMARY KEY CHECK (id = 1),
  nilai_awal      INTEGER NOT NULL CHECK (nilai_awal   BETWEEN 0 AND 100),
  nilai_akhir     INTEGER NOT NULL CHECK (nilai_akhir  BETWEEN 0 AND 100),
  nilai_target    INTEGER NOT NULL CHECK (nilai_target BETWEEN 0 AND 100),
  diterapkan_pada TEXT NOT NULL,
  CHECK (nilai_awal <= nilai_akhir)
);