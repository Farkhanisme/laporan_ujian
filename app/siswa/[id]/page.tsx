import { PageTitle } from "@/components/page-title";
import { SiswaForm } from "@/components/siswa/siswa-form";


export default async function SiswaEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="space-y-4">
      <PageTitle
        title="Edit Siswa"
        description="Perbarui nama, kelas, NIS, dan NISN."
      />
      <SiswaForm siswaId={id} />
    </div>
  );
}