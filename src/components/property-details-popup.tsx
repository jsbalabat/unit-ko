"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/button";
import { Card, CardContent } from "@/components/ui/card";
// import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Building,
  User,
  MapPin,
  Calendar,
  Clock,
  ArrowUpRight,
  Loader2,
  AlertCircle,
  Pencil,
  Phone,
  FileText,
  ClipboardCheck,
  CreditCard,
  Home,
  Archive,
  Trash2,
  AlertTriangle,
  DollarSign,
  TrendingUp,
  Shield,
  Plus,
  Minus,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { EditPropertyPopup } from "@/components/edit-property-popup";
import { EditBillingPopup } from "@/components/edit-billing-popup";
import {
  AmenitiesPopup,
  AVAILABLE_AMENITIES,
} from "@/components/amenities-popup";
import { PropertyResetDialog } from "@/components/property-reset-dialog";
import { archiveAndResetProperty } from "@/services/archiveService";
// import { ScrollArea } from "@/components/ui/scroll-area";

// Define TypeScript interfaces for data structures
interface BillingEntry {
  id: string;
  property_id: string;
  tenant_id: string;
  due_date: string;
  rent_due: number;
  other_charges: number; // Keep for data compatibility
  gross_due: number;
  status: string;
  billing_period: number;
  paid_amount?: number;
  created_at: string;
  updated_at: string;
  expense_items?: string; // Add this field for the JSON string of expense items
  tenant_payments?: string; // JSON string of per-tenant payments: {"0": 1500, "1": 1500}
}

interface TenantPaymentMap {
  [tenantIndex: string]: number;
}

interface ExpenseItem {
  id: string;
  name: string;
  amount: number;
}

interface PersonDetail {
  name: string;
  email: string;
  phone: string;
}

interface Tenant {
  id: string;
  property_id: string;
  tenant_name: string;
  contact_number: string;
  pax?: number;
  pax_details?: PersonDetail[];
  contract_months: number;
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

interface Property {
  id: string;
  unit_name: string;
  property_type: string;
  occupancy_status: "occupied" | "vacant";
  property_location: string;
  rent_amount: number;
  amenities?: string; // JSON string array of amenity IDs
  created_at: string;
  updated_at: string;
  tenants?: Tenant[];
}

interface ActivityLog {
  id: string;
  property_id: string;
  tenant_id: string | null;
  user_id: string | null;
  action_type: string;
  description: string;
  metadata: any;
  created_at: string;
}

interface PropertyDetailsPopupProps {
  propertyId: string;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (propertyId: string) => void;
  onSuccess?: () => void;
}

export function PropertyDetailsPopup({
  propertyId,
  isOpen,
  onClose,
  onEdit,
  onSuccess,
}: PropertyDetailsPopupProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [activeTab, setActiveTab] = useState("details");
  const [isEditPopupOpen, setIsEditPopupOpen] = useState(false);
  const [isEditBillingPopupOpen, setIsEditBillingPopupOpen] = useState(false);
  const [isAmenitiesPopupOpen, setIsAmenitiesPopupOpen] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentType, setPaymentType] = useState<string>("rent");
  const [paymentNote, setPaymentNote] = useState<string>("");
  const [receiptDate, setReceiptDate] = useState<string>("");
  const [isApplyingPayment, setIsApplyingPayment] = useState(false);
  const [selectedTenantIndex, setSelectedTenantIndex] = useState<number | null>(
    null,
  );
  const [billingViewMode, setBillingViewMode] =
    useState<string>("consolidated");

  // Wrap fetchPropertyDetails in useCallback to prevent recreation on every render
  const fetchPropertyDetails = useCallback(async () => {
    if (!isOpen || !propertyId) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from("properties")
        .select(
          `
          *,
          tenants (
            *,
            billing_entries(*)
          )
        `,
        )
        .eq("id", propertyId)
        .order("billing_period", {
          foreignTable: "tenants.billing_entries",
          ascending: true,
        })
        .single();

      if (error) throw error;

      setProperty(data as Property);

      // Fetch activity logs for this property
      const { data: logs, error: logsError } = await supabase
        .from("activity_logs")
        .select("*")
        .eq("property_id", propertyId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (!logsError && logs) {
        setActivityLogs(logs);
      }
    } catch (err) {
      console.error("Error fetching property details:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load property details",
      );
      toast.error("Failed to load property details");
    } finally {
      setLoading(false);
    }
  }, [propertyId, isOpen]);

  useEffect(() => {
    // Call the function in useEffect
    fetchPropertyDetails();
  }, [fetchPropertyDetails]);

