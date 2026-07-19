"use client";

import { UserPlus, DoorOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PropertyIntent } from "@/components/add-property/form-types";

interface IntentToggleProps {
  value: PropertyIntent;
  error?: string;
  onChange: (intent: Exclude<PropertyIntent, "">) => void;
}

const CHOICES = [
  {
    value: "tenants",
    icon: UserPlus,
    label: "Add tenants now",
    hint: "Set up leases and billing in this flow.",
  },
  {
    value: "vacant",
    icon: DoorOpen,
    label: "Leave vacant for now",
    hint: "List the property and add tenants later.",
  },
] as const;

/**
 * The wizard's branch, asked once and up front. It decides how many steps exist,
 * so it has to be answered before the rest of step 1 is worth filling in — hence
 * the placement above everything else rather than beside the tenant fields.
 */
export function IntentToggle({ value, error, onChange }: IntentToggleProps) {
  return (
    <div className="space-y-2">
      <fieldset>
        <legend className="text-sm font-medium mb-2">
          Is anyone living here yet? *
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CHOICES.map((choice) => {
            const selected = value === choice.value;
            const Icon = choice.icon;

            return (
              <button
                key={choice.value}
                type="button"
                onClick={() => onChange(choice.value)}
                aria-pressed={selected}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                  selected
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-input hover:bg-muted",
                  !selected && error && "border-destructive/50",
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 mt-0.5 shrink-0",
                    selected ? "text-primary" : "text-muted-foreground",
                  )}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">
                    {choice.label}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {choice.hint}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
