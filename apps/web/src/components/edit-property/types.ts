// Form types and interfaces for Edit Property
export interface PersonDetail {
  name: string;
  email: string;
  phone: string;
}

// Per-occupant tenant linkage so the save path can map paxDetails entries back
// to specific tenants rows. tenantIds[i] is the tenant.id for paxDetails[i],
// or undefined if that occupant was added in this dialog session.
export interface OccupantLinkage {
  tenantIds: (string | undefined)[];
  removedTenantIds: string[];
}

export type BillingFrequency =
  | "weekly"
  | "bi-weekly"
  | "monthly"
  | "quarterly"
  | "semi-annually"
  | "annually";

// Form data interface
export interface PropertyFormData {
  id: string;
  unitName: string;
  propertyType: string;
  propertyLocation: string;
  // Read-only. Seeded from detail.occupancyStatus, which the server derives from
  // an active lease (v_property_occupancy) — the update contract has no such
  // field, so nothing here can change it. Gates display only; don't add a setter.
  occupancyStatus: "occupied" | "vacant";
  rentAmount: number;
  maxTenants: number;
  tenantId?: string;
  tenantName: string;
  contactNumber: string;
  pax: number;
  paxDetails: PersonDetail[];
  contractMonths: number;
  rentStartDate: string;
  formBasis: BillingFrequency;
  rentPerPerson: number;
  dueDay: string;
  billingSchedule: Array<{
    id: string;
    dueDate: string;
    rentDue: number;
    otherCharges: number;
    grossDue: number;
    status: string;
    paidAmount?: number;
  }>;
}

export interface EditPropertyPopupProps {
  propertyId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onSwitchToBilling?: () => void;
}

export const WEEK_DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export type WeekDay = (typeof WEEK_DAYS)[number];

export const isWeekDayValue = (value: string): value is WeekDay => {
  return WEEK_DAYS.includes(value as WeekDay);
};

export const parseBiWeeklyDueDay = (value: string) => {
  const [firstRaw = "1", secondRaw = "16"] = value.split(",");
  const firstDay = Number.parseInt(firstRaw, 10);
  const secondDay = Number.parseInt(secondRaw, 10);

  return {
    firstDay: Number.isFinite(firstDay) ? firstDay : 1,
    secondDay: Number.isFinite(secondDay) ? secondDay : 16,
  };
};

export const isValidBiWeeklyDueDayPair = (value: string): boolean => {
  const { firstDay, secondDay } = parseBiWeeklyDueDay(value);
  return firstDay >= 1 && firstDay <= 15 && secondDay >= 16 && secondDay <= 31;
};

export const inferBillingFrequency = (
  entries: { dueDate: string | null }[] | undefined,
): BillingFrequency => {
  const times = (entries ?? [])
    .map((e) => (e.dueDate ? new Date(e.dueDate).getTime() : null))
    .filter((t): t is number => t !== null)
    .sort((a, b) => a - b);
  if (times.length < 2) return "monthly";

  const diffDays = Math.round((times[1] - times[0]) / (1000 * 60 * 60 * 24));

  if (diffDays <= 8) return "weekly";
  if (diffDays <= 16) return "bi-weekly";
  if (diffDays <= 45) return "monthly";
  if (diffDays <= 120) return "quarterly";
  if (diffDays <= 220) return "semi-annually";
  return "annually";
};

export const formatDueDate = (date: Date): string => {
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  return `${monthNames[month]} ${day}, ${year}`;
};

export const calculatePeriodDueDate = (
  startDate: Date,
  periodIndex: number,
  formBasis: BillingFrequency,
  dueDay: string,
): Date => {
  const base = new Date(startDate);

  if (formBasis === "weekly") {
    if (isWeekDayValue(dueDay)) {
      const dayMap: Record<WeekDay, number> = {
        monday: 1,
        tuesday: 2,
        wednesday: 3,
        thursday: 4,
        friday: 5,
        saturday: 6,
        sunday: 0,
      };
      const targetDay = dayMap[dueDay];
      const currentDay = base.getDay();
      const offset = (targetDay - currentDay + 7) % 7;
      base.setDate(base.getDate() + offset + periodIndex * 7);
    } else {
      base.setDate(base.getDate() + periodIndex * 7);
    }
    return base;
  }

  if (formBasis === "bi-weekly") {
    const { firstDay, secondDay } = parseBiWeeklyDueDay(dueDay);
    const [date1, date2] = [firstDay, secondDay].sort((a, b) => a - b);
    const currentMonth = new Date(base);
    currentMonth.setDate(1);
    let useFirstDate = true;
    let useSecondDate = true;

    const firstDateInStartMonth = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      date1,
    );
    const secondDateInStartMonth = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      date2,
    );

    useFirstDate = firstDateInStartMonth > base;
    useSecondDate = secondDateInStartMonth > base;

    if (!useFirstDate && !useSecondDate) {
      currentMonth.setMonth(currentMonth.getMonth() + 1);
      useFirstDate = true;
      useSecondDate = true;
    }

    const generatedDates: Date[] = [];

    while (generatedDates.length <= periodIndex) {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      const lastDay = new Date(year, month + 1, 0).getDate();

      if (useFirstDate && generatedDates.length <= periodIndex) {
        generatedDates.push(
          new Date(year, month, Math.min(date1, lastDay)),
        );
      }

      if (useSecondDate && generatedDates.length <= periodIndex) {
        generatedDates.push(
          new Date(year, month, Math.min(date2, lastDay)),
        );
      }

      currentMonth.setMonth(currentMonth.getMonth() + 1);
      useFirstDate = true;
      useSecondDate = true;
    }

    return generatedDates[periodIndex] || base;
  }

  const monthStep =
    formBasis === "quarterly"
      ? 3
      : formBasis === "semi-annually"
        ? 6
        : formBasis === "annually"
          ? 12
          : 1;

  // Reset to the 1st of the month before advancing to avoid overflowing
  // across shorter months (e.g. Jan 31 + 1 month becoming Mar 3 instead of Feb 28).
  base.setDate(1);
  base.setMonth(base.getMonth() + periodIndex * monthStep);
  const month = base.getMonth();

  if (dueDay === "last" || dueDay === "30th/31st - Last Day") {
    base.setMonth(month + 1, 0);
  } else if (dueDay === "1" || dueDay === "1st - First Day") {
    base.setDate(1);
  } else if (dueDay === "15" || dueDay === "15th - Mid Month") {
    base.setDate(15);
  } else {
    const dayNumber = Number.parseInt(dueDay, 10);
    if (Number.isFinite(dayNumber) && dayNumber >= 1 && dayNumber <= 31) {
      const lastDayOfMonth = new Date(
        base.getFullYear(),
        month + 1,
        0,
      ).getDate();
      base.setDate(Math.min(dayNumber, lastDayOfMonth));
    } else {
      base.setMonth(month + 1, 0);
    }
  }

  return base;
};
