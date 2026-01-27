"use client";

import React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/form";
import { Input } from "@/components/input";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ModeToggle } from "@/components/mode-toggle";
import { supabase } from "@/lib/supabase";
import { useState, useEffect, useCallback, useRef } from "react";
import type { Session } from "@supabase/supabase-js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Building, Mail, Lock, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const loginLandLordSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(6, {
    message: "Password must be at least 6 characters long",
  }),
});

type LoginFormData = z.infer<typeof loginLandLordSchema>;

export default function LandlordLogin() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const navigationAttempted = useRef(false);

  // Helper function to clear invalid session
  const clearInvalidSession = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      // Clear any stored tokens
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // Silent cleanup
    }
  }, []);

  const validateAndNavigate = useCallback(
    async (session: Session | null): Promise<boolean> => {
      if (isNavigating || navigationAttempted.current) {
        console.log("Already navigating or attempted, skipping");
        return false;
      }

      try {
        // Validate session exists and has required properties
        if (!session) {
          console.log("No session provided");
          return false;
        }

        // Validate user exists
        if (!session.user) {
          console.log("No user in session");
          return false;
        }

        // Validate session is not expired
        if (
          session.expires_at &&
          new Date(session.expires_at * 1000) < new Date()
        ) {
          console.log("Session expired");
          setError("Your session has expired. Please log in again.");
          await clearInvalidSession();
          return false;
        }

        // All validations passed - proceed with navigation
        console.log("Session valid, navigating to dashboard");
        setIsNavigating(true);
        navigationAttempted.current = true;

        // Use window.location for a hard navigation to ensure clean state
        window.location.href = "/dashboard/landlord";
        return true;
      } catch (err) {
        console.error("Validation error:", err);
        setError("Authentication validation failed. Please try again.");
        setIsNavigating(false);
        navigationAttempted.current = false;
        return false;
      }
    },
    [isNavigating, clearInvalidSession],
  );

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginLandLordSchema),
    defaultValues: {
      email: "",
      password: "",
    },
    mode: "onSubmit",
  });

  useEffect(() => {
    // If already navigating or navigation attempted, don't do anything
    if (isNavigating || navigationAttempted.current) {
      return;
    }

    let mounted = true;

    const checkUser = async () => {
      if (!mounted) return;

      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        // Handle refresh token errors
        if (error) {
          if (
            error.message.includes("Invalid Refresh Token") ||
            error.message.includes("Refresh Token Not Found")
          ) {
            // Clear the invalid session and tokens
            await clearInvalidSession();
            setError("Your session has expired. Please log in again.");
            return;
          }
          // Don't show error for other cases, just log
          console.log("Session check error:", error);
          return;
        }

        // Only navigate if session is valid and component is still mounted
        if (session && mounted && !navigationAttempted.current) {
          await validateAndNavigate(session);
        }
      } catch (error) {
        // Handle any other authentication errors
        console.error("Session check failed:", error);
      }
    };

    // Only check user once on mount
    checkUser();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      // Only handle SIGNED_IN event to avoid multiple redirects
      if (event === "SIGNED_IN" && session && !navigationAttempted.current) {
        await validateAndNavigate(session);
      }

      if (event === "SIGNED_OUT") {
        setIsNavigating(false);
        navigationAttempted.current = false;
        setError(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []); // Empty dependency array - only run once on mount

  const onSubmit = async (data: LoginFormData) => {
    if (isNavigating) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Proceed with login without clearing session first
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) {
        if (error.message === "Invalid login credentials") {
          setError("Invalid email or password. Please try again.");
        } else if (error.message.includes("Invalid Refresh Token")) {
          setError("Please try logging in again.");
          await clearInvalidSession();
        } else {
          setError(error.message);
        }
        return;
      }

      // Validate the new session before navigating
      if (authData.session) {
        // Small delay to ensure cookies are set properly
        await new Promise((resolve) => setTimeout(resolve, 100));
        await validateAndNavigate(authData.session);
      } else {
        setError("Login failed. No session data received.");
      }
    } catch (error) {
      await clearInvalidSession();
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = form.handleSubmit(onSubmit);

  if (isNavigating) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-sm md:text-base">
            Redirecting to your dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-muted/30 flex items-center justify-center px-4 py-8">
      <div className="absolute top-4 right-4 z-10">
        <ModeToggle />
      </div>

      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-2 text-center pb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/")}
            className="w-fit -ml-2 mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex justify-center mb-2">
            <div className="rounded-full bg-primary/10 p-2">
              <Building className="h-6 w-6 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Landlord Login</CardTitle>
          <p className="text-sm text-muted-foreground">
            Manage your properties and tenant relationships
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive" className="mb-4 py-2">
              <AlertDescription className="text-sm">{error}</AlertDescription>
            </Alert>
          )}

          <Form {...form}>
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2 text-sm">
                      <Mail className="h-3.5 w-3.5" />
                      Email Address
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="juandelacruz@gmail.com"
                        className="h-10"
                        disabled={isLoading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2 text-sm">
                      <Lock className="h-3.5 w-3.5" />
                      Password
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        className="h-10"
                        disabled={isLoading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="remember"
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <label
                    htmlFor="remember"
                    className="text-xs text-muted-foreground"
                  >
                    Remember me
                  </label>
                </div>
                <Link
                  href="/auth/forgot-password"
                  className="text-xs text-primary hover:underline"
                >
                  Forgot password?
                </Link>
              </div>

              <Button
                type="submit"
                className="w-full h-10 mt-2"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </span>
                ) : (
                  "Sign In"
                )}
              </Button>

              <div className="text-center text-sm pt-2">
                <span className="text-muted-foreground">New to Unitko? </span>
                <Link
                  href="/auth/landlord/register"
                  className="text-primary hover:underline"
                >
                  Create an account
                </Link>
              </div>
            </form>
          </Form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-muted"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              type="button"
              className="h-9 text-xs"
              disabled={isLoading}
            >
              Google
            </Button>
            <Button
              variant="outline"
              type="button"
              className="h-9 text-xs"
              disabled={isLoading}
            >
              Facebook
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
