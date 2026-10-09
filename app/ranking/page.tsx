import { PageHeader } from "@/components/page-header";
import { RankingView } from "@/components/ranking/ranking-view";

export default async function RankingPage({
  searchParams,
}: {
  searchParams: Promise<{ kelas?: string; mapel?: string }>;
}) {
  const { kelas, mapel } = await searchParams;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Ranking Siswa"
        description="Peringkat siswa per kelas, dari rata-rata seluruh mata pelajaran atau dari satu mata pelajaran. Memakai nilai akhir, jadi aturan dongkrak ikut diperhitungkan."
      />
      <RankingView kelasAwal={kelas} mapelAwal={mapel} />
    </div>
  );
}