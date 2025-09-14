import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ModeToggle } from "./mode-toggle";
import { Button } from "@/components/button";
import { Plus, Clock, Menu, Home } from "lucide-react";
import { MultiStepPopup } from "@/components/form-add-property";
import { useState, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function SiteHeader() {
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  // Update time every second, but only on the client side
  useEffect(() => {
    // Set initial time only on the client side
    setCurrentTime(new Date());

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

  // Only format the time if we have a currentTime value
  const { date, time } = currentTime
    ? formatDateTime(currentTime)
    : { date: "", time: "" };

  return (
    <header className="flex h-14 sm:h-16 shrink-0 items-center gap-1 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-30 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-16">
      <div className="flex w-full items-center gap-1 px-3 sm:px-4 lg:gap-2 lg:px-6">
        {/* Mobile: App Logo and Brand */}
        <div className="flex items-center sm:hidden">
          <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary/10 text-primary mr-2">
            <Home className="h-3.5 w-3.5" />
          </div>
          <span className="font-semibold text-sm">Unitko</span>
        </div>

        {/* Sidebar Trigger - Hidden on smallest screens, visible on larger */}
        <div className="hidden xs:block">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mx-1 sm:mx-2 data-[orientation=vertical]:h-4 hidden xs:inline-block"
          />
        </div>

        {/* Title - Hidden on smallest screens */}
        <h1 className="hidden sm:inline-block text-base font-medium">
          UnitKo Dashboard
        </h1>

        {/* Right Section */}
        <div className="ml-auto flex items-center gap-1 sm:gap-2 md:gap-3">
          {/* Date and Time - Different layouts for different screen sizes */}
          {currentTime ? (
            <>
              {/* Desktop & Tablet: Full date and time */}
              <div className="hidden md:flex items-center gap-2 px-2.5 py-1.5 bg-muted/50 rounded-lg border text-xs lg:text-sm">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <div className="flex gap-1.5">
                  <span className="font-medium text-foreground leading-tight">
                    {date}
                  </span>
                  <span className="text-muted-foreground leading-tight">
                    {time}
                  </span>
                </div>
              </div>

              {/* Small screens: Time only */}
              <div className="hidden xs:flex md:hidden items-center gap-1 px-2 py-1 bg-muted/50 rounded border">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs font-medium text-foreground">
                  {time
                    ? `${time.split(":").slice(0, 2).join(":")} ${
                        time.split(" ")[1]
                      }`
                    : ""}
                </span>
              </div>
            </>
          ) : (
            // Placeholders with same dimensions for each screen size
            <>
              <div className="hidden md:flex items-center gap-2 px-2.5 py-1.5 bg-muted/50 rounded-lg border opacity-0">
                <Clock className="h-3.5 w-3.5" />
                <div className="w-[180px]"></div>
              </div>
              <div className="hidden xs:flex md:hidden items-center gap-1 px-2 py-1 bg-muted/50 rounded border opacity-0">
                <Clock className="h-3 w-3" />
                <div className="w-[60px]"></div>
              </div>
            </>
          )}

          {/* Desktop: Full Add Property Button */}
          <Button
            size="sm"
            className="hidden xs:flex items-center gap-1.5 h-8 lg:h-9"
            onClick={() => setIsPopupOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline-block">Add Property</span>
          </Button>

          {/* Large screens: Mode Toggle direct */}
          <div className="hidden sm:block">
            <ModeToggle />
          </div>

          {/* Avatar for xs screens */}
          <div className="hidden xs:flex sm:hidden">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="text-xs bg-primary/10 text-primary font-medium">
                JD
              </AvatarFallback>
            </Avatar>
          </div>

          {/* Mobile: More menu dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 sm:hidden">
                <Menu className="h-[18px] w-[18px]" />
                <span className="sr-only">Menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 mr-1">
              {/* Mobile header in dropdown */}
              <div className="flex items-center px-2 pt-1 pb-2">
                <Avatar className="h-8 w-8 mr-2">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                    JD
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">Juan Dela Cruz</p>
                  <p className="text-xs text-muted-foreground">
                    Landlord Account
                  </p>
                </div>
              </div>
              <DropdownMenuSeparator />

              {/* Menu Items */}
              <div className="px-2 py-1.5">
                <p className="text-xs text-muted-foreground font-medium mb-1">
                  Dashboard
                </p>
              </div>
              <DropdownMenuItem
                className="flex items-center gap-2 cursor-pointer pl-2"
                onClick={() => setIsPopupOpen(true)}
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Plus className="h-3.5 w-3.5" />
                </div>
                <span className="text-sm">Add New Property</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="flex items-center gap-2 cursor-pointer pl-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                  <Home className="h-3.5 w-3.5" />
                </div>
                <span className="text-sm">My Properties</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator className="my-1" />
              <div className="px-2 py-1.5">
                <p className="text-xs text-muted-foreground font-medium mb-1">
                  Settings
                </p>
              </div>

              <DropdownMenuItem className="flex items-center justify-between pl-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                    <Clock className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-sm">Current Time</span>
                </div>
                <span className="text-xs font-medium">
                  {time
                    ? `${time.split(":").slice(0, 2).join(":")} ${
                        time.split(" ")[1]
                      }`
                    : ""}
                </span>
              </DropdownMenuItem>

              <DropdownMenuItem className="flex items-center justify-between pl-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                    <span className="text-xs">Aa</span>
                  </div>
                  <span className="text-sm">Toggle Theme</span>
                </div>
                <div className="flex-shrink-0">
                  <ModeToggle />
                </div>
              </DropdownMenuItem>

              <DropdownMenuSeparator className="my-1" />
              <DropdownMenuItem className="text-sm text-red-600 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-950/50 cursor-pointer">
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mobile-only: Sidebar trigger on right */}
          <div className="xs:hidden ml-1">
            <SidebarTrigger className="h-8 w-8" />
          </div>
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
