export type Predikat = "A" | "B" | "C" | "D";

export function predikat(nilai: number): Predikat {
  if (nilai >= 93) return "A";
  if (nilai >= 85) return "B";
  if (nilai >= 77) return "C";
  return "D";
}

export function predikatLabel(p: Predikat): string {
  switch (p) {
    case "A":
      return "A (93–100)";
    case "B":
      return "B (85–92)";
    case "C":
      return "C (77–84)";
    case "D":
      return "D (0–76)";
  }
}

/** Kelas badge predikat, termasuk varian gelap, dipakai seluruh UI. */
export const PREDIKAT_CLASSES: Record<Predikat, string> = {
  A: "bg-emerald-100 text-emerald-800 ring-emerald-600/20 dark:bg-emerald-500/15 dark:text-emerald-300",
  B: "bg-sky-100 text-sky-800 ring-sky-600/20 dark:bg-sky-500/15 dark:text-sky-300",
  C: "bg-amber-100 text-amber-800 ring-amber-600/20 dark:bg-amber-500/15 dark:text-amber-300",
  D: "bg-rose-100 text-rose-800 ring-rose-600/20 dark:bg-rose-500/15 dark:text-rose-300",
};