import type { BillingEntry as ApiBillingEntry } from "@unitko/shared";

// Define TypeScript interfaces for data structures
export interface BillingEntry {
  id: string;
  property_id: string;
  tenant_id: string;
  lease_id?: string;
  period_id?: string;
  due_date: string;
  rent_due: number;
  other_charges: number; // Keep for data compatibility
  gross_due: number;
  status: string;
  billing_period: number;
  paid_amount?: number;
  // Lease credit auto-applied to this invoice, and the credit-net balance
  // (gross − cash − applied credit). Both server-derived.
  applied_credit: number;
  balance: number;
  created_at: string;
  updated_at: string;
  expense_items?: string; // JSON string of expense items
}

export interface BillingDisplayRow {
  key: string;
  dueDate: string;
  billingPeriod: number;
  rentDue: number;
  otherCharges: number;
  grossDue: number;
  paidAmount: number;
  appliedCredit: number;
  balance: number;
  status: string;
  expenseItems: ExpenseItem[];
  sourceEntryCount: number;
}

export interface ExpenseItem {
  id: string;
  name: string;
  amount: number;
}

export interface Tenant {
  id: string;
  property_id: string;
  tenant_name: string;
  email?: string;
  contact_number: string;
  tenant_slot?: number;
  contract_months: number; // Number of billing periods (weekly, monthly, quarterly, etc.)
  rent_start_date: string;
  due_day: string;
  is_active: boolean;
  advance_payment?: number;
  security_deposit?: number;
  overflow?: number;
  created_at: string;
  updated_at: string;
  billing_entries?: BillingEntry[];
}

export interface Property {
  id: string;
  unit_name: string;
  property_type: string;
  occupancy_status: "occupied" | "vacant";
  property_location: string;
  rent_amount: number;
  max_tenants?: number; // Bed space support
  bed_space_billing_mode?: string; // 'unified' or 'per_tenant'
  amenities?: string; // JSON string array of amenity IDs
  notes?: string; // JSON array of notes
  created_at: string;
  updated_at: string;
  tenants?: Tenant[];
}

export interface PropertyNote {
  id: string;
  text: string;
  createdAt: string;
  updatedAt?: string;
}

export interface PropertyDetailsPopupProps {
  propertyId: string;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (propertyId: string) => void;
  onSuccess?: () => void;
  defaultTab?: string;
}

// Maps an API invoice (derived figures, camelCase) onto the legacy per-tenant
// billing row this component renders. expense_items is the charge list re-encoded
// as JSON so the existing parseExpenseItems path keeps working.
export function toLegacyEntry(inv: ApiBillingEntry, propertyId: string): BillingEntry {
  return {
    id: inv.id,
    property_id: propertyId,
    tenant_id: inv.tenantId ?? "",
    lease_id: inv.leaseId ?? undefined,
    period_id: inv.periodId ?? undefined,
    due_date: inv.dueDate ?? "",
    rent_due: inv.rentDue,
    other_charges: inv.otherCharges,
    gross_due: inv.grossDue,
    status: inv.status,
    billing_period: inv.sequence ?? 0,
    paid_amount: inv.paidAmount,
    applied_credit: inv.appliedCredit,
    balance: inv.balance,
    created_at: "",
    updated_at: "",
    expense_items: JSON.stringify(
      inv.charges.map((c) => ({ name: c.name, amount: c.amount })),
    ),
  };
}

export const parseExpenseItems = (entry: BillingEntry): ExpenseItem[] => {
  const fallbackItems: ExpenseItem[] = [
    {
      id: `default-${entry.id}`,
      name: "Miscellaneous",
      amount: entry.other_charges,
    },
  ];

  if (typeof entry.expense_items !== "string") {
    return fallbackItems;
  }

  const rawExpenseItems = entry.expense_items.trim();
  if (!rawExpenseItems) {
    return fallbackItems;
  }

  try {
    const parsed = JSON.parse(rawExpenseItems);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((item) => item && typeof item === "object")
        .map((item, index) => ({
          id: String(item.id ?? `${entry.id}-${index}`),
          name: String(item.name ?? "Miscellaneous"),
          amount: Number(item.amount ?? 0),
        }));
    }
  } catch (error) {
    console.error("Failed to parse expense items:", error);
  }

  return fallbackItems;
};

