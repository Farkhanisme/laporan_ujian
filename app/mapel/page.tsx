import { PageTitle } from "@/components/page-title";
import { MapelView } from "@/components/mapel/mapel-view";

export default function MapelPage() {
  return (
    <div className="space-y-4">
      <PageTitle
        title="Mata Pelajaran"
        description="Tambah mata pelajaran baru. Nilai awal diisi 0, bisa diubah dari halaman Nilai."
      />
      <MapelView />
    </div>
  );
}