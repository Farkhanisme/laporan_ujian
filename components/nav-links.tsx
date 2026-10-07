"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/nilai", label: "Nilai" },
  { href: "/siswa", label: "Siswa" },
  { href: "/dongkrak", label: "Dongkrak" },
  { href: "/mapel", label: "Mapel" },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1">
      {links.map((link) => {
        const aktif = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={aktif ? "page" : undefined}
            className={
              aktif
                ? "rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
                : "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            }
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}