// Calculate days until due
export const calculateDaysUntilDue = (dueDate: string | undefined): number => {
  if (!dueDate) {
    return 0;
  }

  const [year, month, day] = dueDate.split("-").map(Number);
  const due = new Date(year, month - 1, day);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(amount);
};

export const formatDate = (dateString: string): string => {
  if (!dateString) return "";

  if (dateString.includes(",")) {
    return dateString;
  }

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

  if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = dateString.split("-").map(Number);
    return `${monthNames[month - 1]} ${day}, ${year}`;
  }

  if (dateString.includes("T") || dateString.includes("Z")) {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    return `${monthNames[month]} ${day}, ${year}`;
  }

  const parts = dateString.split("-");
  if (parts.length === 3) {
    const [year, month, day] = parts.map(Number);
    return `${monthNames[month - 1]} ${day}, ${year}`;
  }

  return dateString;
};

export const formatDueDate = (dateString: string): string => {
  if (!dateString) return "";

  if (dateString.includes(",")) {
    return dateString;
  }

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

  let year: number, month: number, day: number;

  if (dateString.includes("-")) {
    [year, month, day] = dateString.split("-").map(Number);
  } else if (dateString.includes("/")) {
    const parts = dateString.split("/");
    month = parseInt(parts[0]);
    day = parseInt(parts[1]);
    year = parseInt(parts[2]);
  } else {
    return dateString;
  }

  return `${monthNames[month - 1]} ${day}, ${year}`;
};

export const formatDateTime = (dateString: string): string => {
  if (!dateString) return "";

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

  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();

  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  const displayMinutes = minutes.toString().padStart(2, "0");

  return `${monthNames[month]} ${day}, ${year}, ${displayHours}:${displayMinutes} ${period}`;
};

// Enhanced status styling with improved colors and design
export const getStatusColorClass = (status: string): string => {
  const lowerStatus = status.toLowerCase();

  // Paid - Green
  if (lowerStatus.includes("collected") || lowerStatus === "paid") {
    return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-800/50";
  }

  // Needs Monitoring - Orange/Yellow
  if (lowerStatus.includes("delayed") || lowerStatus === "needs monitoring") {
    return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-800/50";
  }

  // Problem/Urgent - Red
  if (
    lowerStatus.includes("overdue") ||
    lowerStatus.includes("problem") ||
    lowerStatus.includes("urgent")
  ) {
    return "bg-red-200 text-red-900 border-red-300 ring-1 ring-red-300/60 dark:bg-red-900/60 dark:text-red-200 dark:border-red-700/70 dark:ring-red-700/40";
  }

  // Not Yet Due / Upcoming - Blue
  if (
    lowerStatus.includes("not yet due") ||
    lowerStatus.includes("upcoming")
  ) {
    return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800/50";
  }

  // Not Yet Set - Light Gray/Muted
  if (lowerStatus.includes("not yet set")) {
    return "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700/50";
  }

  // Transferred - the open balance moved to another unit (settled here) - Violet
  if (lowerStatus === "transferred") {
    return "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-900/50 dark:text-violet-300 dark:border-violet-800/50";
  }

  // Default / Neutral - Gray
  return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800/50 dark:text-gray-300 dark:border-gray-700/50";
};

// Convert billing status to payment display status
export const formatStatusForDisplay = (status: string): string => {
  if (status.toLowerCase() === "overdue") return "Overdue";
  if (status === "Paid") return "Paid";
  if (status === "Partial") return "Partial";
  if (status === "Not Yet Due") return "Not Yet Due";
  if (status === "Not Yet Set") return "Not Yet Set";
  return status;
};
