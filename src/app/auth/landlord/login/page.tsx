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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p>Validating credentials...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      <div className="absolute top-4 right-4 z-10">
        <ModeToggle />
      </div>

      <main className="flex flex-col items-center justify-center min-h-screen gap-6 px-4">
        <h1 className="text-2xl font-bold">Landlord Login</h1>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded w-1/2 max-w-md">
            {error}
          </div>
        )}

        <Form {...form}>
          <form
            onSubmit={handleFormSubmit}
            className="space-y-4 w-1/2 max-w-md"
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="juandelacruz@gmail.com"
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
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" disabled={isLoading} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" size="fullsubmit" disabled={isLoading}>
              {isLoading ? "Signing in..." : "Submit"}
            </Button>

            <Link href="/auth/landlord/register">
              <div className="text-center text-gray-400 hover:underline">
                New to Unitko? Sign up here!
              </div>
            </Link>
          </form>
        </Form>
      </main>
    </div>
  );
}
