import type { BillingPeriodDraft, PropertyFormData } from "./form-types";

export type ScheduleResult =
  | { ok: true; periods: BillingPeriodDraft[] }
  | { ok: false; reason: string };

const DAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

// Local-date formatting on purpose: toISOString() would shift the day for any
// timezone east of UTC (this app runs in PH, UTC+8) and bill a day early.
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function nextDayOfWeek(fromDate: Date, dayName: string): Date {
  const targetDay = DAY_NAMES.indexOf(dayName.toLowerCase());
  const daysUntilTarget = (targetDay - fromDate.getDay() + 7) % 7;
  const next = new Date(fromDate);
  // Landing on fromDate itself means the first collection is a week out.
  next.setDate(fromDate.getDate() + (daysUntilTarget === 0 ? 7 : daysUntilTarget));
  return next;
}

function lastDayOf(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Builds the draft billing schedule for the add-property wizard.
 *
 * `rentDue` is **per tenant**, not the property total: create_property_atomic
 * opens one lease per tenant and writes this amount into each lease's invoice,
 * so a total here would bill every tenant the whole property's rent.
 *
 * `today` is injected to keep the Overdue/Not Yet Due split deterministic.
 */
export function buildBillingSchedule(
  formData: PropertyFormData,
  today: Date,
): ScheduleResult {
  if (!formData.rentStartDate) {
    return { ok: false, reason: "Please select a rent start date first" };
  }

  const perTenantRent =
    formData.rentPerCollection > 0
      ? formData.rentPerCollection
      : formData.rentAmount;

  if (!perTenantRent || perTenantRent <= 0) {
    return { ok: false, reason: "Please enter a valid rent amount" };
  }

  // Parse as a local date; new Date("2026-01-01") would be parsed as UTC.
  const [startYear = 0, startMonth = 0, startDay = 1] = formData.rentStartDate
    .split("-")
    .map(Number);
  const startDate = new Date(startYear, startMonth - 1, startDay);

  const midnight = new Date(today);
  midnight.setHours(0, 0, 0, 0);

  const periods: BillingPeriodDraft[] = [];
  const addPeriod = (dueDate: Date) => {
    periods.push({
      dueDate: formatLocalDate(dueDate),
      rentDue: perTenantRent,
      otherCharges: 0,
      grossDue: perTenantRent,
      status: dueDate < midnight ? "Overdue" : "Not Yet Due",
      expenseItems: [],
    });
  };

  // contractMonths counts payment periods, not months.
  const numberOfPeriods = formData.contractMonths;

  switch (formData.formBasis) {
    case "weekly": {
      let current = nextDayOfWeek(
        new Date(startDate.getTime() - 24 * 60 * 60 * 1000),
        formData.collectionDay,
      );
      if (current.getTime() === startDate.getTime()) {
        current = new Date(current);
        current.setDate(current.getDate() + 7);
      }
      for (let i = 0; i < numberOfPeriods; i++) {
        addPeriod(current);
        current = new Date(current);
        current.setDate(current.getDate() + 7);
      }
      break;
    }

    case "bi-weekly": {
      if (!formData.collectionDates || formData.collectionDates.length !== 2) {
        return {
          ok: false,
          reason: "Please select two collection dates for bi-weekly billing",
        };
      }

      // Copy before sorting — sorting in place would mutate form state.
      const [date1 = 1, date2 = 1] = [...formData.collectionDates].sort(
        (a, b) => a - b,
      );
      const cursor = new Date(startDate);
      cursor.setDate(1);

      // Skip any of this month's dates that already sit on or before the start.
      let useFirst = new Date(cursor.getFullYear(), cursor.getMonth(), date1) > startDate;
      let useSecond = new Date(cursor.getFullYear(), cursor.getMonth(), date2) > startDate;
      if (!useFirst && !useSecond) {
        cursor.setMonth(cursor.getMonth() + 1);
        useFirst = true;
        useSecond = true;
      }

      while (periods.length < numberOfPeriods) {
        const year = cursor.getFullYear();
        const month = cursor.getMonth();
        const lastDay = lastDayOf(year, month);

        if (useFirst && periods.length < numberOfPeriods) {
          addPeriod(new Date(year, month, Math.min(date1, lastDay)));
        }
        if (useSecond && periods.length < numberOfPeriods) {
          addPeriod(new Date(year, month, Math.min(date2, lastDay)));
        }

        cursor.setMonth(cursor.getMonth() + 1);
        useFirst = true;
        useSecond = true;
      }
      break;
    }

    case "monthly": {
      if (!formData.collectionDates || formData.collectionDates.length === 0) {
        return {
          ok: false,
          reason: "Please select a collection date for monthly billing",
        };
      }

      const collectionDay = formData.collectionDates[0] ?? 1;

      // A collection day on or before the start belongs to the next month.
      const firstPossible = new Date(startYear, startMonth - 1, collectionDay);
      const monthOffset = firstPossible <= startDate ? 1 : 0;

      for (let i = 0; i < numberOfPeriods; i++) {
        const dueDate = new Date(startYear, startMonth - 1 + monthOffset + i, 1);
        const lastDay = lastDayOf(dueDate.getFullYear(), dueDate.getMonth());
        // Clamp so the 31st doesn't roll into the next month in February.
        dueDate.setDate(Math.min(collectionDay, lastDay));
        addPeriod(dueDate);
      }
      break;
    }

    case "quarterly":
    case "semi-annually":
    case "annually": {
      const stride =
        formData.formBasis === "quarterly"
          ? 3
          : formData.formBasis === "semi-annually"
            ? 6
            : 12;

      // The first invoice falls one full period after the start, never on it.
      const current = new Date(startDate);
      current.setMonth(current.getMonth() + stride);

      for (let i = 0; i < numberOfPeriods; i++) {
        addPeriod(current);
        current.setMonth(current.getMonth() + stride);
      }
      break;
    }

    default:
      return { ok: false, reason: "Invalid billing frequency selected" };
  }

  periods.sort(
    (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
  );

  return { ok: true, periods };
}
