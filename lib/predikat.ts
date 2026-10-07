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

export const PREDIKAT_COLORS: Record<Predikat, string> = {
  A: "bg-green-100 text-green-800",
  B: "bg-blue-100 text-blue-800",
  C: "bg-yellow-100 text-yellow-800",
  D: "bg-red-100 text-red-800",
};