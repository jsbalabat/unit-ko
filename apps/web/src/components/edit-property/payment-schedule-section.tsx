"use client";

import { User, Calendar, Plus, Minus } from "lucide-react";
import { Button } from "@/components/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  WEEK_DAYS,
  parseBiWeeklyDueDay,
  type BillingFrequency,
  type PropertyFormData,
} from "./types";

interface PaymentScheduleSectionProps {
  formData: PropertyFormData;
  isLocked: boolean;
  onChange: (
    field: keyof PropertyFormData,
    value: string | number | Date | BillingFrequency,
  ) => void;
  onPaxNumberChange: (newPax: number) => void;
  onAddPerson: () => void;
  onRemovePerson: (index: number) => void;
}

export function PaymentScheduleSection({
  formData,
  isLocked,
  onChange,
  onPaxNumberChange,
  onAddPerson,
  onRemovePerson,
}: PaymentScheduleSectionProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label htmlFor="pax" className="flex items-center gap-1.5">
          <User className="h-3.5 w-3.5" />
          Number of Pax (Bed Space)
        </Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => {
              if (formData.pax > 1) {
                onRemovePerson(formData.pax - 1);
              }
            }}
            disabled={isLocked || formData.pax <= 1}
            className={isLocked ? "opacity-70" : ""}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <Input
            id="pax"
            type="number"
            min="1"
            max="20"
            value={formData.pax ?? 1}
            onChange={(e) => {
              const value = e.target.value.replace(/^0+(?=\d)/, "");
              const newPax = parseInt(value) || 1;
              onPaxNumberChange(newPax);
            }}
            disabled={isLocked}
            placeholder="1"
            className={`flex-1 ${isLocked ? "opacity-70" : ""}`}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onAddPerson}
            disabled={isLocked || formData.pax >= 20}
            className={isLocked ? "opacity-70" : ""}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Number of persons sharing this unit
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="contractMonths">
          Contract Duration (Period)
        </Label>
        <Input
          id="contractMonths"
          type="number"
          min="1"
          value={formData.contractMonths ?? ""}
          onChange={(e) => {
            const value = e.target.value.replace(/^0+(?=\d)/, "");
            onChange("contractMonths", parseInt(value) || 0);
          }}
          placeholder="e.g., 12"
          disabled={isLocked}
          className={isLocked ? "opacity-70" : ""}
        />
        <p className="text-xs text-muted-foreground">
          Number of billing periods in the contract.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="rentStartDate"> Rent Agreement Date</Label>
        <Input
          id="rentStartDate"
          type="date"
          value={formData.rentStartDate ?? ""}
          onChange={(e) => onChange("rentStartDate", e.target.value)}
          placeholder="Select start date"
          disabled={isLocked}
          className={isLocked ? "opacity-70" : ""}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="formBasis">Frequency Basis</Label>
        <Select
          value={formData.formBasis}
          onValueChange={(value) =>
            onChange("formBasis", value as BillingFrequency)
          }
          disabled={isLocked}
        >
          <SelectTrigger
            id="formBasis"
            className={isLocked ? "opacity-70" : ""}
          >
            <SelectValue placeholder="Select frequency" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="bi-weekly">Bi-weekly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="quarterly">Quarterly</SelectItem>
            <SelectItem value="semi-annually">Semi-annually</SelectItem>
            <SelectItem value="annually">Annually</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="rentPerPerson">
          Rent per Individual Tenant (per period)
        </Label>
        <div className="relative">
          <span className="absolute left-3 top-2.5">₱</span>
          <Input
            id="rentPerPerson"
            type="number"
            className={`pl-7 ${isLocked ? "opacity-70" : ""}`}
            value={formData.rentPerPerson ?? ""}
            onChange={(e) => {
              const value = e.target.value.replace(/^0+(?=\d)/, "");
              onChange("rentPerPerson", parseFloat(value) || 0);
            }}
            placeholder="Enter per-tenant amount"
            disabled={isLocked}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Total rent updates automatically based on number of tenants.
        </p>
      </div>

      <div className="space-y-2 md:col-span-2">
        <Label
          htmlFor="dueDay"
          className="text-sm font-medium flex items-center gap-1.5"
        >
          <Calendar className="h-3.5 w-3.5 text-purple-600" />
          Payment Due Marker Per Billing Period
        </Label>

        {formData.formBasis === "weekly" ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {WEEK_DAYS.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => onChange("dueDay", day)}
                  disabled={isLocked}
                  className={`h-9 px-2 text-xs font-medium rounded-md border transition-all ${
                    formData.dueDay === day
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-background border-input hover:bg-muted"
                  } ${isLocked ? "opacity-70" : ""}`}
                >
                  {day.charAt(0).toUpperCase() + day.slice(1, 3)}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Select collection day of the week.
            </p>
          </>
        ) : formData.formBasis === "bi-weekly" ? (
          (() => {
            const { firstDay, secondDay } = parseBiWeeklyDueDay(formData.dueDay);

            return (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">
                    Date 1 (1-15) {firstDay ? `[${firstDay}]` : "[None]"}
                  </div>
                  <div className="grid grid-cols-8 sm:grid-cols-10 lg:grid-cols-15 gap-x-1 gap-y-2 pr-12 sm:pr-16 lg:pr-24">
                    {Array.from({ length: 15 }, (_, i) => i + 1).map((date) => {
                      const isSelected = firstDay === date;
                      return (
                        <button
                          key={`bi-weekly-first-${date}`}
                          type="button"
                          onClick={() =>
                            onChange("dueDay", `${date},${secondDay || 16}`)
                          }
                          disabled={isLocked}
                          className={`h-8 w-8 min-w-[32px] min-h-[32px] flex items-center justify-center p-0 text-xs font-medium rounded border transition-all ${
                            isSelected
                              ? "bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-300"
                              : "bg-background border-input hover:bg-muted"
                          } ${isLocked ? "opacity-70" : ""}`}
                        >
                          {date}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">
                    Date 2 (16-31) {secondDay ? `[${secondDay}]` : "[None]"}
                  </div>
                  <div className="grid grid-cols-8 sm:grid-cols-10 lg:grid-cols-16 gap-x-1 gap-y-2 pr-12 sm:pr-16 lg:pr-24">
                    {Array.from({ length: 16 }, (_, i) => i + 16).map((date) => {
                      const isSelected = secondDay === date;
                      return (
                        <button
                          key={`bi-weekly-second-${date}`}
                          type="button"
                          onClick={() =>
                            onChange("dueDay", `${firstDay || 1},${date}`)
                          }
                          disabled={isLocked}
                          className={`h-8 w-8 min-w-[32px] min-h-[32px] flex items-center justify-center p-0 text-xs font-medium rounded border transition-all ${
                            isSelected
                              ? "bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-300"
                              : "bg-background border-input hover:bg-muted"
                          } ${isLocked ? "opacity-70" : ""}`}
                        >
                          {date}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  Selected: Date 1 = {firstDay || "None"}, Date 2 ={" "}
                  {secondDay || "None"}.
                </p>
              </div>
            );
          })()
        ) : (
          <>
            <div className="grid grid-cols-10 sm:grid-cols-15 lg:grid-cols-16 gap-x-1 gap-y-2 pr-12 sm:pr-16 lg:pr-24">
              {Array.from({ length: 31 }, (_, i) => i + 1).map((date) => {
                const isSelected = formData.dueDay === String(date);
                return (
                  <button
                    key={date}
                    type="button"
                    onClick={() => onChange("dueDay", String(date))}
                    disabled={isLocked}
                    className={`h-8 w-8 min-w-[32px] min-h-[32px] flex items-center justify-center p-0 text-xs font-medium rounded border transition-all ${
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-background border-input hover:bg-muted"
                    } ${isLocked ? "opacity-70" : ""}`}
                  >
                    {date}
                  </button>
                );
              })}
            </div>

            <p className="text-xs text-muted-foreground">
              Selected:{" "}
              {formData.dueDay === "last"
                ? "Last Day"
                : `Day ${formData.dueDay || "None"}`}{" "}
              • Date adjusts to last day for shorter months.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
