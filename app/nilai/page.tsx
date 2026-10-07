import { PageTitle } from "@/components/page-title";
import { NilaiView } from "@/components/nilai/nilai-view";

export default async function NilaiPage({
  searchParams,
}: {
  searchParams: Promise<{ mapel?: string }>;
}) {
  const { mapel } = await searchParams;

  return (
    <div className="space-y-4">
      <PageTitle
        title="Nilai ASTS"
        description="Lihat dan perbarui nilai asli per siswa."
      />
      <NilaiView mapelAwal={mapel} />
    </div>
  );
}