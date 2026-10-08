import { PageHeader } from "@/components/page-header";
import { SiswaForm } from "@/components/siswa/siswa-form";

export default async function SiswaEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Edit Siswa"
        description="Perbarui nama, kelas, NIS, dan NISN."
        remah={[
          { label: "Siswa", href: "/siswa" },
          { label: `Siswa #${id}` },
        ]}
      />
      <SiswaForm siswaId={id} />
    </div>
  );
}