import { PageHeader } from "@/components/page-header";
import { MapelView } from "@/components/mapel/mapel-view";

export default function MapelPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Mata Pelajaran"
        description="Tambah mata pelajaran baru. Nilai awal diisi 0, bisa diubah dari halaman Nilai."
      />
      <MapelView />
    </div>
  );
}