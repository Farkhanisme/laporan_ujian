import { PageTitle } from "@/components/page-title";
import { SiswaTable } from "@/components/siswa/siswa-table";


export default function SiswaPage() {
  return (
    <div className="space-y-4">
      <PageTitle
        title="Data Siswa"
        description="Cari, filter, dan perbarui data siswa."
      />
      <SiswaTable />
    </div>
  );
}