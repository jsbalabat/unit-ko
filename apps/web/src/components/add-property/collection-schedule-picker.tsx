"use client";

import { Calendar } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { PropertyFormData } from "@/components/add-property/form-types";

interface CollectionSchedulePickerProps {
  formData: PropertyFormData;
  updateFormData: (field: keyof PropertyFormData, value: unknown) => void;
}

const DAYS_OF_WEEK = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

// Bi-weekly always writes both dates at once, so picking one slot needs a value
// for the other. These match what usePropertyForm seeds on switching to
// bi-weekly; they only apply if that seed is ever bypassed.
const DEFAULT_FIRST_DATE = 1;
const DEFAULT_SECOND_DATE = 16;

const DATE_GRID = "grid grid-cols-10 sm:grid-cols-15 lg:grid-cols-16 gap-x-1 gap-y-2 pr-12 sm:pr-16 lg:pr-24";
const DATE_BUTTON =
  "h-8 w-8 min-w-[32px] min-h-[32px] flex items-center justify-center p-0 text-xs font-medium rounded border transition-all";

/**
 * Picks *when* rent is collected, which differs in shape per frequency: a
 * weekday for weekly, two month days for bi-weekly, one for monthly. Quarterly
 * and longer derive their dates from the start date, so they only explain
 * themselves rather than offering a control.
 */
export function CollectionSchedulePicker({
  formData,
  updateFormData,
}: CollectionSchedulePickerProps) {
  if (formData.formBasis === "weekly") {
    return (
      <div className="space-y-2 md:col-span-2">
        <Label className="text-sm font-medium flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          Collection Day *
        </Label>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {DAYS_OF_WEEK.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => updateFormData("collectionDay", day)}
              className={cn(
                "h-9 px-2 text-xs font-medium rounded-md border transition-all",
                formData.collectionDay === day
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-background border-input hover:bg-muted",
              )}
            >
              {day.charAt(0).toUpperCase() + day.slice(1, 3)}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Which day of the week to collect rent
        </p>
      </div>
    );
  }

  if (formData.formBasis === "bi-weekly") {
    return (
      <div className="space-y-4 md:col-span-2">
        <Label className="text-sm font-medium flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          Collection Dates (Select 2 dates per month) *
        </Label>

        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">
            Day 1 (1-15){" "}
            {formData.collectionDates[0]
              ? `[${formData.collectionDates[0]}]`
              : "[None]"}
          </div>
          <div className={DATE_GRID}>
            {Array.from({ length: 15 }, (_, i) => i + 1).map((date) => (
              <button
                key={date}
                type="button"
                onClick={() =>
                  updateFormData("collectionDates", [
                    date,
                    formData.collectionDates[1] ?? DEFAULT_SECOND_DATE,
                  ])
                }
                className={cn(
                  DATE_BUTTON,
                  formData.collectionDates[0] === date
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-300"
                    : "bg-background border-input hover:bg-muted",
                )}
              >
                {date}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">
            Day 2 (16-31){" "}
            {formData.collectionDates[1]
              ? `[${formData.collectionDates[1]}]`
              : "[None]"}
          </div>
          <div className={DATE_GRID}>
            {Array.from({ length: 16 }, (_, i) => i + 16).map((date) => (
              <button
                key={date}
                type="button"
                onClick={() =>
                  updateFormData("collectionDates", [
                    formData.collectionDates[0] ?? DEFAULT_FIRST_DATE,
                    date,
                  ])
                }
                className={cn(
                  DATE_BUTTON,
                  formData.collectionDates[1] === date
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-300"
                    : "bg-background border-input hover:bg-muted",
                )}
              >
                {date}
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Selected: Day 1 = {formData.collectionDates[0] || "None"}, Day 2 ={" "}
          {formData.collectionDates[1] || "None"} • Dates adjust to last day for
          shorter months
        </p>
      </div>
    );
  }

  if (formData.formBasis === "monthly") {
    return (
      <div className="space-y-2 md:col-span-2">
        <Label className="text-sm font-medium flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          Collection Date (Day of Month) *
        </Label>
        <div className={DATE_GRID}>
          {Array.from({ length: 31 }, (_, i) => i + 1).map((date) => (
            <button
              key={date}
              type="button"
              onClick={() => updateFormData("collectionDates", [date])}
              className={cn(
                DATE_BUTTON,
                formData.collectionDates[0] === date
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-background border-input hover:bg-muted",
              )}
            >
              {date}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Selected: Day {formData.collectionDates[0] || "None"} • Date adjusts to
          last day for shorter months
        </p>
      </div>
    );
  }

  if (
    ["quarterly", "semi-annually", "annually"].includes(formData.formBasis)
  ) {
    return (
      <div className="space-y-2 md:col-span-2">
        <div className="rounded-lg border bg-muted/40 p-3">
          <p className="text-sm text-foreground">
            Collection date follows the start rent date
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formData.formBasis === "quarterly" &&
              "Every 3 months from the start date"}
            {formData.formBasis === "semi-annually" &&
              "Every 6 months from the start date"}
            {formData.formBasis === "annually" &&
              "Every 12 months from the start date"}
          </p>
        </div>
      </div>
    );
  }

  return null;
}
