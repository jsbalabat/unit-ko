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
// import { useRouter } from "next/navigation";

const formSchema = z.object({
  email: z
    .string()
    .min(1, {
      message: "Email must not be empty",
    })
    .max(50, {
      message: "Password must be at most 50 characters long",
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
    // Login - Landlord

    <main className="flex flex-col items-center justify-center min-h-screen gap-6 px-4">
      <h1 className="text-2xl font-bold">Tenant Login</h1>
      <Form {...form}>
        <form onSubmit={handleFormSubmit} className="space-y-4 w-1/2 max-w-md">
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
                  <Input type="password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" size={"fullsubmit"}>
            Submit
          </Button>
          <p>New to Unitko? Sign up here!</p>
        </form>
      </Form>
    </main>
  );
}
