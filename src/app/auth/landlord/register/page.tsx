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
import { ArrowLeft } from "lucide-react";
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
    phone: z
      .string()
      .optional()
      .refine(
        (val) =>
          !val ||
          /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/.test(
            val
          ),
        {
          message: "Invalid phone number format",
        }
      ),
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
      phone: "",
    },
    mode: "onSubmit",
  });

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      // Check if user already exists
      const { data: existingUser } = await supabase
        .from("profiles")
        .select("email")
        .eq("email", data.email)
        .maybeSingle();

      // Only show error if email exists, ignore "not found" errors
      if (existingUser) {
        setError(
          "This email is already registered. Please use a different email or login."
        );
        return;
      }

      // Step 1: Create user account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            username: data.username,
            role: "landlord",
          },
        },
      });

      if (authError) {
        console.error("Auth error:", authError);

        // Provide user-friendly error messages
        if (
          authError.message.includes("already registered") ||
          authError.message.includes("invalid")
        ) {
          setError(
            "This email is already registered. Please use a different email or try logging in."
          );
        } else if (authError.message.includes("weak")) {
          setError("Password is too weak. Please use a stronger password.");
        } else {
          setError(`Registration failed: ${authError.message}`);
        }
        return;
      }

      if (!authData.user) {
        setError("Registration failed. No user data received.");
        return;
      }

      // Step 2: Wait for trigger to create profile, then update it with user details
      // The database trigger automatically creates a profile when a user is created
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Update the profile with full_name and phone
      // The trigger already set id, email, and role
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          full_name: data.username,
          phone: data.phone || null,
        })
        .eq("id", authData.user.id);

      if (updateError) {
        console.error("Profile update error:", updateError);
        setError(`Failed to update profile: ${updateError.message}`);
        return;
      }

      setShowConfirmDialog(true);
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
          <div className="w-1/2 max-w-md">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/auth/landlord/login")}
              className="w-fit -ml-2 mb-2"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </div>
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
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="tel"
                        placeholder="+63 912 345 6789"
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
