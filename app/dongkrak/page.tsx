import { PageTitle } from "@/components/page-title";
import { DongkrakView } from "@/components/dongkrak/dongkrak-view";


export default function DongkrakPage() {
  return (
    <div className="space-y-4">
      <PageTitle
        title="Dongkrak Nilai"
        description="Satu aturan berlaku: rentang nilai asli diubah menjadi nilai target. Nilai asli tidak pernah berubah."
      />
      <DongkrakView />
    </div>
  );
}