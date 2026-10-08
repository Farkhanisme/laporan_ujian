"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Dialog } from "@base-ui/react/dialog";
import { AppSidebar, BrandMark } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

/** Top bar untuk layar kecil: tombol menu, brand, dan toggle tema. */
export function MobileTopBar() {
  const [buka, setBuka] = useState(false);

  return (
    <header className="sticky top-0 z-40 flex items-center gap-2 border-b bg-background/85 px-4 py-2.5 backdrop-blur-md lg:hidden">
      <Dialog.Root open={buka} onOpenChange={setBuka}>
        <Dialog.Trigger
          render={<Button variant="ghost" size="icon" aria-label="Buka menu navigasi" />}
        >
          <Menu className="size-5" />
        </Dialog.Trigger>

        <Dialog.Portal>
          <Dialog.Backdrop
            className="fixed inset-0 z-50 bg-black/40 transition-opacity duration-200 data-closed:opacity-0"
          />

          {/* Dialog meluncur dari kiri seperti drawer, bukan dari tengah. */}
          <Dialog.Popup
            className="fixed inset-y-0 left-0 z-50 w-[17rem] max-w-[85vw] bg-sidebar shadow-dock outline-none data-closed:animate-out data-closed:slide-out-to-left data-open:animate-in data-open:slide-in-from-left"
          >
            <Dialog.Title className="sr-only">Menu navigasi</Dialog.Title>
            <AppSidebar onNavigasi={() => setBuka(false)} />
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>

      <div className="min-w-0 flex-1">
        <BrandMark />
      </div>

      <ThemeToggle />
    </header>
  );
}