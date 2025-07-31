"use client";

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
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const registerLandlordSchema = z
  .object({
    email: z.string().email("Invalid email"),
    password: z.string().min(6, {
      message: "Password must be at least 6 characters long",
    }),
    confirmPassword: z.string().min(6, {
      message: "Password confirmation is required",
    }),
    username: z.string().min(3, {
      message: "Username must be at least 3 characters long",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type RegisterFormData = z.infer<typeof registerLandlordSchema>;

export default function LandlordRegister() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const form = useForm<RegisterFormData>({
    resolver: zodResolver(registerLandlordSchema),
    defaultValues: {
      email: "",
      username: "",
      password: "",
      confirmPassword: "",
    },
    mode: "onSubmit",
  });

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      // Step 1: Create user account (profile automatically created by trigger)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      if (authData.user) {
        // Step 2: Update the profile with username and ensure role is landlord
        // The basic profile is already created by the database trigger
        const { error: updateError } = await supabase
          .from("profiles")
          .update({
            username: data.username,
            role: "landlord", // Ensure role is set correctly
          })
          .eq("id", authData.user.id);

        if (updateError) {
          console.error("Profile update error:", updateError);
          setError(`Failed to update profile: ${updateError.message}`);
          return;
        }

        setShowConfirmDialog(true);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      setError(errorMessage);
      console.error("Registration error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmProceed = () => {
    setShowConfirmDialog(false);
    // Redirect to packages page
    router.push("/packages");
  };

  const handleConfirmCancel = () => {
    setShowConfirmDialog(false);
    // Redirect to login page
    router.push("/auth/landlord/login");
  };

  const handleFormSubmit = form.handleSubmit(onSubmit, (errors) => {
    console.log("Form validation errors:", errors);
  });

  return (
    <>
      <div className="relative min-h-screen">
        {/* ModeToggle positioned at top right */}
        <div className="absolute top-4 right-4 z-10">
          <ModeToggle />
        </div>

        {/* Registration Form */}
        <main className="flex flex-col items-center justify-center min-h-screen gap-6 px-4">
          <h1 className="text-2xl font-bold">Landlord Registration</h1>

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
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="JuanDelaCruz"
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
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <Input type="password" disabled={isLoading} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" size="fullsubmit" disabled={isLoading}>
                {isLoading ? "Creating Account..." : "Register"}
              </Button>

              <Link
                href="/auth/landlord/login"
                className="text-gray-400 hover:underline hover:text-gray-200 transition-colors"
              >
                <div>Already signed up? Log in here!</div>
              </Link>
            </form>
          </Form>
        </main>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Registration Successful!</AlertDialogTitle>
            <AlertDialogDescription>
              Your landlord account has been created successfully. You can now
              choose a subscription package to get started, or proceed directly
              to login.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleConfirmCancel}>
              Go to Login
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmProceed}>
              Choose Package
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
