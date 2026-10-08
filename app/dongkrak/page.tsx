import { PageHeader } from "@/components/page-header";
import { DongkrakView } from "@/components/dongkrak/dongkrak-view";

export default function DongkrakPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Dongkrak Nilai"
        description="Satu aturan berlaku: rentang nilai asli diubah menjadi nilai target. Nilai asli tidak pernah berubah."
      />
      <DongkrakView />
    </div>
  );
}