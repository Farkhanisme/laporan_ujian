import { PageHeader } from "@/components/page-header";
import { NilaiView } from "@/components/nilai/nilai-view";

export default async function NilaiPage({
  searchParams,
}: {
  searchParams: Promise<{ mapel?: string }>;
}) {
  const { mapel } = await searchParams;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Nilai ASTS"
        description="Pantau dan perbarui nilai asli tiap siswa. Nilai dongkrak dihitung otomatis dari aturan yang berlaku."
      />
      <NilaiView mapelAwal={mapel} />
    </div>
  );
}