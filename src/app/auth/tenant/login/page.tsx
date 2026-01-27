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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Mail, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { authenticateTenant } from "@/services/tenantService";
import { toast } from "sonner";
import { checkTenantAuth } from "@/lib/auth";

const formSchema = z.object({
  identifier: z
    .string()
    .min(1, {
      message: "Contact number or email must not be empty",
    })
    .max(100, {
      message: "Input must be at most 100 characters long",
    }),
});

export default function TenantLogin() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      identifier: "",
    },
  });

  // Check if already authenticated, redirect to dashboard
  useEffect(() => {
    if (checkTenantAuth()) {
      router.replace("/dashboard/tenant");
    }
  }, [router]);

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    setIsLoading(true);

    try {
      const tenantId = await authenticateTenant(data.identifier);

      if (tenantId) {
        // Store tenant ID in sessionStorage for the dashboard
        sessionStorage.setItem("tenantId", tenantId);
        sessionStorage.setItem("tenantIdentifier", data.identifier);

        toast.success("Login successful! Redirecting...");
        router.push("/dashboard/tenant");
      } else {
        toast.error(
          "No tenant account found with this contact number or email address",
        );
      }
    } catch (error) {
      console.error("Login error:", error);
      toast.error("An error occurred during login. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = form.handleSubmit(onSubmit, () => {});

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-8 sm:px-6 md:py-12">
      <Card className="w-full max-w-[400px] shadow-lg">
        <CardHeader className="space-y-1 pb-4">
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
              <User className="h-6 w-6 text-primary" />
            </div>
          </div>
          <CardTitle className="text-center text-2xl">Tenant Login</CardTitle>
          <p className="text-center text-sm text-muted-foreground">
            Enter your credentials to access your account
          </p>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <FormField
                control={form.control}
                name="identifier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2 text-sm">
                      <Mail className="h-3.5 w-3.5" />
                      Contact Number / Email
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="09123456789 or juandelacruz@gmail.com"
                        className="h-10"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Signing In..." : "Sign In"}
              </Button>

              <div className="text-center text-sm text-muted-foreground">
                Enter your contact number or email to access your tenant
                dashboard
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </main>
  );
}
