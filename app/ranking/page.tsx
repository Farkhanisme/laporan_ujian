import { PageHeader } from "@/components/page-header";
import { RankingView } from "@/components/ranking/ranking-view";

export default async function RankingPage({
  searchParams,
}: {
  searchParams: Promise<{ kelas?: string }>;
}) {
  const { kelas } = await searchParams;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Ranking Siswa"
        description="Peringkat siswa per kelas berdasarkan rata-rata seluruh mata pelajaran. Memakai nilai akhir, jadi aturan dongkrak ikut diperhitungkan."
      />
      <RankingView kelasAwal={kelas} />
    </div>
  );
}