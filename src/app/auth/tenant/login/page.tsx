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
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, Mail, User } from "lucide-react";
// import { useRouter } from "next/navigation";

const formSchema = z.object({
  email: z
    .string()
    .min(1, {
      message: "Email must not be empty",
    })
    .email({
      message: "Please enter a valid email address",
    })
    .max(50, {
      message: "Email must be at most 50 characters long",
    }),
  password: z
    .string()
    .min(1, {
      message: "Password must be at least 5 characters long",
    })
    .max(100, {
      message: "Password must be at most 100 characters long",
    }),
});

export default function TenantLogin() {
  // const router = useRouter();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = () => {
    // (data: LoginFormData)
    // add more code here for the login later
    // router.push("/dashboard/tenant");
  };

  const handleFormSubmit = form.handleSubmit(onSubmit, () => {});

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-8 sm:px-6 md:py-12">
      <Card className="w-full max-w-[400px] shadow-lg">
        <CardHeader className="space-y-1 pb-4">
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
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center justify-between">
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

              <Button type="submit" className="w-full">
                Sign In
              </Button>

              <div className="text-center text-sm">
                <span className="text-muted-foreground">New to Unitko? </span>
                <Link
                  href="/auth/tenant/register"
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
            <Button variant="outline" type="button" className="h-9 text-xs">
              Google
            </Button>
            <Button variant="outline" type="button" className="h-9 text-xs">
              Facebook
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
