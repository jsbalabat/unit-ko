import { ModeToggle } from "./mode-toggle";
import { Button } from "@/components/button";
import {
  Plus,
  Clock,
  Menu,
  Home,
  Settings,
  HelpCircle,
  LogOut,
  User,
} from "lucide-react";
import { MultiStepPopup } from "@/components/form-add-property";
import { useState, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export function SiteHeader() {
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const router = useRouter();

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

  const handleLogout = async () => {
    if (isLoggingOut) return;

    setIsLoggingOut(true);

    try {
      // Sign out from Supabase
      await supabase.auth.signOut();

      // Clear all local storage (including custom session data)
      localStorage.clear();
      sessionStorage.clear();

      // Navigate to login page
      router.push("/auth/landlord/login");
    } catch (error) {
      console.error("Logout error:", error);
      // Force navigation even if logout fails
      router.push("/auth/landlord/login");
    } finally {
      setIsLoggingOut(false);
    }
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
    <header className="flex h-14 sm:h-16 shrink-0 items-center gap-1 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-30 transition-[width,height] ease-linear">
      <div className="flex w-full items-center gap-1 px-3 sm:px-4 lg:gap-2 lg:px-6">
        {/* App Logo and Brand */}
        <div className="flex items-center">
          <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary/10 text-primary mr-2">
            <Home className="h-3.5 w-3.5" />
          </div>
          <span className="font-semibold text-sm">Unitko</span>
        </div>

        {/* Date and Time - Moved to left side */}
        {currentTime ? (
          <>
            {/* Desktop & Tablet: Full date and time */}
            <div className="hidden md:flex items-center gap-2 px-2.5 py-1.5 bg-muted/50 rounded-lg border text-xs lg:text-sm ml-4">
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
            <div className="hidden xs:flex md:hidden items-center gap-1 px-2 py-1 bg-muted/50 rounded border ml-4">
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

        {/* Right Section */}
        <div className="ml-auto flex items-center gap-1 sm:gap-2 md:gap-3">
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

          {/* Account Dropdown - Desktop */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="hidden sm:flex h-9 w-9 rounded-full"
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary font-medium">
                    JD
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    Juan Dela Cruz
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    landlord@example.com
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => router.push("/dashboard/landlord/profile")}
                className="cursor-pointer"
              >
                <User className="mr-2 h-4 w-4" />
                <span>Account</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer">
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer">
                <HelpCircle className="mr-2 h-4 w-4" />
                <span>Get Help</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/50"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>{isLoggingOut ? "Logging out..." : "Log out"}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

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
                    landlord@example.com
                  </p>
                </div>
              </div>
              <DropdownMenuSeparator />

              {/* Menu Items */}
              <DropdownMenuItem
                onClick={() => router.push("/dashboard/landlord/profile")}
                className="flex items-center gap-2 cursor-pointer"
              >
                <User className="h-4 w-4" />
                <span className="text-sm">Account</span>
              </DropdownMenuItem>

              <DropdownMenuItem className="flex items-center gap-2 cursor-pointer">
                <Settings className="h-4 w-4" />
                <span className="text-sm">Settings</span>
              </DropdownMenuItem>

              <DropdownMenuItem className="flex items-center gap-2 cursor-pointer">
                <HelpCircle className="h-4 w-4" />
                <span className="text-sm">Get Help</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                className="flex items-center gap-2 cursor-pointer"
                onClick={() => setIsPopupOpen(true)}
              >
                <Plus className="h-4 w-4" />
                <span className="text-sm">Add Property</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator className="my-1" />

              <DropdownMenuItem className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs">Aa</span>
                  <span className="text-sm">Toggle Theme</span>
                </div>
                <div className="flex-shrink-0">
                  <ModeToggle />
                </div>
              </DropdownMenuItem>

              <DropdownMenuSeparator className="my-1" />
              <DropdownMenuItem
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="text-sm text-red-600 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-950/50 cursor-pointer"
              >
                <LogOut className="mr-2 h-4 w-4" />
                {isLoggingOut ? "Logging out..." : "Log out"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
