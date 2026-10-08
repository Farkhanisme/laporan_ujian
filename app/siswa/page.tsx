import { PageHeader } from "@/components/page-header";
import { SiswaTable } from "@/components/siswa/siswa-table";

export default function SiswaPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Data Siswa"
        description="Cari, filter, dan perbarui data siswa. Ikon unduh pada baris siswa menghasilkan raport untuk siswa itu."
      />
      <SiswaTable />
    </div>
  );
}