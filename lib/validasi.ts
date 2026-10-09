import { z } from "zod";

export const siswaSchema = z.object({
  nama: z
    .string()
    .min(1, "Nama wajib diisi")
    .transform((s) => s.trim().replace(/\s+/g, " "))
    .refine((s) => s.length > 0, "Nama wajib diisi"),
  kelas: z.enum(["7A", "7B", "8A", "8B", "9"], "Kelas tidak valid"),
  nis: z
    .string()
    .optional()
    .transform((v) => {
      const t = (v ?? "").trim();
      return t === "" ? null : t;
    })
    .refine((v) => v === null || /^\d+$/.test(v), "NIS hanya boleh angka"),
  nisn: z
    .string()
    .optional()
    .transform((v) => {
      const t = (v ?? "").trim();
      return t === "" ? null : t;
    })
    .refine((v) => v === null || /^\d+$/.test(v), "NISN hanya boleh angka"),
});

export type SiswaInput = z.infer<typeof siswaSchema>;

export const nilaiSchema = z.object({
  id: z.number().int().positive(),
  // Pemilik baris diverifikasi ulang di server lewat UPDATE yang mencocokkan
  // siswa_id, jadi `id` saja tidak cukup untuk mencegah menulis baris orang lain.
  siswa_id: z.number().int().positive(),
  nilai_asli: z
    .number({ message: "Nilai harus bilangan bulat 0–100." })
    .int("Nilai harus bilangan bulat 0–100.")
    .min(0, "Nilai harus bilangan bulat 0–100.")
    .max(100, "Nilai harus bilangan bulat 0–100."),
});

export const nilaiBatchSchema = z.object({
  items: z.array(nilaiSchema).min(1, "Minimal 1 nilai"),
});

export type NilaiBatchInput = z.infer<typeof nilaiBatchSchema>;

export const dongkrakSchema = z.object({
  nilai_awal: z.number().int().min(0).max(100),
  nilai_akhir: z.number().int().min(0).max(100),
  nilai_target: z.number().int().min(0).max(100),
}).refine((data) => data.nilai_awal <= data.nilai_akhir, {
  message: "Nilai awal harus ≤ nilai akhir",
  path: ["nilai_awal"],
});

export type DongkrakInput = z.infer<typeof dongkrakSchema>;

const batasPredikatSchema = z.object({
  minA: z.number({ message: "Batas bawah harus bilangan bulat 0–100." }).int().min(1, "Batas bawah minimal 1.").max(100, "Batas bawah maksimal 100."),
  minB: z.number({ message: "Batas bawah harus bilangan bulat 0–100." }).int().min(1, "Batas bawah minimal 1.").max(100, "Batas bawah maksimal 100."),
  minC: z.number({ message: "Batas bawah harus bilangan bulat 0–100." }).int().min(1, "Batas bawah minimal 1.").max(100, "Batas bawah maksimal 100."),
  batasTuntas: z.number({ message: "Batas tuntas harus bilangan bulat 0–100." }).int().min(0, "Batas tuntas minimal 0.").max(100, "Batas tuntas maksimal 100."),
})
  // Batas harus menurun ketat. Tanpa ini, rentang bisa tumpang tindih (mis. A
  // mulai 80 dan B mulai 80) sehingga satu nilai punya dua predikat, atau
  // menyisakan nilai yang tidak punya predikat sama sekali.
  .refine((d) => d.minA > d.minB, {
    message: "Batas A harus lebih besar dari batas B.",
    path: ["minA"],
  })
  .refine((d) => d.minB > d.minC, {
    message: "Batas B harus lebih besar dari batas C.",
    path: ["minB"],
  });

export type BatasPredikatInput = z.infer<typeof batasPredikatSchema>;

export function validasiSiswa(data: unknown) {
  return siswaSchema.safeParse(data);
}

export function validasiNilaiBatch(data: unknown) {
  return nilaiBatchSchema.safeParse(data);
}

export function validasiDongkrak(data: unknown) {
  return dongkrakSchema.safeParse(data);
}

export const mapelBaruSchema = z.object({
  nama: z
    .string()
    .min(1, "Nama mata pelajaran wajib diisi")
    .transform((s) => s.trim().replace(/\s+/g, " "))
    .refine((s) => s.length > 0, "Nama mata pelajaran wajib diisi")
    .refine((s) => s.length <= 60, "Nama mata pelajaran maksimal 60 karakter"),
  kode: z
    .string()
    .optional()
    .transform((v) => (v ?? "").trim()),
});

export type MapelBaruInput = z.infer<typeof mapelBaruSchema>;

export function validasiMapelBaru(data: unknown) {
  return mapelBaruSchema.safeParse(data);
}

export function validasiBatasPredikat(data: unknown) {
  return batasPredikatSchema.safeParse(data);
}