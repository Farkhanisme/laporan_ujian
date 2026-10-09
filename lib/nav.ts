import {
  BookOpenText,
  ClipboardList,
  TrendingUp,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

/** Satu sumber untuk sidebar, drawer mobile, dan breadcrumb. */
export const NAV_ITEMS: NavItem[] = [
  {
    href: "/nilai",
    label: "Nilai",
    description: "Lihat dan perbarui nilai ASTS",
    icon: ClipboardList,
  },
  {
    href: "/ranking",
    label: "Ranking",
    description: "Peringkat siswa per kelas",
    icon: Trophy,
  },
  {
    href: "/siswa",
    label: "Siswa",
    description: "Data siswa dan raport",
    icon: Users,
  },
  {
    href: "/dongkrak",
    label: "Dongkrak",
    description: "Aturan menaikkan nilai",
    icon: TrendingUp,
  },
  {
    href: "/mapel",
    label: "Mapel",
    description: "Mata pelajaran",
    icon: BookOpenText,
  },
];

/** Path yang cocok dengan `href`, termasuk turunannya (mis. /siswa/12). */
export function navAktif(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Label menu untuk breadcrumb; `null` bila path tidak dikenal. */
export function labelNav(pathname: string): string | null {
  const item = NAV_ITEMS.find((n) => navAktif(pathname, n.href));
  return item ? item.label : null;
}