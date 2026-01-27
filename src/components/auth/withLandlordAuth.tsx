"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { checkLandlordAuth } from "@/lib/auth";
import { Loader2 } from "lucide-react";

/**
 * Higher Order Component to protect landlord-only routes
 * Redirects to landlord login if not authenticated
 */
export function withLandlordAuth<P extends object>(
  Component: React.ComponentType<P>,
) {
  return function ProtectedRoute(props: P) {
    const router = useRouter();
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(
      null,
    );
    const [isChecking, setIsChecking] = useState(true);

    useEffect(() => {
      const checkAuth = async () => {
        try {
          const authenticated = await checkLandlordAuth();

          if (!authenticated) {
            // Clear any invalid session
            localStorage.clear();
            sessionStorage.clear();
            router.replace("/auth/landlord/login");
            return;
          }

          setIsAuthenticated(true);
        } catch (error) {
          console.error("Auth check failed:", error);
          router.replace("/auth/landlord/login");
        } finally {
          setIsChecking(false);
        }
      };

      checkAuth();
    }, [router]);

    // Show loading state while checking authentication
    if (isChecking || isAuthenticated === null) {
      return (
        <div className="h-screen flex items-center justify-center">
          <div className="flex items-center gap-3 px-4 py-3 bg-muted/30 rounded-lg">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="font-medium">Verifying authentication...</span>
          </div>
        </div>
      );
    }

    // Only render the component if authenticated
    if (!isAuthenticated) {
      return null;
    }

    return <Component {...props} />;
  };
}
