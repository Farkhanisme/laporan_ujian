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