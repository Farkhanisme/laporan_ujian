import { PageHeader } from "@/components/page-header";
import { PredikatView } from "@/components/predikat/predikat-view";

export default function PredikatPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Pengaturan Predikat"
        description="Tentukan batas bawah tiap predikat dan batas tuntas. Berlaku untuk raport, ringkasan, ranking, dan tabel nilai."
      />
      <PredikatView />
    </div>
  );
}