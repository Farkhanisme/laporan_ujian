import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Remah {
  label: string;
  href?: string;
}

export function PageHeader({
  title,
  description,
  remah,
  action,
  className,
}: {
  title: string;
  description?: string;
  /** remah = struktur folder halaman, mis. ["Siswa", "Edit"] */
  remah?: Remah[];
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-x-4 gap-y-3", className)}>
      <div className="min-w-0">
        {remah?.length ? (
          <nav aria-label="Remah" className="mb-1">
            <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              {remah.map((r, i) => (
                <li key={`${r.label}-${i}`} className="flex items-center gap-1">
                  {i > 0 ? <ChevronRight className="size-3" aria-hidden /> : null}
                  {r.href ? (
                    <Link href={r.href} className="hover:text-foreground hover:underline">
                      {r.label}
                    </Link>
                  ) : (
                    <span aria-current="page">{r.label}</span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        ) : null}

        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {description ? (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>

      {action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  );
}