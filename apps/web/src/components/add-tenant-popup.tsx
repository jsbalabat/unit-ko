"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, UserPlus } from "lucide-react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { createTenant } from "@/services/tenantService";

const UNASSIGNED_VALUE = "__unassigned__";

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
  propertyId: z.string(),
});

type FormValues = z.infer<typeof schema>;

export interface AddTenantPropertyOption {
  id: string;
  unit_name: string;
  max_tenants: number;
  active_tenant_count: number;
}

interface AddTenantPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (tenantId: string) => void;
  /** All landlord properties — eligibility is filtered inside this component. */
  properties?: AddTenantPropertyOption[];
}

export function AddTenantPopup({
  isOpen,
  onClose,
  onCreated,
  properties = [],
}: AddTenantPopupProps) {
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      tenantName: "",
      contactNumber: "",
      tenantEmail: "",
      propertyId: UNASSIGNED_VALUE,
    },
    mode: "onSubmit",
  });

  const handleClose = () => {
    if (submitting) return;
    form.reset();
    onClose();
  };

  const onSubmit = async (values: FormValues) => {
    const propertyId =
      values.propertyId === UNASSIGNED_VALUE ? null : values.propertyId;

    setSubmitting(true);
    const result = await createTenant({
      tenantName: values.tenantName,
      contactNumber: values.contactNumber,
      tenantEmail: values.tenantEmail || undefined,
      propertyId,
    });
    setSubmitting(false);

    if (!result.success || !result.tenant) {
      toast.error("Failed to add tenant", {
        description: result.error ?? "Please try again.",
      });
      return;
    }

    const assignedProperty = propertyId
      ? properties.find((p) => p.id === propertyId)
      : null;

    toast.success(`Tenant added: ${result.tenant.tenantName}`, {
      description: assignedProperty
        ? `Assigned to ${assignedProperty.unit_name}.`
        : "Unhoused — assign to a property when ready.",
    });

    form.reset();
    onCreated?.(result.tenant.id);
    onClose();
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => (!open ? handleClose() : null)}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Add Tenant
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

            <FormField
              control={form.control}
              name="propertyId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assign to property (optional)</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={submitting}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={UNASSIGNED_VALUE}>
                        Not assigned (unassigned)
                      </SelectItem>
                      {properties.length === 0 ? (
                        <div className="px-2 py-1.5 text-xs text-muted-foreground">
                          You don&apos;t have any properties yet.
                        </div>
                      ) : (
                        properties.map((p) => {
                          const cap = p.max_tenants ?? 1;
                          const over = p.active_tenant_count >= cap;
                          return (
                            <SelectItem key={p.id} value={p.id}>
                              {p.unit_name}
                              <span
                                className={`ml-2 text-xs ${
                                  over
                                    ? "text-amber-600 dark:text-amber-400"
                                    : "text-muted-foreground"
                                }`}
                              >
                                ({p.active_tenant_count}/{cap}
                                {over ? " — over capacity" : " filled"})
                              </span>
                            </SelectItem>
                          );
                        })
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                    Adding...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add Tenant
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

