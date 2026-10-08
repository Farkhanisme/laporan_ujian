"use client";

import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PILIHAN = [
  { nilai: "light", label: "Terang", icon: Sun },
  { nilai: "dark", label: "Gelap", icon: Moon },
  { nilai: "system", label: "Ikuti sistem", icon: Monitor },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  // `theme` bernilai `undefined` sampai provider ter-hydrate. Menandainya
  // aktif lebih awal akan menandai item yang salah untuk sesaat.
  const aktif = (nilai: string) => theme === nilai;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Ubah tema tampilan" />
        }
      >
        <Sun className="size-4 scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90" />
        <Moon className="absolute size-4 scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {PILIHAN.map((p) => (
          <DropdownMenuItem
            key={p.nilai}
            onClick={() => setTheme(p.nilai)}
            className={aktif(p.nilai) ? "bg-accent text-accent-foreground" : undefined}
          >
            <p.icon className="size-4" />
            {p.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}