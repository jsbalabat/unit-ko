"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Pencil } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/form";

import { updateTenant } from "@/services/tenantService";
import type { TenantListItem } from "@unitko/shared";

const schema = z.object({
  tenantName: z.string().trim().min(1, "Name is required").max(120),
  contactNumber: z
    .string()
    .trim()
    .min(7, "Contact number is too short")
    .max(40),
  tenantEmail: z
    .string()
    .trim()
    .email("Invalid email")
    .max(200)
    .optional()
    .or(z.literal("")),
});

type FormValues = z.infer<typeof schema>;

interface EditTenantPopupProps {
  // The parent remounts this component per tenant (keyed by id), so
  // `defaultValues` always seed from the current row — no stale prefill.
  tenant: TenantListItem;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (tenant: TenantListItem) => void;
}

export function EditTenantPopup({
  tenant,
  isOpen,
  onClose,
  onSaved,
}: EditTenantPopupProps) {
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      tenantName: tenant.tenantName,
      contactNumber: tenant.contactNumber,
      tenantEmail: tenant.email ?? "",
    },
    mode: "onSubmit",
  });

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    const result = await updateTenant(tenant.id, {
      tenantName: values.tenantName,
      contactNumber: values.contactNumber,
      tenantEmail: values.tenantEmail || null,
    });
    setSubmitting(false);

    if (!result.success || !result.tenant) {
      toast.error("Failed to update tenant", {
        description: result.error ?? "Please try again.",
      });
      return;
    }

    toast.success(`Tenant updated: ${result.tenant.tenantName}`);
    onSaved(result.tenant);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? handleClose() : null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" />
            Edit Tenant
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="tenantName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Name <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Juan Dela Cruz"
                      autoComplete="off"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contactNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Contact Number <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="09171234567 or +639171234567"
                      inputMode="tel"
                      autoComplete="off"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tenantEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email (optional)</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="tenant@example.com"
                      autoComplete="off"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <p className="text-xs text-muted-foreground">
              {tenant.propertyName
                ? `Assigned to ${tenant.propertyName}.`
                : "Not assigned to a property."}{" "}
              Property assignment is managed from the property.
            </p>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Pencil className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