  // Re-fetch data when edit popup closes
  useEffect(() => {
    if (!isEditPopupOpen && !isEditBillingPopupOpen && isOpen) {
      // Small delay to ensure database has been updated
      const timer = setTimeout(() => {
        fetchPropertyDetails();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isEditPopupOpen, isEditBillingPopupOpen, isOpen, fetchPropertyDetails]);

  // Enhanced status styling with improved colors and design
  const getStatusColorClass = (status: string): string => {
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
      return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-800/50";
    }

    // Not Yet Due / Upcoming - Blue
    if (
      lowerStatus.includes("not yet due") ||
      lowerStatus.includes("upcoming")
    ) {
      return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800/50";
    }

    // Default / Neutral - Gray
    return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800/50 dark:text-gray-300 dark:border-gray-700/50";
  };

  // Convert billing status to payment display status
  const getPaymentDisplayStatus = (status: string): string => {
    const lowerStatus = status.toLowerCase();
    // Paid = Paid
    if (lowerStatus === "paid" || lowerStatus.includes("collected")) {
      return "Paid";
    }
    // All others = Pending
    return "Pending";
  };

  // Get color class for payment display status
  const getPaymentStatusColorClass = (displayStatus: string): string => {
    if (displayStatus === "Paid") {
      return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-800/50";
    }
    // Pending
    return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-800/50";
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string): string => {
    if (!dateString) return "";

    // Check if it's already formatted (e.g., "Sep 14, 2025")
    if (dateString.includes(",")) {
      return dateString;
    }

    // Handle ISO date string (YYYY-MM-DD)
    if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = dateString.split("-").map(Number);
      const date = new Date(year, month - 1, day);

      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }

    // Handle full ISO datetime strings (with T or Z)
    if (dateString.includes("T") || dateString.includes("Z")) {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }

    // Fallback: try to parse and handle as local date
    const parts = dateString.split("-");
    if (parts.length === 3) {
      const [year, month, day] = parts.map(Number);
      const date = new Date(year, month - 1, day);

      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }

    // Last resort fallback
    return dateString;
  };

  const formatDueDate = (dateString: string): string => {
    if (!dateString) return "";

    // If already formatted, return as is
    if (dateString.includes(",")) {
      return dateString;
    }

    // Parse the date string manually to avoid timezone conversion
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

    // Create date in local timezone
    const date = new Date(year, month - 1, day);

    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Calculate days until due
  const calculateDaysUntilDue = (dueDate: string): number => {
    // Parse as local date to avoid timezone offset
    const [year, month, day] = dueDate.split("-").map(Number);
    const due = new Date(year, month - 1, day);

    // Get today at midnight local time
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  // Handle property deletion
  const handleDeleteProperty = async () => {
    if (!property) return;

    setIsDeleting(true);

    try {
      const activeTenant = property.tenants?.find((t) => t.is_active);

      // First, delete any billing entries associated with this property
      if (activeTenant) {
        const { error: billingDeleteError } = await supabase
          .from("billing_entries")
          .delete()
          .eq("property_id", propertyId);

        if (billingDeleteError) throw billingDeleteError;

        // Then delete the tenant
        const { error: tenantDeleteError } = await supabase
          .from("tenants")
          .delete()
          .eq("id", activeTenant.id);

        if (tenantDeleteError) throw tenantDeleteError;
      }

      // Finally delete the property
      const { error: propertyDeleteError } = await supabase
        .from("properties")
        .delete()
        .eq("id", propertyId);

      if (propertyDeleteError) throw propertyDeleteError;

      // Show success message
      toast.success("Property deleted successfully", {
        description: `${property.unit_name} and all associated data have been permanently removed.`,
      });

      // Call the success callback if provided
      if (onSuccess) onSuccess();

      // Close the dialog
      onClose();
    } catch (err) {
      console.error("Error deleting property:", err);
      toast.error("Failed to delete property");
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  // Handle universal payment application
  const handleApplyPayment = async () => {
    if (!property || !activeTenant || paymentAmount === 0) return;

    setIsApplyingPayment(true);

    try {
      // Build payment note with tenant information if applicable
      let finalPaymentNote = paymentNote;
      if (
        paxCount > 1 &&
        selectedTenantIndex !== null &&
        activeTenant.pax_details
      ) {
        const tenantName =
          activeTenant.pax_details[selectedTenantIndex]?.name ||
          `Tenant ${selectedTenantIndex + 1}`;
        const prefix = `Payment by: ${tenantName} (Share: 1/${paxCount})`;
        finalPaymentNote = paymentNote ? `${prefix}. ${paymentNote}` : prefix;
      } else if (paxCount > 1 && selectedTenantIndex === null) {
        const prefix = `Payment for all tenants (Full amount)`;
        finalPaymentNote = paymentNote ? `${prefix}. ${paymentNote}` : prefix;
      }

      // If a specific tenant is selected in pax system, apply only their share
      const isPerPersonPayment = paxCount > 1 && selectedTenantIndex !== null;

      // Handle Deposit and Advance Payment differently
      if (paymentType === "deposit" || paymentType === "advance") {
        // Update tenant's deposit or advance payment field
        const fieldToUpdate =
          paymentType === "deposit" ? "security_deposit" : "advance_payment";
        const currentValue =
          paymentType === "deposit"
            ? activeTenant.security_deposit || 0
            : activeTenant.advance_payment || 0;
        const newValue = currentValue + paymentAmount;

        const { error } = await supabase
          .from("tenants")
          .update({
            [fieldToUpdate]: newValue,
            updated_at: new Date().toISOString(),
          })
          .eq("id", activeTenant.id);

        if (error) throw error;

        // Refresh property details
        await fetchPropertyDetails();

        toast.success(
          `${paymentType === "deposit" ? "Security Deposit" : "Advance Payment"} updated successfully`,
          {
            description: `New ${paymentType === "deposit" ? "deposit" : "advance"} amount: ₱${newValue.toLocaleString()}`,
          },
        );

        // TODO: Log to activity log with paymentNote and receiptDate when activity log is implemented
        // console.log('Payment note for activity log:', paymentNote);
        // console.log('Receipt date for activity log:', receiptDate);

        // Reset and close dialog
        setPaymentAmount(0);
        setPaymentType("rent");
        setPaymentNote("");
        setReceiptDate("");
        setIsPaymentDialogOpen(false);
        return;
      }

      // Handle normal rent/other charges payment to billing entries
      const entries = activeTenant.billing_entries || [];
      const currentOverflow = activeTenant.overflow || 0;

      // Sort entries: chronologically for positive payments, reverse for negative payments
      const sortedEntries = [...entries].sort((a, b) => {
        const dateA = new Date(a.due_date).getTime();
        const dateB = new Date(b.due_date).getTime();
        // For negative payments, sort in reverse (latest first)
        return paymentAmount < 0 ? dateB - dateA : dateA - dateB;
      });

      let remainingPayment = paymentAmount;
      let newOverflow = currentOverflow;
      const updates: Array<{
        id: string;
        paidAmount: number;
        status: string;
        tenantPayments: string;
      }> = [];

      // For POSITIVE payments: First use overflow to pay billing entries, then add excess to overflow
      if (paymentAmount > 0) {
        // Step 1: Use existing overflow to pay off billing entries first
        if (newOverflow > 0) {
          for (const entry of sortedEntries) {
            if (newOverflow <= 0) break;

            const currentPaid = entry.paid_amount || 0;
            const amountDue = entry.gross_due - currentPaid;

            if (amountDue > 0) {
              const overflowToUse = Math.min(newOverflow, amountDue);
              const newPaidAmount = currentPaid + overflowToUse;
              newOverflow -= overflowToUse;

              // Parse existing tenant payments
              let tenantPaymentsMap: TenantPaymentMap = {};
              try {
                tenantPaymentsMap = entry.tenant_payments
                  ? JSON.parse(entry.tenant_payments)
                  : {};
              } catch (e) {
                tenantPaymentsMap = {};
              }

              // Distribute overflow payment proportionally among all tenants
              const paymentPerTenant = overflowToUse / paxCount;
              for (let i = 0; i < paxCount; i++) {
                const tenantKey = i.toString();
                const currentTenantPaid = tenantPaymentsMap[tenantKey] || 0;
                tenantPaymentsMap[tenantKey] =
                  currentTenantPaid + paymentPerTenant;
              }

              // Determine new status
              let newStatus = entry.status;
              const epsilon = 0.01;
              if (newPaidAmount >= entry.gross_due - epsilon) {
                newStatus = "Paid";
              } else if (newPaidAmount > epsilon) {
                newStatus = "Partial";
              } else {
                const dueDate = new Date(entry.due_date);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                dueDate.setHours(0, 0, 0, 0);
                newStatus = dueDate < today ? "overdue" : "Not Yet Due";
              }

              updates.push({
                id: entry.id,
                paidAmount: newPaidAmount,
                status: newStatus,
                tenantPayments: JSON.stringify(tenantPaymentsMap),
              });
            }
          }
        }

        // Step 2: Apply the new payment to billing entries
        for (const entry of sortedEntries) {
          if (remainingPayment <= 0) break;

          // Find if this entry was already updated from overflow
          const existingUpdate = updates.find((u) => u.id === entry.id);
          const currentPaid = existingUpdate
            ? existingUpdate.paidAmount
            : entry.paid_amount || 0;

          // Parse existing tenant payments
          let tenantPaymentsMap: TenantPaymentMap = {};
          try {
            if (existingUpdate) {
              tenantPaymentsMap = JSON.parse(existingUpdate.tenantPayments);
            } else {
              tenantPaymentsMap = entry.tenant_payments
                ? JSON.parse(entry.tenant_payments)
                : {};
            }
          } catch (e) {
            tenantPaymentsMap = {};
          }

          const perPersonShare = entry.gross_due / paxCount;
          let amountDue: number;
          let paymentToApply: number;

          if (isPerPersonPayment && selectedTenantIndex !== null) {
            // Individual tenant payment - check their specific share
            const tenantKey = selectedTenantIndex.toString();
            const tenantPaid = tenantPaymentsMap[tenantKey] || 0;
            const tenantShare = perPersonShare;
            const tenantDue = tenantShare - tenantPaid;

            if (tenantDue > 0) {
              paymentToApply = Math.min(remainingPayment, tenantDue);
              tenantPaymentsMap[tenantKey] = tenantPaid + paymentToApply;
              const newTotalPaid = Object.values(tenantPaymentsMap).reduce(
                (sum, val) => sum + val,
                0,
              );

              // Determine new status based on all tenant payments
              let newStatus = "Partial";
              const epsilon = 0.01;

              // Check if all tenants have paid their shares
              const allTenantsPaid = Array.from(
                { length: paxCount },
                (_, i) => {
                  const paid = tenantPaymentsMap[i.toString()] || 0;
                  return paid >= perPersonShare - epsilon;
                },
              ).every(Boolean);

              if (allTenantsPaid || newTotalPaid >= entry.gross_due - epsilon) {
                newStatus = "Paid";
              } else if (newTotalPaid > epsilon) {
                newStatus = "Partial";
              } else {
                const dueDate = new Date(entry.due_date);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                dueDate.setHours(0, 0, 0, 0);
                newStatus = dueDate < today ? "overdue" : "Not Yet Due";
              }

              if (existingUpdate) {
                existingUpdate.paidAmount = newTotalPaid;
                existingUpdate.status = newStatus;
                existingUpdate.tenantPayments =
                  JSON.stringify(tenantPaymentsMap);
              } else {
                updates.push({
                  id: entry.id,
                  paidAmount: newTotalPaid,
                  status: newStatus,
                  tenantPayments: JSON.stringify(tenantPaymentsMap),
                });
              }

              remainingPayment -= paymentToApply;
            }
          } else {
            // Full payment (all tenants) - traditional logic
            amountDue = entry.gross_due - currentPaid;
            if (amountDue > 0) {
              paymentToApply = Math.min(remainingPayment, amountDue);
              const newPaidAmount = currentPaid + paymentToApply;

              // Distribute payment proportionally among all tenants
              const paymentPerTenant = paymentToApply / paxCount;
              for (let i = 0; i < paxCount; i++) {
                const tenantKey = i.toString();
                const currentTenantPaid = tenantPaymentsMap[tenantKey] || 0;
                tenantPaymentsMap[tenantKey] =
                  currentTenantPaid + paymentPerTenant;
              }

              // Determine new status
              let newStatus = entry.status;
              const epsilon = 0.01;
              if (newPaidAmount >= entry.gross_due - epsilon) {
                newStatus = "Paid";
              } else if (newPaidAmount > epsilon) {
                newStatus = "Partial";
              } else {
                // Determine overdue vs not yet due
                const dueDate = new Date(entry.due_date);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                dueDate.setHours(0, 0, 0, 0);
                newStatus = dueDate < today ? "overdue" : "Not Yet Due";
              }

              if (existingUpdate) {
                existingUpdate.paidAmount = newPaidAmount;
                existingUpdate.status = newStatus;
                existingUpdate.tenantPayments =
                  JSON.stringify(tenantPaymentsMap);
              } else {
                updates.push({
                  id: entry.id,
                  paidAmount: newPaidAmount,
                  status: newStatus,
                  tenantPayments: JSON.stringify(tenantPaymentsMap),
                });
              }

              remainingPayment -= paymentToApply;
            }
          }
        }

        // Step 3: Any remaining payment goes to overflow
        if (remainingPayment > 0) {
          newOverflow += remainingPayment;
          remainingPayment = 0;
        }
      } else {
        // For NEGATIVE payments (refunds): Deduct from overflow FIRST (highest priority), then from billing entries

        // Step 1: Deduct from overflow first
        if (remainingPayment < 0 && newOverflow > 0) {
          const deductFromOverflow = Math.min(
            Math.abs(remainingPayment),
            newOverflow,
          );
          newOverflow -= deductFromOverflow;
          remainingPayment += deductFromOverflow;
        }

        // Step 2: If still have remaining negative payment, deduct from billing entries
        for (const entry of sortedEntries) {
          if (remainingPayment >= 0) break;

          const currentPaid = entry.paid_amount || 0;

          if (currentPaid > 0) {
            let deductionAmount: number;
            let newPaidAmount: number;

            // Parse existing tenant payments
            let tenantPaymentsMap: TenantPaymentMap = {};
            try {
              tenantPaymentsMap = entry.tenant_payments
                ? JSON.parse(entry.tenant_payments)
                : {};
            } catch (e) {
              tenantPaymentsMap = {};
            }

            if (isPerPersonPayment && selectedTenantIndex !== null) {
              // Individual tenant refund
              const tenantKey = selectedTenantIndex.toString();
              const tenantPaid = tenantPaymentsMap[tenantKey] || 0;
              const maxDeduction = Math.min(
                Math.abs(remainingPayment),
                tenantPaid,
              );

              tenantPaymentsMap[tenantKey] = tenantPaid - maxDeduction;
              newPaidAmount = Object.values(tenantPaymentsMap).reduce(
                (sum, val) => sum + val,
                0,
              );
              deductionAmount = -maxDeduction;
            } else {
              // Full refund (proportional to all tenants)
              deductionAmount = Math.max(remainingPayment, -currentPaid);
              newPaidAmount = currentPaid + deductionAmount;

              // Distribute deduction proportionally among all tenants
              const deductionPerTenant = Math.abs(deductionAmount) / paxCount;
              for (let i = 0; i < paxCount; i++) {
                const tenantKey = i.toString();
                const currentTenantPaid = tenantPaymentsMap[tenantKey] || 0;
                tenantPaymentsMap[tenantKey] = Math.max(
                  0,
                  currentTenantPaid - deductionPerTenant,
                );
              }
            }

            // Determine new status
            let newStatus = entry.status;
            const epsilon = 0.01;
            if (newPaidAmount >= entry.gross_due - epsilon) {
              newStatus = "Paid";
            } else if (newPaidAmount > epsilon) {
              newStatus = "Partial";
            } else {
              // Determine overdue vs not yet due
              const dueDate = new Date(entry.due_date);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              dueDate.setHours(0, 0, 0, 0);
              newStatus = dueDate < today ? "overdue" : "Not Yet Due";
            }

            updates.push({
              id: entry.id,
              paidAmount: Math.max(0, newPaidAmount),
              status: newStatus,
              tenantPayments: JSON.stringify(tenantPaymentsMap),
            });

            remainingPayment -= deductionAmount;
          }
        }
      }

      // Update all entries in the database
      for (const update of updates) {
        const { error } = await supabase
          .from("billing_entries")
          .update({
            paid_amount: update.paidAmount,
            status: update.status,
            tenant_payments: update.tenantPayments,
            updated_at: new Date().toISOString(),
          })
          .eq("id", update.id);

        if (error) throw error;
      }

      // Update tenant overflow if it changed
      if (newOverflow !== currentOverflow) {
        const { error } = await supabase
          .from("tenants")
          .update({
            overflow: newOverflow,
            updated_at: new Date().toISOString(),
          })
          .eq("id", activeTenant.id);

        if (error) throw error;
      }

      // Refresh property details
      await fetchPropertyDetails();

      // Show success message
      const tenantInfo =
        isPerPersonPayment && activeTenant.pax_details?.[selectedTenantIndex!]
          ? ` by ${activeTenant.pax_details[selectedTenantIndex!].name}`
          : "";

      if (newOverflow > currentOverflow) {
        toast.success("Payment applied successfully", {
          description: `₱${paymentAmount.toLocaleString()} applied. Excess of ₱${(newOverflow - currentOverflow).toFixed(2)} added to overflow${tenantInfo}.`,
        });
      } else if (newOverflow < currentOverflow) {
        toast.success("Payment applied successfully", {
          description: `₱${Math.abs(paymentAmount).toLocaleString()} deducted. ₱${(currentOverflow - newOverflow).toFixed(2)} deducted from overflow${tenantInfo}.`,
        });
      } else {
        toast.success("Payment applied successfully", {
          description: `₱${Math.abs(paymentAmount).toLocaleString()} has been distributed across billing entries${tenantInfo}.`,
        });
      }

      // TODO: Log to activity log with finalPaymentNote and receiptDate when activity log is implemented
      // console.log('Payment note for activity log:', finalPaymentNote);
      // console.log('Receipt date for activity log:', receiptDate);

      // Reset and close dialog
      setPaymentAmount(0);
      setPaymentType("rent");
      setPaymentNote("");
      setReceiptDate("");
      setSelectedTenantIndex(null);
      setIsPaymentDialogOpen(false);
    } catch (err) {
      console.error("Error applying payment:", err);
      toast.error("Failed to apply payment");
    } finally {
      setIsApplyingPayment(false);
    }
  };

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent
          className="sm:max-w-[95%] md:max-w-[90%] lg:max-w-[900px] max-h-[90vh] p-0"
          aria-describedby="loading-description" // This correctly matches the ID below
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Property Details</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
              <p
                id="loading-description"
                className="text-sm text-muted-foreground"
              >
                Loading property details...
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (error) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[95%] md:max-w-[90%] lg:max-w-[900px]">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Error Loading Property
            </DialogTitle>
            <DialogDescription>
              We encountered a problem while loading the property details.
            </DialogDescription>
          </DialogHeader>
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <div className="flex justify-end">
            <Button onClick={onClose}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!property) return null;

  const activeTenant = property.tenants?.find((t) => t.is_active);
  const billingEntries = activeTenant?.billing_entries || [];
  // Get pax count with fallback to 1 for existing tenants without pax field
  // Count only filled-in pax_details entries
  const filledPaxCount =
    activeTenant?.pax_details?.filter((p) => p.name && p.name.trim() !== "")
      .length || 0;
  const paxCount =
    filledPaxCount > 0 ? filledPaxCount : (activeTenant?.pax ?? 1);

  const currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);

  // Recent Transactions: Paid entries that are past or current
  const recentPayments = billingEntries
    .filter((entry) => {
      const dueDate = new Date(entry.due_date);
      dueDate.setHours(0, 0, 0, 0);
      const isPaid = entry.status === "Paid";
      const isPastOrCurrent = dueDate <= currentDate;
      return isPaid && isPastOrCurrent;
    })
    .sort(
      (a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime(),
    )
    .slice(0, 5);

  // Upcoming Payments: Unpaid entries that are current or future
  const upcomingPayments = billingEntries
    .filter((entry) => {
      const dueDate = new Date(entry.due_date);
      dueDate.setHours(0, 0, 0, 0);
      const isUnpaid = entry.status !== "Paid";
      const isCurrentOrFuture = dueDate >= currentDate;
      return isUnpaid && isCurrentOrFuture;
    })
    .sort(
      (a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime(),
    );

  // Calculate financial summaries
  // Total Revenue: All paid entries
  const totalRevenue = billingEntries
    .filter((entry) => entry.status === "Paid")
    .reduce((sum, entry) => sum + entry.gross_due, 0);

  // Pending Payments: All unpaid entries except Problem/Urgent (Needs Monitoring, Neutral/Administrative)
  const pendingPayments = billingEntries
    .filter(
      (entry) =>
        entry.status === "Needs Monitoring" ||
        entry.status === "Neutral / Administrative",
    )
    .reduce((sum, entry) => sum + entry.gross_due, 0);

  // Overdue Amount: Problem/Urgent entries
  const overdueAmount = billingEntries
    .filter((entry) => entry.status === "Problem / Urgent")
    .reduce((sum, entry) => sum + entry.gross_due, 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="sm:max-w-[95%] md:max-w-[90%] lg:max-w-[900px] p-0 max-h-[95vh] overflow-hidden flex flex-col"
        aria-describedby="property-details-description" // Add this specific ID
      >
        {/* Header - Sticky */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b p-4 md:p-6 pb-3 md:pb-4">
          <DialogHeader className="pb-0">
            <div className="flex flex-col xs:flex-row items-start xs:items-center justify-between gap-3">
              <div className="flex items-center">
                <div
                  className={`p-2 rounded-full ${
                    property.occupancy_status === "occupied"
                      ? "bg-green-100 dark:bg-green-900/50"
                      : "bg-amber-100 dark:bg-amber-900/50"
                  } mr-3`}
                >
                  <Building
                    className={`h-5 w-5 md:h-6 md:w-6 ${
                      property.occupancy_status === "occupied"
                        ? "text-green-600 dark:text-green-400"
                        : "text-amber-600 dark:text-amber-400"
                    }`}
                  />
                </div>
                <div>
                  <DialogTitle className="text-lg md:text-xl font-bold line-clamp-1">
                    {property.unit_name}
                  </DialogTitle>
                  <DialogDescription
                    id="property-details-description" // Use the same ID as aria-describedby
                    className="flex items-center mt-0.5"
                  >
                    <MapPin className="h-3 w-3 md:h-3.5 md:w-3.5 mr-1 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs md:text-sm text-muted-foreground truncate max-w-[200px] md:max-w-[300px]">
                      {property.property_location}
                    </span>
                  </DialogDescription>
                </div>
              </div>

              {/* Status Badge - Responsive positioning */}
              <Badge
                variant="outline"
                className={`${
                  property.occupancy_status === "occupied"
                    ? "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-800/50"
                    : "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-800/50"
                } px-2 py-1 text-xs capitalize`}
              >
                {property.occupancy_status}
              </Badge>
            </div>
          </DialogHeader>
        </div>

        {/* Tabs - Responsive design */}
        <Tabs
          defaultValue="details"
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <TabsList className="mx-4 md:mx-6 mt-4 grid grid-cols-3 w-auto">
            <TabsTrigger value="details" className="text-xs sm:text-sm">
              Property Details
            </TabsTrigger>
            <TabsTrigger value="finances" className="text-xs sm:text-sm">
              Statement of Account
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs sm:text-sm">
              Activity Log
            </TabsTrigger>
          </TabsList>

          {/* Edit button - shown only in details tab */}
          {activeTab === "details" && (
            <div className="mx-4 md:mx-6 mt-3 flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsEditPopupOpen(true)}
                className="text-xs h-8 gap-1.5"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit Property
              </Button>
            </div>
          )}

          <TabsContent
            value="details"
            className="flex-1 overflow-auto px-4 md:px-6 pt-4 pb-16"
          >
            <div className="space-y-4 md:space-y-6">
              {/* Details tab content... */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <Card className="shadow-sm">
                  <CardContent className="p-4 md:p-6">
                    <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4 flex items-center">
                      <Building className="h-4 w-4 md:h-5 md:w-5 mr-2 text-primary" />
                      Property Information
                    </h3>
                    <div className="space-y-2 md:space-y-3 text-sm">
                      <div className="grid grid-cols-2 items-center">
                        <span className="text-muted-foreground text-xs md:text-sm">
                          Property Type
                        </span>
                        <span className="font-medium text-xs md:text-sm">
                          {property.property_type}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 items-center">
                        <span className="text-muted-foreground text-xs md:text-sm">
                          Monthly Rent per Tenant
                        </span>
                        <span className="font-medium text-green-600 dark:text-green-400 text-xs md:text-sm">
                          ~ {formatCurrency(property.rent_amount)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 items-center">
                        <span className="text-muted-foreground text-xs md:text-sm">
                          Status
                        </span>
                        <span className="font-medium text-xs md:text-sm">
                          {property.occupancy_status === "occupied" &&
                          activeTenant?.pax ? (
                            <span className="text-green-600 dark:text-green-400">
                              Occupied ({paxCount}/{activeTenant.pax})
                            </span>
                          ) : (
                            <span className="capitalize">
                              {property.occupancy_status}
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 items-center">
                        <span className="text-muted-foreground text-xs md:text-sm">
                          Date Added
                        </span>
                        <span className="font-medium text-xs md:text-sm">
                          {formatDate(property.created_at)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2">
                        <span className="text-muted-foreground text-xs md:text-sm">
                          Location
                        </span>
                        <span className="font-medium break-words text-xs md:text-sm">
                          {property.property_location}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {activeTenant ? (
                  <Card className="shadow-sm">
                    <CardContent className="p-4 md:p-6">
                      <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4 flex items-center">
                        <User className="h-4 w-4 md:h-5 md:w-5 mr-2 text-primary" />
                        Tenant Information
                      </h3>
                      <div className="space-y-4">
                        {/* Contract Details */}
                        <div className="space-y-2 md:space-y-3 text-sm">
                          <div className="grid grid-cols-2 items-center">
                            <span className="text-muted-foreground text-xs md:text-sm">
                              Number of Occupants
                            </span>
                            <span className="font-medium text-xs md:text-sm">
                              {activeTenant.pax || 1}{" "}
                              {(activeTenant.pax || 1) === 1
                                ? "person"
                                : "people"}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 items-center">
                            <span className="text-muted-foreground text-xs md:text-sm">
                              Contract Duration
                            </span>
                            <span className="font-medium text-xs md:text-sm">
                              {activeTenant.contract_months} months
                            </span>
                          </div>
                          <div className="grid grid-cols-2 items-center">
                            <span className="text-muted-foreground text-xs md:text-sm">
                              Rent Agreement Date
                            </span>
                            <span className="font-medium text-xs md:text-sm">
                              {formatDate(activeTenant.rent_start_date)}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 items-center">
                            <span className="text-muted-foreground text-xs md:text-sm">
                              Due Day
                            </span>
                            <span className="font-medium text-xs md:text-sm">
                              {activeTenant.due_day === "last"
                                ? "Last Day"
                                : `Day ${activeTenant.due_day}`}
                            </span>
                          </div>
                          {((activeTenant.advance_payment !== undefined &&
                            activeTenant.advance_payment > 0) ||
                            (activeTenant.security_deposit !== undefined &&
                              activeTenant.security_deposit > 0) ||
                            (activeTenant.overflow !== undefined &&
                              activeTenant.overflow > 0)) && (
                            <>
                              <div className="col-span-2 border-t my-2"></div>
                              {activeTenant.advance_payment !== undefined &&
                                activeTenant.advance_payment > 0 && (
                                  <div className="grid grid-cols-2 items-center">
                                    <span className="text-muted-foreground text-xs md:text-sm">
                                      Advance Payment
                                    </span>
                                    <span className="font-medium text-green-600 dark:text-green-400 text-xs md:text-sm">
                                      {formatCurrency(
                                        activeTenant.advance_payment,
                                      )}
                                    </span>
                                  </div>
                                )}
                              {activeTenant.security_deposit !== undefined &&
                                activeTenant.security_deposit > 0 && (
                                  <div className="grid grid-cols-2 items-center">
                                    <span className="text-muted-foreground text-xs md:text-sm">
                                      Security Deposit
                                    </span>
                                    <span className="font-medium text-green-600 dark:text-green-400 text-xs md:text-sm">
                                      {formatCurrency(
                                        activeTenant.security_deposit,
                                      )}
                                    </span>
                                  </div>
                                )}
                              {activeTenant.overflow !== undefined &&
                                activeTenant.overflow > 0 && (
                                  <div className="grid grid-cols-2 items-center">
                                    <span className="text-muted-foreground text-xs md:text-sm flex items-center gap-1">
                                      <TrendingUp className="h-3 w-3" />
                                      Overflow (Excess Payment)
                                    </span>
                                    <span className="font-medium text-blue-600 dark:text-blue-400 text-xs md:text-sm">
                                      {formatCurrency(activeTenant.overflow)}
                                    </span>
                                  </div>
                                )}
                            </>
                          )}
                        </div>

                        {/* Occupant Details */}
                        {activeTenant.pax && activeTenant.pax > 0 && (
                          <div className="border-t pt-4">
                            <h4 className="text-sm font-semibold mb-3">
                              Occupant Details ({paxCount}/{activeTenant.pax}{" "}
                              Occupied)
                            </h4>
                            <div className="space-y-3">
                              {Array.from(
                                { length: activeTenant.pax },
                                (_, index) => {
                                  const person =
                                    activeTenant.pax_details?.[index];
                                  const isOccupied =
                                    person?.name && person.name.trim() !== "";

                                  return (
                                    <div
                                      key={index}
                                      className={`p-3 rounded-lg border ${
                                        isOccupied
                                          ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
                                          : "bg-gray-50 dark:bg-gray-900/30 border-gray-200 dark:border-gray-800 border-dashed"
                                      }`}
                                    >
                                      <div className="flex items-start gap-3">
                                        <div
                                          className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                                            isOccupied
                                              ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300"
                                              : "bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-600"
                                          }`}
                                        >
                                          <User className="h-5 w-5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 mb-1">
                                            <p
                                              className={`font-medium text-sm ${
                                                isOccupied
                                                  ? "text-foreground"
                                                  : "text-muted-foreground italic"
                                              }`}
                                            >
                                              {isOccupied
                                                ? person.name
                                                : `Slot ${index + 1} - Vacant`}
                                            </p>
                                            {isOccupied && (
                                              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300">
                                                Occupied
                                              </span>
                                            )}
                                            {!isOccupied && (
                                              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                                                Available
                                              </span>
                                            )}
                                          </div>
                                          {isOccupied ? (
                                            <>
                                              {person.email && (
                                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                                                  <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    className="h-3 w-3"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                  >
                                                    <rect
                                                      width="20"
                                                      height="16"
                                                      x="2"
                                                      y="4"
                                                      rx="2"
                                                    />
                                                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                                                  </svg>
                                                  <span className="truncate">
                                                    {person.email}
                                                  </span>
                                                </div>
                                              )}
                                              {person.phone && (
                                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                  <Phone className="h-3 w-3" />
                                                  <span>{person.phone}</span>
                                                </div>
                                              )}
                                            </>
                                          ) : (
                                            <p className="text-xs text-muted-foreground">
                                              No tenant assigned to this slot
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                },
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="shadow-sm">
                    <CardContent className="p-4 md:p-6">
                      <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4 flex items-center">
                        <User className="h-4 w-4 md:h-5 md:w-5 mr-2 text-muted-foreground" />
                        Tenant Information
                      </h3>
                      <div className="flex flex-col items-center justify-center h-24 md:h-32 text-center text-muted-foreground">
                        <Building className="h-6 w-6 md:h-8 md:w-8 mb-2 opacity-40" />
                        <p className="text-xs md:text-sm">
                          This property is currently vacant
                        </p>
                        <p className="text-xs mt-1">
                          Add a tenant once the property is rented
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {property.occupancy_status === "occupied" && activeTenant && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  <Card className="shadow-sm">
                    <CardContent className="p-4 md:p-6">
                      <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4 flex items-center">
                        <Calendar className="h-4 w-4 md:h-5 md:w-5 mr-2 text-primary" />
                        Upcoming Payments
                      </h3>
                      {upcomingPayments.length > 0 ? (
                        <div className="space-y-2 md:space-y-3">
                          {upcomingPayments.slice(0, 3).map((payment) => {
                            const displayStatus = getPaymentDisplayStatus(
                              payment.status,
                            );
                            return (
                              <div
                                key={payment.id}
                                className="flex justify-between items-center p-2 md:p-3 bg-muted/30 rounded-lg border"
                              >
                                <div className="flex items-center">
                                  <Clock className="h-3.5 w-3.5 text-blue-500 mr-1.5 flex-shrink-0" />
                                  <div>
                                    <p className="text-xs md:text-sm font-medium">
                                      {formatDueDate(payment.due_date)}
                                    </p>
                                    <p className="text-[10px] md:text-xs text-muted-foreground">
                                      Due in{" "}
                                      {calculateDaysUntilDue(payment.due_date)}{" "}
                                      days
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className="text-xs md:text-sm font-bold block">
                                    {formatCurrency(payment.gross_due)}
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] md:text-xs mt-1 ${getPaymentStatusColorClass(
                                      displayStatus,
                                    )}`}
                                  >
                                    {displayStatus}
                                  </Badge>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-20 md:h-24 text-center text-muted-foreground">
                          <p className="text-xs md:text-sm">
                            No upcoming payments
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="shadow-sm">
                    <CardContent className="p-4 md:p-6">
                      <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4 flex items-center">
                        Recent Transactions
                      </h3>
                      {recentPayments.length > 0 ? (
                        <div className="space-y-2 md:space-y-3">
                          {recentPayments.slice(0, 3).map((payment) => {
                            // Parse expense items
                            const expenseItems: ExpenseItem[] =
                              payment.expense_items
                                ? JSON.parse(payment.expense_items)
                                : [
                                    {
                                      id: `default-${payment.id}`,
                                      name: "Miscellaneous",
                                      amount: payment.other_charges,
                                    },
                                  ];

                            return (
                              <div
                                key={payment.id}
                                className="flex justify-between items-center p-2 md:p-3 bg-muted/30 rounded-lg border group"
                              >
                                <div className="flex items-center">
                                  <CreditCard className="h-3.5 w-3.5 text-muted-foreground mr-1.5 flex-shrink-0" />
                                  <div>
                                    <p className="text-xs md:text-sm font-medium">
                                      {formatDate(payment.due_date)}
                                    </p>
                                    <p className="text-[10px] md:text-xs text-muted-foreground">
                                      Payment #{payment.billing_period}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className="text-xs md:text-sm font-bold">
                                    {formatCurrency(payment.gross_due)}
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className={`block mt-1 text-[10px] md:text-xs ${getPaymentStatusColorClass(
                                      getPaymentDisplayStatus(payment.status),
                                    )}`}
                                  >
                                    {getPaymentDisplayStatus(payment.status)}
                                  </Badge>

                                  {/* Expense items tooltip - more mobile friendly - wrapper technique */}
                                  <span className="absolute invisible group-hover:visible z-[100]">
                                    <span className="relative block right-0 bottom-full mb-1 bg-popover shadow-md rounded-md p-2 w-48 xs:w-64 border">
                                      <div className="text-xs font-medium mb-1">
                                        Expense Breakdown:
                                      </div>
                                      <div className="flex justify-between text-xs mb-1">
                                        <span>Rent</span>
                                        <span>
                                          {formatCurrency(payment.rent_due)}
                                        </span>
                                      </div>
                                      {expenseItems.map((item) => (
                                        <div
                                          key={item.id}
                                          className="flex justify-between text-xs mb-1"
                                        >
                                          <span className="truncate mr-2">
                                            {item.name}
                                          </span>
                                          <span className="flex-shrink-0">
                                            {formatCurrency(item.amount)}
                                          </span>
                                        </div>
                                      ))}
                                      <div className="border-t pt-1 mt-1 text-xs font-semibold">
                                        <div className="flex justify-between">
                                          <span>Total</span>
                                          <span>
                                            {formatCurrency(payment.gross_due)}
                                          </span>
                                        </div>
                                      </div>
                                    </span>
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-20 md:h-24 text-center text-muted-foreground">
                          <p className="text-xs md:text-sm">
                            No recent transactions
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Amenities Section */}
              <Card className="shadow-sm">
                <CardContent className="p-4 md:p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base md:text-lg font-semibold flex items-center">
                      <Home className="h-4 w-4 md:h-5 md:w-5 mr-2 text-primary" />
                      What this place offers
                    </h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsAmenitiesPopupOpen(true)}
                      className="text-xs h-8"
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1.5" />
                      Edit
                    </Button>
                  </div>

                  {property &&
                  property.amenities &&
                  JSON.parse(property.amenities).length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {JSON.parse(property.amenities).map(
                        (amenityId: string) => {
                          const amenity = AVAILABLE_AMENITIES.find(
                            (a) => a.id === amenityId,
                          );
                          if (!amenity) return null;
                          return (
                            <div
                              key={amenity.id}
                              className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20"
                            >
                              <span className="text-muted-foreground">
                                {amenity.icon}
                              </span>
                              <span className="text-sm">{amenity.name}</span>
                            </div>
                          );
                        },
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                      <Home className="h-8 w-8 mb-2 opacity-40" />
                      <p className="text-sm">No amenities added yet</p>
                      <p className="text-xs mt-1">
                        Click Edit to add amenities to this property
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent
            value="finances"
            className="flex-1 overflow-auto px-4 md:px-6 pt-4 pb-16"
          >
            <div className="space-y-4 md:space-y-6">
              {/* Finances tab content... */}
              {property.occupancy_status === "occupied" && activeTenant ? (
                <>
                  {/* Financial Overview - Ticker Strip */}
                  <div className="overflow-hidden bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 rounded-lg border shadow-sm">
                    <div className="overflow-x-auto scrollbar-hide">
                      <div className="flex items-center justify-between sm:justify-around py-3 px-4 gap-4 sm:gap-6 min-w-max sm:min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                            <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                              Total Revenue
                            </div>
                            <div className="text-lg font-bold text-green-600 dark:text-green-400 whitespace-nowrap">
                              {formatCurrency(totalRevenue)}
                            </div>
                          </div>
                        </div>

                        <div className="h-10 w-px bg-border shrink-0" />

                        <div className="flex items-center gap-2 min-w-0">
                          <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                            <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                              Pending Payments
                            </div>
                            <div className="text-lg font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                              {formatCurrency(pendingPayments)}
                            </div>
                          </div>
                        </div>

                        <div className="h-10 w-px bg-border shrink-0" />

                        <div className="flex items-center gap-2 min-w-0">
                          <div className="h-8 w-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                              Overdue Amount
                            </div>
                            <div className="text-lg font-bold text-red-600 dark:text-red-400 whitespace-nowrap">
                              {formatCurrency(overdueAmount)}
                            </div>
                          </div>
                        </div>

                        <div className="h-10 w-px bg-border shrink-0" />

                        <div className="flex items-center gap-2 min-w-0">
                          <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                            <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                              Advance Payment
                            </div>
                            <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                              {activeTenant.advance_payment !== undefined &&
                              activeTenant.advance_payment > 0
                                ? formatCurrency(activeTenant.advance_payment)
                                : formatCurrency(0)}
                            </div>
                          </div>
                        </div>

                        <div className="h-10 w-px bg-border shrink-0" />

                        <div className="flex items-center gap-2 min-w-0">
                          <div className="h-8 w-8 rounded-full bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center shrink-0">
                            <Shield className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                              Security Deposit
                            </div>
                            <div className="text-lg font-bold text-cyan-600 dark:text-cyan-400 whitespace-nowrap">
                              {activeTenant.security_deposit !== undefined &&
                              activeTenant.security_deposit > 0
                                ? formatCurrency(activeTenant.security_deposit)
                                : formatCurrency(0)}
                            </div>
                          </div>
                        </div>

                        <div className="h-10 w-px bg-border shrink-0" />

                        <div className="flex items-center gap-2 min-w-0">
                          <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                            <Plus className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                              Overflow (Excess)
                            </div>
                            <div className="text-lg font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                              {activeTenant.overflow !== undefined &&
                              activeTenant.overflow > 0
                                ? formatCurrency(activeTenant.overflow)
                                : formatCurrency(0)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Card className="shadow-sm">
                    <CardContent className="p-4 md:p-6">
                      <div className="flex justify-between items-center mb-4 md:mb-6 flex-wrap gap-2">
                        <h3 className="text-base md:text-lg font-semibold flex items-center">
                          <FileText className="h-4 w-4 md:h-5 md:w-5 mr-2 text-primary" />
                          Billing Table
                        </h3>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => setIsPaymentDialogOpen(true)}
                            className="text-xs h-8 gap-1.5"
                          >
                            Apply Payment
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setIsEditBillingPopupOpen(true)}
                            className="text-xs h-8 gap-1.5"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit Billing
                          </Button>
                        </div>
                      </div>

                      {/* View Mode Selector for multi-tenant properties */}
                      {paxCount > 1 && (
                        <div className="mb-4">
                          <Label
                            htmlFor="billing-view"
                            className="text-xs mb-2 block"
                          >
                            View Mode
                          </Label>
                          <Select
                            value={billingViewMode}
                            onValueChange={setBillingViewMode}
                          >
                            <SelectTrigger
                              id="billing-view"
                              className="w-full md:w-64 h-9 text-xs"
                            >
                              <SelectValue placeholder="Select view mode" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="consolidated">
                                Consolidated (All Tenants)
                              </SelectItem>
                              {activeTenant?.pax_details?.map((person, idx) => (
                                <SelectItem key={idx} value={`tenant-${idx}`}>
                                  {person.name || `Tenant ${idx + 1}`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* Info banner for multi-tenant payment tracking - only show in consolidated view */}
                      {paxCount > 1 && billingViewMode === "consolidated" && (
                        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
                          <div className="flex items-start gap-2">
                            <div className="h-5 w-5 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <User className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div className="flex-1">
                              <p className="text-xs font-medium text-blue-900 dark:text-blue-100 mb-1">
                                Multi-Tenant Payment Tracking Active
                              </p>
                              <p className="text-xs text-blue-700 dark:text-blue-300">
                                This property has {paxCount} tenants. Payments
                                are tracked individually per tenant. Hover over
                                the "Paid" amount to see who has paid their
                                share (₱
                                {formatCurrency(
                                  activeTenant?.billing_entries?.[0]?.gross_due
                                    ? activeTenant.billing_entries[0]
                                        .gross_due / paxCount
                                    : 0,
                                ).replace("₱", "")}{" "}
                                per person).
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Individual Tenant View Indicator */}
                      {billingViewMode.startsWith("tenant-") && (
                        <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3 mb-4">
                          <div className="flex items-center gap-2">
                            <div className="h-5 w-5 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center flex-shrink-0">
                              <User className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                            </div>
                            <p className="text-xs font-medium text-purple-900 dark:text-purple-100">
                              Viewing individual billing for:{" "}
                              {activeTenant?.pax_details?.[
                                parseInt(billingViewMode.split("-")[1])
                              ]?.name ||
                                `Tenant ${parseInt(billingViewMode.split("-")[1]) + 1}`}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Responsive table with horizontal scrolling for small screens */}
                      <div className="overflow-x-auto -mx-4 sm:-mx-6">
                        <div className="inline-block min-w-full align-middle px-4 sm:px-6">
                          <div className="overflow-hidden border rounded-md">
                            {(() => {
                              // Determine if we're viewing individual tenant data
                              const isIndividualView =
                                billingViewMode.startsWith("tenant-");
                              const selectedTenantIdx = isIndividualView
                                ? parseInt(billingViewMode.split("-")[1])
                                : null;
                              const selectedTenantName =
                                selectedTenantIdx !== null
                                  ? activeTenant?.pax_details?.[
                                      selectedTenantIdx
                                    ]?.name || `Tenant ${selectedTenantIdx + 1}`
                                  : null;

                              // Check if selected tenant slot is vacant
                              const isVacantSlot =
                                isIndividualView &&
                                selectedTenantIdx !== null &&
                                (!activeTenant?.pax_details?.[selectedTenantIdx]
                                  ?.name ||
                                  activeTenant?.pax_details?.[
                                    selectedTenantIdx
                                  ]?.name.trim() === "");

                              return (
                                <table className="min-w-full divide-y divide-border">
                                  <thead className="bg-muted/50">
                                    <tr>
                                      <th
                                        scope="col"
                                        className="px-3 py-2 text-left text-xs font-medium text-muted-foreground"
                                      >
                                        Period
                                      </th>
                                      <th
                                        scope="col"
                                        className="px-3 py-2 text-left text-xs font-medium text-muted-foreground"
                                      >
                                        Due Date
                                      </th>
                                      <th
                                        scope="col"
                                        className="px-3 py-2 text-left text-xs font-medium text-muted-foreground"
                                      >
                                        {isIndividualView
                                          ? "Tenant's Share"
                                          : "Rent"}
                                      </th>
                                      <th
                                        scope="col"
                                        className="px-3 py-2 text-left text-xs font-medium text-muted-foreground"
                                      >
                                        {isIndividualView
                                          ? "Tenant's Expenses"
                                          : "Expenses"}
                                      </th>
                                      <th
                                        scope="col"
                                        className="px-3 py-2 text-left text-xs font-medium text-muted-foreground"
                                      >
                                        {isIndividualView
                                          ? "Tenant's Total Due"
                                          : "Total"}
                                      </th>
                                      <th
                                        scope="col"
                                        className="px-3 py-2 text-left text-xs font-medium text-muted-foreground"
                                      >
                                        {isIndividualView
                                          ? "Tenant Paid"
                                          : "Paid"}
                                      </th>
                                      <th
                                        scope="col"
                                        className="px-3 py-2 text-left text-xs font-medium text-muted-foreground"
                                      >
                                        Status
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-muted/40 bg-background">
                                    {isVacantSlot ? (
                                      <tr>
                                        <td
                                          colSpan={7}
                                          className="px-3 py-8 text-center"
                                        >
                                          <div className="flex flex-col items-center justify-center text-muted-foreground">
                                            <FileText className="h-8 w-8 mb-2 opacity-40" />
                                            <p className="text-sm font-medium">
                                              No records found
                                            </p>
                                            <p className="text-xs mt-1">
                                              This tenant slot is currently
                                              vacant
                                            </p>
                                          </div>
                                        </td>
                                      </tr>
                                    ) : billingEntries.length > 0 ? (
                                      billingEntries
                                        .sort(
                                          (a, b) =>
                                            new Date(a.due_date).getTime() -
                                            new Date(b.due_date).getTime(),
                                        )
                                        .map((entry) => {
                                          // Parse expense items from JSON string
                                          const expenseItems: ExpenseItem[] =
                                            entry.expense_items
                                              ? JSON.parse(entry.expense_items)
                                              : [
                                                  {
                                                    id: `default-${entry.id}`,
                                                    name: "Miscellaneous",
                                                    amount: entry.other_charges,
                                                  },
                                                ];

                                          // Calculate per-tenant amounts if in individual view
                                          const tenantShareRent =
                                            isIndividualView
                                              ? entry.rent_due / paxCount
                                              : entry.rent_due;
                                          const tenantShareExpenses =
                                            isIndividualView
                                              ? entry.other_charges / paxCount
                                              : entry.other_charges;
                                          const tenantShareTotal =
                                            isIndividualView
                                              ? entry.gross_due / paxCount
                                              : entry.gross_due;

                                          // Get tenant's paid amount from tenant_payments
                                          let tenantPaidAmount =
                                            entry.paid_amount || 0;
                                          let tenantStatus = entry.status;

                                          if (
                                            isIndividualView &&
                                            selectedTenantIdx !== null
                                          ) {
                                            const tenantPayments: TenantPaymentMap =
                                              entry.tenant_payments
                                                ? JSON.parse(
                                                    entry.tenant_payments,
                                                  )
                                                : {};
                                            tenantPaidAmount =
                                              tenantPayments[
                                                selectedTenantIdx.toString()
                                              ] || 0;

                                            // Calculate tenant-specific status
                                            const tenantBalance =
                                              tenantShareTotal -
                                              tenantPaidAmount;
                                            if (tenantBalance <= 0.01) {
                                              tenantStatus = "Paid";
                                            } else if (tenantPaidAmount > 0) {
                                              tenantStatus = "Partial";
                                            } else {
                                              tenantStatus = entry.status; // Keep original status if not paid
                                            }
                                          }

                                          return (
                                            <tr
                                              key={entry.id}
                                              className="hover:bg-muted/30 transition-colors"
                                            >
                                              <td className="px-3 py-2 text-xs whitespace-nowrap">
                                                <div className="flex items-center">
                                                  <ClipboardCheck className="h-3 w-3 text-muted-foreground mr-1.5 flex-shrink-0" />
                                                  <span>
                                                    {entry.billing_period >
                                                    0 ? (
                                                      entry.billing_period
                                                    ) : (
                                                      <span className="text-muted-foreground italic">
                                                        —
                                                      </span>
                                                    )}
                                                  </span>
                                                </div>
                                              </td>
                                              <td className="px-3 py-2 text-xs whitespace-nowrap">
                                                {formatDueDate(entry.due_date)}
                                              </td>
                                              <td className="px-3 py-2 text-xs font-medium text-green-600 dark:text-green-400 whitespace-nowrap">
                                                {formatCurrency(
                                                  tenantShareRent,
                                                )}
                                              </td>
                                              <td className="px-3 py-2 text-xs">
                                                <div className="group inline-block relative">
                                                  <div className="flex items-center cursor-help gap-1">
                                                    <span>
                                                      {formatCurrency(
                                                        tenantShareExpenses,
                                                      )}
                                                    </span>
                                                    {!isIndividualView && (
                                                      <span className="text-[10px] bg-muted rounded-full px-1 flex items-center justify-center w-4 h-4">
                                                        {expenseItems.length}
                                                      </span>
                                                    )}
                                                  </div>

                                                  {/* Hover tooltip for expenses - wrapper technique */}
                                                  {expenseItems.length > 0 &&
                                                    !isIndividualView && (
                                                      <span className="absolute invisible group-hover:visible z-[100]">
                                                        <span className="relative block top-full right-0 mt-1 bg-popover shadow-lg rounded-md p-2 min-w-[200px] border">
                                                          <div className="text-xs font-medium mb-1.5">
                                                            {entry.billing_period >
                                                            0
                                                              ? `Expenses for Period ${entry.billing_period}`
                                                              : "Additional Charges"}
                                                            :
                                                          </div>
                                                          {expenseItems.map(
                                                            (item) => (
                                                              <div
                                                                key={item.id}
                                                                className="flex justify-between text-xs mb-1.5"
                                                              >
                                                                <span className="truncate max-w-[150px] pr-4">
                                                                  {item.name}
                                                                </span>
                                                                <span className="text-right font-medium">
                                                                  {formatCurrency(
                                                                    item.amount,
                                                                  )}
                                                                </span>
                                                              </div>
                                                            ),
                                                          )}
                                                          {expenseItems.length >
                                                            1 && (
                                                            <div className="border-t border-border pt-1.5 mt-1.5 flex justify-between text-xs font-medium">
                                                              <span>
                                                                Total Expenses
                                                              </span>
                                                              <span>
                                                                {formatCurrency(
                                                                  entry.other_charges,
                                                                )}
                                                              </span>
                                                            </div>
                                                          )}
                                                        </span>
                                                      </span>
                                                    )}
                                                </div>
                                              </td>
                                              <td className="px-3 py-2 text-xs font-semibold whitespace-nowrap">
                                                {formatCurrency(
                                                  tenantShareTotal,
                                                )}
                                              </td>
                                              <td className="px-3 py-2 text-xs font-semibold text-green-600 dark:text-green-400 whitespace-nowrap">
                                                {paxCount > 1 &&
                                                entry.tenant_payments &&
                                                !isIndividualView ? (
                                                  <div className="group inline-block cursor-help relative">
                                                    <div>
                                                      {formatCurrency(
                                                        entry.paid_amount || 0,
                                                      )}
                                                    </div>
                                                    {/* Per-tenant payment breakdown tooltip - wrapper technique */}
                                                    <span className="absolute invisible group-hover:visible z-[100]">
                                                      <span className="relative block bottom-full right-0 mb-1 bg-popover shadow-lg rounded-md p-3 min-w-[220px] border">
                                                        <div className="text-xs font-medium mb-2">
                                                          Per-Tenant Payments:
                                                        </div>
                                                        <div className="space-y-1.5">
                                                          {(() => {
                                                            const tenantPayments: TenantPaymentMap =
                                                              JSON.parse(
                                                                entry.tenant_payments ||
                                                                  "{}",
                                                              );
                                                            const perPersonShare =
                                                              entry.gross_due /
                                                              paxCount;
                                                            return Array.from(
                                                              {
                                                                length:
                                                                  paxCount,
                                                              },
                                                              (_, i) => {
                                                                const person =
                                                                  activeTenant
                                                                    ?.pax_details?.[
                                                                    i
                                                                  ];
                                                                const paid =
                                                                  tenantPayments[
                                                                    i.toString()
                                                                  ] || 0;
                                                                const isPaid =
                                                                  paid >=
                                                                  perPersonShare -
                                                                    0.01;
                                                                return (
                                                                  <div
                                                                    key={i}
                                                                    className="flex items-center justify-between text-xs"
                                                                  >
                                                                    <div className="flex items-center gap-1.5">
                                                                      <div
                                                                        className={`w-2 h-2 rounded-full ${isPaid ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"}`}
                                                                      />
                                                                      <span className="truncate max-w-[100px]">
                                                                        {person?.name ||
                                                                          `Tenant ${i + 1}`}
                                                                      </span>
                                                                    </div>
                                                                    <span
                                                                      className={`font-medium ${isPaid ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}
                                                                    >
                                                                      {formatCurrency(
                                                                        paid,
                                                                      )}
                                                                    </span>
                                                                  </div>
                                                                );
                                                              },
                                                            );
                                                          })()}
                                                        </div>
                                                        <div className="border-t border-border mt-2 pt-2 text-xs">
                                                          <div className="flex justify-between font-medium">
                                                            <span>
                                                              Total Paid:
                                                            </span>
                                                            <span className="text-green-600 dark:text-green-400">
                                                              {formatCurrency(
                                                                entry.paid_amount ||
                                                                  0,
                                                              )}
                                                            </span>
                                                          </div>
                                                          <div className="flex justify-between text-muted-foreground mt-1">
                                                            <span>
                                                              Per Person:
                                                            </span>
                                                            <span>
                                                              {formatCurrency(
                                                                entry.gross_due /
                                                                  paxCount,
                                                              )}
                                                            </span>
                                                          </div>
                                                        </div>
                                                      </span>
                                                    </span>
                                                  </div>
                                                ) : (
                                                  formatCurrency(
                                                    tenantPaidAmount,
                                                  )
                                                )}
                                              </td>
                                              <td className="px-3 py-2 text-xs whitespace-nowrap">
                                                <Badge
                                                  variant="outline"
                                                  className={`text-[10px] px-1.5 py-0.5 ${getStatusColorClass(
                                                    tenantStatus,
                                                  )}`}
                                                >
                                                  {tenantStatus}
                                                </Badge>
                                              </td>
                                            </tr>
                                          );
                                        })
                                    ) : (
                                      <tr>
                                        <td
                                          colSpan={7}
                                          className="px-3 py-8 text-center"
                                        >
                                          <div className="flex flex-col items-center justify-center text-muted-foreground">
                                            <FileText className="h-8 w-8 mb-2 opacity-40" />
                                            <p className="text-sm font-medium">
                                              No billing entries yet
                                            </p>
                                            <p className="text-xs mt-1">
                                              Click "Edit Property" to add
                                              billing entries
                                            </p>
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              );
                            })()}
                          </div>
                        </div>
                      </div>

                      {/* Per-Tenant Payment Summary */}
                      {paxCount > 1 && billingEntries.length > 0 && (
                        <div className="mt-6 border-t pt-6">
                          <h4 className="text-sm font-semibold mb-3 flex items-center">
                            <User className="h-4 w-4 mr-2 text-primary" />
                            Payment Summary by Tenant
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {Array.from({ length: paxCount }, (_, i) => {
                              const person = activeTenant?.pax_details?.[i];
                              const tenantKey = i.toString();

                              // Calculate totals for this tenant across all billing entries
                              let tenantTotalDue = 0;
                              let tenantTotalPaid = 0;

                              billingEntries.forEach((entry) => {
                                const perPersonShare =
                                  entry.gross_due / paxCount;
                                tenantTotalDue += perPersonShare;

                                if (entry.tenant_payments) {
                                  try {
                                    const payments: TenantPaymentMap =
                                      JSON.parse(entry.tenant_payments);
                                    tenantTotalPaid += payments[tenantKey] || 0;
                                  } catch (e) {
                                    // Ignore parse errors
                                  }
                                }
                              });

                              const tenantBalance =
                                tenantTotalDue - tenantTotalPaid;
                              const isPaidUp = tenantBalance <= 0.01;

                              return (
                                <div
                                  key={i}
                                  className={`p-3 rounded-lg border ${
                                    isPaidUp
                                      ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
                                      : "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800"
                                  }`}
                                >
                                  <div className="flex items-center gap-2 mb-2">
                                    <div
                                      className={`h-8 w-8 rounded-full flex items-center justify-center ${
                                        isPaidUp
                                          ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300"
                                          : "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300"
                                      }`}
                                    >
                                      <User className="h-4 w-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-medium truncate">
                                        {person?.name || `Tenant ${i + 1}`}
                                      </p>
                                      <p
                                        className={`text-[10px] font-medium ${
                                          isPaidUp
                                            ? "text-green-600 dark:text-green-400"
                                            : "text-orange-600 dark:text-orange-400"
                                        }`}
                                      >
                                        {isPaidUp
                                          ? "✓ Paid Up"
                                          : `₱${tenantBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} Due`}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="space-y-1 text-xs">
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">
                                        Total Due:
                                      </span>
                                      <span className="font-medium">
                                        {formatCurrency(tenantTotalDue)}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">
                                        Paid:
                                      </span>
                                      <span className="font-medium text-green-600 dark:text-green-400">
                                        {formatCurrency(tenantTotalPaid)}
                                      </span>
                                    </div>
                                    {!isPaidUp && (
                                      <div className="flex justify-between pt-1 border-t">
                                        <span className="font-medium">
                                          Balance:
                                        </span>
                                        <span className="font-bold text-orange-600 dark:text-orange-400">
                                          {formatCurrency(tenantBalance)}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center p-8 md:p-12 text-center">
                  <div className="rounded-full bg-muted/50 p-4 mb-4"></div>
                  <h3 className="text-base md:text-lg font-medium mt-2">
                    No Financial Records
                  </h3>
                  <p className="text-muted-foreground mt-2 max-w-md text-xs md:text-sm">
                    This property is currently vacant. Financial records will be
                    available once a tenant is added to this property.
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent
            value="history"
            className="flex-1 overflow-auto px-4 md:px-6 pt-4 pb-16"
          >
            <div className="space-y-4">
              <Card className="shadow-sm">
                <CardContent className="p-4 md:p-6">
                  <h3 className="text-base md:text-lg font-semibold mb-4 flex items-center">
                    <Clock className="h-4 w-4 md:h-5 md:w-5 mr-2 text-primary" />
                    Activity Timeline
                  </h3>

                  {activityLogs.length > 0 ? (
                    <div className="space-y-3">
                      {activityLogs.map((log, index) => (
                        <div
                          key={log.id}
                          className="flex gap-3 pb-3 border-b last:border-b-0 last:pb-0"
                        >
                          <div className="flex-shrink-0 mt-1">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                              {log.action_type.includes("payment") ? (
                                <CreditCard className="h-4 w-4 text-green-600" />
                              ) : log.action_type.includes("tenant") ? (
                                <User className="h-4 w-4 text-blue-600" />
                              ) : log.action_type.includes("property") ? (
                                <Building className="h-4 w-4 text-purple-600" />
                              ) : (
                                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">
                              {log.description}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(log.created_at).toLocaleString(
                                "en-US",
                                {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                      <Clock className="h-12 w-12 mb-3 opacity-40" />
                      <p className="text-sm font-medium">No activity yet</p>
                      <p className="text-xs mt-1">
                        Activity history will appear here as changes are made
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer Actions - Fixed at bottom */}
        <div className="border-t mt-auto p-4 md:p-6 bg-background/95 backdrop-blur-sm flex justify-between items-center flex-wrap gap-2">
          <div className="flex gap-2">
            {property.occupancy_status === "occupied" && activeTenant && (
              <Button
                variant="outline"
                onClick={() => setIsResetDialogOpen(true)}
                className="gap-1.5 h-9 text-xs sm:text-sm border-orange-200 text-orange-600 hover:bg-orange-50 hover:text-orange-700 dark:border-orange-800 dark:text-orange-400 dark:hover:bg-orange-900/20"
                size="sm"
              >
                <Archive className="h-3.5 w-3.5" />
                Reset Property
              </Button>
            )}
            <Button
              variant="destructive"
              onClick={() => setIsDeleteDialogOpen(true)}
              className="gap-1.5 h-9 text-xs sm:text-sm"
              size="sm"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete Property
            </Button>
          </div>

          <Button
            onClick={onClose}
            className="h-9 text-xs sm:text-sm"
            size="sm"
          >
            Close
          </Button>
        </div>
      </DialogContent>

      <AmenitiesPopup
        isOpen={isAmenitiesPopupOpen}
        onClose={() => setIsAmenitiesPopupOpen(false)}
        currentAmenities={
          property?.amenities ? JSON.parse(property.amenities) : []
        }
        onSave={async (selectedAmenities) => {
          try {
            const { error } = await supabase
              .from("properties")
              .update({ amenities: JSON.stringify(selectedAmenities) })
              .eq("id", propertyId);

            if (error) throw error;

            // Refresh property data
            await fetchPropertyDetails();
            toast.success("Amenities updated successfully");
          } catch (err) {
            console.error("Error updating amenities:", err);
            toast.error(
              "Failed to update amenities. The amenities column may not exist in the database yet.",
            );
          }
        }}
      />

      {isEditPopupOpen && (
        <EditPropertyPopup
          propertyId={propertyId}
          isOpen={isEditPopupOpen}
          onClose={() => setIsEditPopupOpen(false)}
          onSuccess={() => {
            // Refresh data when edit is successful
            fetchPropertyDetails();
            // Call parent's onSuccess to refresh dashboard
            if (onSuccess) {
              onSuccess();
            }
          }}
          onSwitchToBilling={() => {
            setIsEditPopupOpen(false);
            setIsEditBillingPopupOpen(true);
          }}
        />
      )}

      {isEditBillingPopupOpen && activeTenant && (
        <EditBillingPopup
          propertyId={propertyId}
          tenantId={activeTenant.id}
          isOpen={isEditBillingPopupOpen}
          onClose={() => setIsEditBillingPopupOpen(false)}
          onSuccess={() => {
            // Refresh data when edit is successful
            fetchPropertyDetails();
            // Call parent's onSuccess to refresh dashboard
            if (onSuccess) {
              onSuccess();
            }
          }}
          onSwitchToProperty={() => {
            setIsEditBillingPopupOpen(false);
            setIsEditPopupOpen(true);
          }}
        />
      )}

      <PropertyResetDialog
        isOpen={isResetDialogOpen}
        onClose={() => setIsResetDialogOpen(false)}
        onConfirm={async (remarks) => {
          if (!activeTenant) {
            toast.error("No active tenant found");
            return;
          }

          const result = await archiveAndResetProperty({
            propertyId: propertyId,
            tenantId: activeTenant.id,
            remarks: remarks,
          });

          if (result.success) {
            toast.success("Property reset successfully");
            setIsResetDialogOpen(false);
            onClose(); // Close the details popup
            // Refresh the parent component data
            if (onSuccess) {
              onSuccess();
            }
          } else {
            toast.error(result.error || "Failed to reset property");
          }
        }}
        propertyName={property.unit_name}
        tenantName={activeTenant?.tenant_name || ""}
      />

      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent className="max-w-[90%] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive text-base sm:text-lg">
              <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5" />
              Delete Property Permanently
            </AlertDialogTitle>
            <AlertDialogDescription
              className="space-y-2 text-xs sm:text-sm"
              asChild
            >
              <div>
                <div>
                  Are you sure you want to delete{" "}
                  <strong>{property.unit_name}</strong>? This action cannot be
                  undone and will permanently remove:
                </div>
                <ul className="list-disc pl-6 space-y-1">
                  <li>The property record</li>
                  {property.occupancy_status === "occupied" && activeTenant && (
                    <>
                      <li>
                        Tenant information for{" "}
                        {activeTenant.pax_details &&
                        activeTenant.pax_details.length > 1 ? (
                          <strong>
                            Multiple Tenants ({activeTenant.pax_details.length})
                          </strong>
                        ) : (
                          <strong>{activeTenant.tenant_name}</strong>
                        )}
                      </li>
                      <li>All billing and payment records</li>
                    </>
                  )}
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel
              disabled={isDeleting}
              className="text-xs sm:text-sm h-8 sm:h-9"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteProperty();
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs sm:text-sm h-8 sm:h-9"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin mr-1.5 sm:mr-2" />
                  Deleting...
                </>
              ) : (
                "Delete Permanently"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Universal Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base sm:text-lg">
              Apply Payment
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              {paxCount > 1
                ? "Select tenant and enter payment amount based on their share."
                : "Enter payment amount and type. Rent applies to billing entries."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {paxCount > 1 && (
              <div className="space-y-1.5">
                <Label htmlFor="tenant-selector" className="text-xs sm:text-sm">
                  Paying Tenant
                </Label>
                <Select
                  value={selectedTenantIndex?.toString() || ""}
                  onValueChange={(value) => {
                    const index = value === "all" ? null : parseInt(value);
                    setSelectedTenantIndex(index);

                    // Auto-calculate per-person share for rent
                    if (
                      index !== null &&
                      paymentType === "rent" &&
                      activeTenant?.billing_entries
                    ) {
                      // Calculate the person's share of unpaid amount
                      const totalUnpaid = (
                        activeTenant.billing_entries || []
                      ).reduce(
                        (sum, entry) =>
                          sum + (entry.gross_due - (entry.paid_amount || 0)),
                        0,
                      );
                      const perPersonShare = Math.ceil(totalUnpaid / paxCount);
                      setPaymentAmount(perPersonShare);
                    }
                  }}
                >
                  <SelectTrigger
                    id="tenant-selector"
                    className="h-8 sm:h-9 text-xs sm:text-sm"
                  >
                    <SelectValue placeholder="Select tenant" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs sm:text-sm">
                      All Tenants (Full Amount)
                    </SelectItem>
                    {activeTenant?.pax_details
                      ?.filter((p) => p.name && p.name.trim() !== "")
                      .map((person, idx) => (
                        <SelectItem
                          key={idx}
                          value={idx.toString()}
                          className="text-xs sm:text-sm"
                        >
                          {person.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {selectedTenantIndex !== null && (
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    Payment for{" "}
                    {activeTenant?.pax_details?.[selectedTenantIndex]?.name} (1/
                    {paxCount} share)
                  </p>
                )}
                {selectedTenantIndex === null && (
                  <p className="text-[10px] sm:text-xs text-amber-600 dark:text-amber-400">
                    ⚠️ Select tenant or "All Tenants"
                  </p>
                )}
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="payment-amount" className="text-xs sm:text-sm">
                Payment Amount
              </Label>
              <div className="flex gap-1.5">
                <Input
                  id="payment-amount"
                  type="number"
                  value={paymentAmount || ""}
                  onChange={(e) => {
                    const value = e.target.value.replace(/^0+(?=\d)/, "");
                    setPaymentAmount(parseInt(value) || 0);
                  }}
                  placeholder="Enter amount"
                  className="h-8 sm:h-9 flex-1 text-xs sm:text-sm"
                />
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant={paymentAmount >= 0 ? "default" : "outline"}
                    size="icon"
                    className={`h-8 w-8 sm:h-9 sm:w-9 ${
                      paymentAmount >= 0
                        ? "!bg-emerald-500 hover:!bg-emerald-600 !text-white"
                        : ""
                    }`}
                    onClick={() => setPaymentAmount(Math.abs(paymentAmount))}
                    disabled={paymentAmount >= 0}
                  >
                    <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant={paymentAmount < 0 ? "default" : "outline"}
                    size="icon"
                    className={`h-8 w-8 sm:h-9 sm:w-9 ${
                      paymentAmount < 0
                        ? "!bg-red-500 hover:!bg-red-600 !text-white"
                        : ""
                    }`}
                    onClick={() => setPaymentAmount(-Math.abs(paymentAmount))}
                    disabled={paymentAmount <= 0}
                  >
                    <Minus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </Button>
                </div>
              </div>
              {paxCount > 1 &&
                selectedTenantIndex !== null &&
                paymentType === "rent" &&
                activeTenant?.billing_entries && (
                  <p className="text-[10px] sm:text-xs text-green-600 dark:text-green-400">
                    Auto-calculated: 1/{paxCount} of unpaid balance
                  </p>
                )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="payment-type" className="text-xs sm:text-sm">
                Payment Type
              </Label>
              <Select value={paymentType} onValueChange={setPaymentType}>
                <SelectTrigger
                  id="payment-type"
                  className="h-8 sm:h-9 text-xs sm:text-sm"
                >
                  <SelectValue placeholder="Select payment type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rent" className="text-xs sm:text-sm">
                    Rent
                  </SelectItem>
                  <SelectItem value="deposit" className="text-xs sm:text-sm">
                    Security Deposit
                  </SelectItem>
                  <SelectItem value="advance" className="text-xs sm:text-sm">
                    Advance Payment
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="receipt-date" className="text-xs sm:text-sm">
                  Receipt Date
                </Label>
                <Input
                  id="receipt-date"
                  type="date"
                  value={receiptDate}
                  onChange={(e) => setReceiptDate(e.target.value)}
                  className="h-8 sm:h-9 text-xs sm:text-sm"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-1">
                <Label htmlFor="payment-note" className="text-xs sm:text-sm">
                  Note
                </Label>
                <Input
                  id="payment-note"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  placeholder="Optional note..."
                  className="h-8 sm:h-9 text-xs sm:text-sm"
                />
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded p-2">
              <p className="text-[10px] sm:text-xs text-muted-foreground leading-relaxed">
                {paymentType === "deposit" || paymentType === "advance"
                  ? `${paymentAmount >= 0 ? "Add to" : "Deduct from"} ${paymentType === "deposit" ? "Security Deposit" : "Advance"} balance.`
                  : paxCount > 1 && selectedTenantIndex !== null
                    ? `${activeTenant?.pax_details?.[selectedTenantIndex]?.name}'s share (1/${paxCount}): ₱${Math.abs(paymentAmount).toLocaleString()}`
                    : `${paymentAmount >= 0 ? "Add" : "Deduct"} ₱${Math.abs(paymentAmount).toLocaleString()} ${paymentAmount >= 0 ? "to" : "from"} billing entries chronologically.`}
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsPaymentDialogOpen(false);
                setPaymentAmount(0);
                setPaymentType("rent");
                setPaymentNote("");
                setReceiptDate("");
                setSelectedTenantIndex(null);
              }}
              disabled={isApplyingPayment}
              className="h-8 sm:h-9 text-xs sm:text-sm"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleApplyPayment}
              disabled={
                isApplyingPayment ||
                paymentAmount === 0 ||
                (paxCount > 1 &&
                  selectedTenantIndex === null &&
                  paymentType === "rent")
              }
              className="gap-1.5 h-8 sm:h-9 text-xs sm:text-sm"
            >
              {isApplyingPayment ? (
                <>
                  <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                  Applying...
                </>
              ) : (
                <>Apply Payment</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
