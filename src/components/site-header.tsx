import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ModeToggle } from "./mode-toggle";
import { Button } from "@/components/button";
import { Plus, Clock } from "lucide-react";
import { MultiStepPopup } from "@/components/form-add-property";
import { useState, useEffect } from "react";

export function SiteHeader() {
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handlePropertyComplete = (data: unknown) => {
    console.log("New property data:", data);
    // Here you would typically save to database
  };

  // Format date and time
  const formatDateTime = (date: Date) => {
    return {
      date: date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      time: date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      }),
    };
  };

  const { date, time } = formatDateTime(currentTime);

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
          {/* Realtime Date and Time */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg border">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="text-xs font-medium text-foreground leading-tight">
                {date}
              </span>
              <span className="text-xs text-muted-foreground leading-tight">
                {time}
              </span>
            </div>
          </div>

          {/* Mobile: Time only */}
          <div className="flex md:hidden items-center gap-1 px-2 py-1 bg-muted/50 rounded border">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs font-medium text-foreground">
              {time.split(":").slice(0, 2).join(":")} {time.split(" ")[1]}
            </span>
          </div>

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
