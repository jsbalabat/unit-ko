import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ModeToggle } from "./mode-toggle";
import { Button } from "@/components/button";
import { Plus } from "lucide-react";
import { MultiStepPopup } from "@/components/form-add-property";
import { useState } from "react";

export function SiteHeader() {
  const [isPopupOpen, setIsPopupOpen] = useState(false);

  const handlePropertyComplete = (data: unknown) => {
    console.log("New property data:", data);
    // Here you would typically save to database
  };

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-16">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium">UnitKo Dashboard</h1>
        <div className="ml-auto flex items-center gap-3">
          <Button
            size="sm"
            className="flex items-center gap-2"
            onClick={() => setIsPopupOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Add Property
          </Button>
          <ModeToggle />
        </div>
      </div>

      <MultiStepPopup
        isOpen={isPopupOpen}
        onClose={() => setIsPopupOpen(false)}
        onComplete={handlePropertyComplete}
      />
    </header>
  );
}
