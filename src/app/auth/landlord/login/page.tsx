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
import { Building, Mail, Lock, Loader2 } from "lucide-react";
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
        return false;
      }

      try {
        // Validate session exists and has required properties
        if (!session) {
          return false;
        }

        // Validate user exists
        if (!session.user) {
          return false;
        }

        // Validate session is not expired
        if (
          session.expires_at &&
          new Date(session.expires_at * 1000) < new Date()
        ) {
          setError("Your session has expired. Please log in again.");
          await clearInvalidSession();
          return false;
        }

        // All validations passed - proceed with navigation
        setIsNavigating(true);
        navigationAttempted.current = true;
        router.push("/dashboard/landlord");
        return true;
      } catch {
        setError("Authentication validation failed. Please try again.");
        await clearInvalidSession();
        return false;
      }
    },
    [router, isNavigating, clearInvalidSession]
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
    if (isNavigating || navigationAttempted.current) {
      return;
    }

    const checkUser = async () => {
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
          setError("Failed to check authentication status.");
          return;
        }

        // Only navigate if session is valid
        if (session) {
          await validateAndNavigate(session);
        }
      } catch {
        // Handle any other authentication errors
        await clearInvalidSession();
        setError("Authentication check failed. Please try logging in again.");
      }
    };

    checkUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session) {
        await validateAndNavigate(session);
      }

      if (event === "SIGNED_OUT") {
        setIsNavigating(false);
        navigationAttempted.current = false;
        setError(null);
      }

      if (event === "TOKEN_REFRESHED" && session) {
        await validateAndNavigate(session);
      }

      // Handle token refresh errors
      if (event === "TOKEN_REFRESHED" && !session) {
        await clearInvalidSession();
        setError("Session expired. Please log in again.");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [validateAndNavigate, isNavigating, clearInvalidSession]);

  const onSubmit = async (data: LoginFormData) => {
    if (isNavigating) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Clear any existing invalid session first
      await clearInvalidSession();

      // Proceed with fresh login
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
